import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole, canAccessCountry } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
import { generateUploadSasToken } from "../utils/sas.js";
import { mapDocument, mapDocumentVersion } from "../utils/map.js";

async function getProductCountry(productId: number): Promise<{ countryId: number; isoCode: string } | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("Id", sql.Int, productId)
    .query(`
      SELECT p.CountryId, c.IsoCode
      FROM Products p
      JOIN Countries c ON c.Id = p.CountryId
      WHERE p.Id = @Id
    `);
  if (!r.recordset[0]) return null;
  return { countryId: r.recordset[0].CountryId, isoCode: r.recordset[0].IsoCode };
}

// GET /internal/v1/products/{productId}/documents
async function listDocuments(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Reader")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return { status: 400, jsonBody: { error: "Invalid productId" } };

  const product = await getProductCountry(productId);
  if (!product) return { status: 404, jsonBody: { error: "Product not found" } };

  const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Reader", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const pool = await getPool();
  const result = await pool
    .request()
    .input("ProductId", sql.Int, productId)
    .query(`
      SELECT pd.Id, pd.ProductId, pd.DocumentType, pd.IsActive, pd.CreatedAt,
             pd.CurrentVersionId,
             dv.VersionNumber AS CurrentVersionNumber,
             dv.FileName AS CurrentFileName,
             dv.BlobPath AS CurrentBlobPath,
             dv.FileSizeBytes AS CurrentFileSizeBytes,
             dv.UploadedAt AS CurrentUploadedAt,
             dv.UploadedBy AS CurrentUploadedBy
      FROM ProductDocuments pd
      LEFT JOIN DocumentVersions dv ON dv.Id = pd.CurrentVersionId
      WHERE pd.ProductId = @ProductId
      ORDER BY pd.DocumentType
    `);

  return { jsonBody: result.recordset.map(mapDocument) };
}

// POST /internal/v1/products/{productId}/documents
// Creates a document record and returns a SAS upload URL
async function createDocument(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Editor")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return { status: 400, jsonBody: { error: "Invalid productId" } };

  const product = await getProductCountry(productId);
  if (!product) return { status: 404, jsonBody: { error: "Product not found" } };

  const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Editor", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const body = (await req.json()) as any;
  if (!body.documentType) return { status: 400, jsonBody: { error: "documentType is required" } };
  if (!body.fileName) return { status: 400, jsonBody: { error: "fileName is required" } };

  const validTypes = ["Specification", "AllergenDeclaration", "NutritionalCertificate", "LabelScan", "Other"];
  if (!validTypes.includes(body.documentType)) {
    return { status: 400, jsonBody: { error: `documentType must be one of: ${validTypes.join(", ")}` } };
  }

  const pool = await getPool();

  // Create the document record
  const docResult = await pool
    .request()
    .input("ProductId", sql.Int, productId)
    .input("DocumentType", sql.NVarChar(50), body.documentType)
    .input("CreatedBy", sql.NVarChar(36), user.entraObjectId)
    .query(`
      INSERT INTO ProductDocuments (ProductId, DocumentType, IsActive, CreatedBy)
      OUTPUT INSERTED.Id, INSERTED.ProductId, INSERTED.DocumentType, INSERTED.IsActive,
             INSERTED.CreatedBy, INSERTED.CreatedAt
      VALUES (@ProductId, @DocumentType, 1, @CreatedBy)
    `);

  const doc = docResult.recordset[0];

  // Create the first version record (not yet uploaded — blob path will be confirmed on commit)
  const verResult = await pool
    .request()
    .input("DocumentId", sql.Int, doc.Id)
    .input("VersionNumber", sql.Int, 1)
    .input("FileName", sql.NVarChar(500), body.fileName)
    .input("FileSizeBytes", sql.BigInt, body.fileSizeBytes ?? null)
    .input("UploadedBy", sql.NVarChar(36), user.entraObjectId)
    .input("BlobPath", sql.NVarChar(1000), "") // placeholder — set after SAS generation
    .query(`
      INSERT INTO DocumentVersions (DocumentId, VersionNumber, FileName, BlobPath, FileSizeBytes, UploadedBy)
      OUTPUT INSERTED.Id, INSERTED.DocumentId, INSERTED.VersionNumber, INSERTED.FileName,
             INSERTED.BlobPath, INSERTED.FileSizeBytes, INSERTED.UploadedBy, INSERTED.UploadedAt
      VALUES (@DocumentId, @VersionNumber, @FileName, @BlobPath, @FileSizeBytes, @UploadedBy)
    `);

  const version = verResult.recordset[0];

  // Generate the SAS upload URL
  const sas = generateUploadSasToken(
    product.isoCode,
    productId,
    doc.Id,
    body.fileName,
    1,
  );

  // Update version with real blob path and set as current
  await pool
    .request()
    .input("Id", sql.Int, version.Id)
    .input("BlobPath", sql.NVarChar(1000), sas.blobPath)
    .query("UPDATE DocumentVersions SET BlobPath = @BlobPath WHERE Id = @Id");

  await pool
    .request()
    .input("DocumentId", sql.Int, doc.Id)
    .input("VersionId", sql.Int, version.Id)
    .query("UPDATE ProductDocuments SET CurrentVersionId = @VersionId WHERE Id = @DocumentId");

  await writeAuditLog("ProductDocuments", doc.Id, "Insert", user.entraObjectId, null, {
    ...doc,
    CurrentVersionId: version.Id,
  });

  return {
    status: 201,
    jsonBody: {
      document: mapDocument({ ...doc, CurrentVersionId: version.Id }),
      version: { ...mapDocumentVersion(version), blobPath: sas.blobPath },
      upload: {
        uploadUrl: sas.uploadUrl,
        expiresAt: sas.expiresAt,
      },
    },
  };
}

// POST /internal/v1/products/{productId}/documents/{id}/versions
// Adds a new version to an existing document
async function addDocumentVersion(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Editor")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  const documentId = parseInt(req.params.id);
  if (isNaN(productId) || isNaN(documentId)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const product = await getProductCountry(productId);
  if (!product) return { status: 404, jsonBody: { error: "Product not found" } };

  const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Editor", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const pool = await getPool();

  const docResult = await pool
    .request()
    .input("Id", sql.Int, documentId)
    .input("ProductId", sql.Int, productId)
    .query("SELECT * FROM ProductDocuments WHERE Id = @Id AND ProductId = @ProductId");
  if (!docResult.recordset[0]) return { status: 404, jsonBody: { error: "Document not found" } };

  const body = (await req.json()) as any;
  if (!body.fileName) return { status: 400, jsonBody: { error: "fileName is required" } };

  // Get next version number
  const maxVerResult = await pool
    .request()
    .input("DocumentId", sql.Int, documentId)
    .query("SELECT ISNULL(MAX(VersionNumber), 0) + 1 AS Next FROM DocumentVersions WHERE DocumentId = @DocumentId");
  const nextVersion = maxVerResult.recordset[0].Next as number;

  const sas = generateUploadSasToken(
    product.isoCode,
    productId,
    documentId,
    body.fileName,
    nextVersion,
  );

  const verResult = await pool
    .request()
    .input("DocumentId", sql.Int, documentId)
    .input("VersionNumber", sql.Int, nextVersion)
    .input("FileName", sql.NVarChar(500), body.fileName)
    .input("BlobPath", sql.NVarChar(1000), sas.blobPath)
    .input("FileSizeBytes", sql.BigInt, body.fileSizeBytes ?? null)
    .input("UploadedBy", sql.NVarChar(36), user.entraObjectId)
    .query(`
      INSERT INTO DocumentVersions (DocumentId, VersionNumber, FileName, BlobPath, FileSizeBytes, UploadedBy)
      OUTPUT INSERTED.Id, INSERTED.DocumentId, INSERTED.VersionNumber, INSERTED.FileName,
             INSERTED.BlobPath, INSERTED.FileSizeBytes, INSERTED.UploadedBy, INSERTED.UploadedAt
      VALUES (@DocumentId, @VersionNumber, @FileName, @BlobPath, @FileSizeBytes, @UploadedBy)
    `);

  const version = verResult.recordset[0];

  // Promote to current version
  await pool
    .request()
    .input("DocumentId", sql.Int, documentId)
    .input("VersionId", sql.Int, version.Id)
    .query("UPDATE ProductDocuments SET CurrentVersionId = @VersionId WHERE Id = @DocumentId");

  await writeAuditLog("DocumentVersions", version.Id, "Insert", user.entraObjectId, null, version);

  return {
    status: 201,
    jsonBody: {
      version: mapDocumentVersion(version),
      upload: {
        uploadUrl: sas.uploadUrl,
        expiresAt: sas.expiresAt,
      },
    },
  };
}

// GET /internal/v1/products/{productId}/documents/{id}/versions
async function listDocumentVersions(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Reader")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  const documentId = parseInt(req.params.id);
  if (isNaN(productId) || isNaN(documentId)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const product = await getProductCountry(productId);
  if (!product) return { status: 404, jsonBody: { error: "Product not found" } };

  const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Reader", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const pool = await getPool();

  const docResult = await pool
    .request()
    .input("Id", sql.Int, documentId)
    .input("ProductId", sql.Int, productId)
    .query("SELECT Id FROM ProductDocuments WHERE Id = @Id AND ProductId = @ProductId");
  if (!docResult.recordset[0]) return { status: 404, jsonBody: { error: "Document not found" } };

  const result = await pool
    .request()
    .input("DocumentId", sql.Int, documentId)
    .query(`
      SELECT Id, DocumentId, VersionNumber, FileName, BlobPath, FileSizeBytes, UploadedBy, UploadedAt
      FROM DocumentVersions
      WHERE DocumentId = @DocumentId
      ORDER BY VersionNumber DESC
    `);

  return { jsonBody: result.recordset.map(mapDocumentVersion) };
}

// DELETE /internal/v1/products/{productId}/documents/{id}
async function deleteDocument(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  const documentId = parseInt(req.params.id);
  if (isNaN(productId) || isNaN(documentId)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const product = await getProductCountry(productId);
  if (!product) return { status: 404, jsonBody: { error: "Product not found" } };

  const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Manager", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const pool = await getPool();

  const docResult = await pool
    .request()
    .input("Id", sql.Int, documentId)
    .input("ProductId", sql.Int, productId)
    .query("SELECT * FROM ProductDocuments WHERE Id = @Id AND ProductId = @ProductId");
  if (!docResult.recordset[0]) return { status: 404, jsonBody: { error: "Document not found" } };

  // Soft delete — set IsActive = 0
  await pool
    .request()
    .input("Id", sql.Int, documentId)
    .query("UPDATE ProductDocuments SET IsActive = 0 WHERE Id = @Id");

  await writeAuditLog("ProductDocuments", documentId, "Delete", user.entraObjectId, docResult.recordset[0], null);
  return { status: 204 };
}

app.http("listDocuments", {
  route: "internal/v1/products/{productId}/documents",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listDocuments,
});

app.http("createDocument", {
  route: "internal/v1/products/{productId}/documents",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createDocument,
});

app.http("listDocumentVersions", {
  route: "internal/v1/products/{productId}/documents/{id}/versions",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listDocumentVersions,
});

app.http("addDocumentVersion", {
  route: "internal/v1/products/{productId}/documents/{id}/versions",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: addDocumentVersion,
});

app.http("deleteDocument", {
  route: "internal/v1/products/{productId}/documents/{id}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: deleteDocument,
});

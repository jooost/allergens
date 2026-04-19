import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { authenticate } from "../middleware/auth.js";
import { hasRole, canAccessCountry } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
import { generateReadSasUrl } from "../utils/sas.js";
async function getProductCountry(productId) {
    const pool = await getPool();
    const r = await pool.request().input("Id", sql.Int, productId).query(`
    SELECT p.CountryId, c.IsoCode FROM Products p
    JOIN Countries c ON c.Id = p.CountryId WHERE p.Id = @Id
  `);
    if (!r.recordset[0])
        return null;
    return { countryId: r.recordset[0].CountryId, isoCode: r.recordset[0].IsoCode };
}
// POST /internal/v1/products/{id}/image  — multipart/form-data, field name "file"
app.http("uploadProductImage", {
    route: "internal/v1/products/{id}/image",
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Editor"))
                return forbidden();
            const productId = parseInt(req.params.id, 10);
            const product = await getProductCountry(productId);
            if (!product)
                return notFound();
            const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Editor", user.roles);
            if (!allowed)
                return forbidden();
            const formData = await req.formData();
            const file = formData.get("file");
            if (!file)
                return { status: 400, jsonBody: { error: "file field is required" } };
            const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
            if (!allowedTypes.includes(file.type)) {
                return { status: 400, jsonBody: { error: "File must be an image (JPEG, PNG, WebP, or GIF)" } };
            }
            const buffer = Buffer.from(await file.arrayBuffer());
            const blobPath = `${product.isoCode}/${productId}/image/${file.name}`;
            const blobClient = BlobServiceClient.fromConnectionString(process.env.BLOB_STORAGE_CONNECTION);
            const containerClient = blobClient.getContainerClient(process.env.BLOB_CONTAINER_NAME);
            await containerClient.createIfNotExists();
            const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
            await blockBlobClient.upload(buffer, buffer.length, {
                blobHTTPHeaders: { blobContentType: file.type },
            });
            const pool = await getPool();
            await pool.request()
                .input("Id", sql.Int, productId)
                .input("BlobPath", sql.NVarChar(500), blobPath)
                .input("FileName", sql.NVarChar(200), file.name)
                .input("ModifiedBy", sql.NVarChar(36), user.entraObjectId)
                .query(`
          UPDATE Products
          SET ImageBlobPath = @BlobPath, ImageFileName = @FileName,
              ModifiedBy = @ModifiedBy, ModifiedAt = SYSUTCDATETIME()
          WHERE Id = @Id
        `);
            await writeAuditLog("Products", productId, "Update", user.entraObjectId, { imageBlobPath: null }, { imageBlobPath: blobPath, imageFileName: file.name });
            const imageUrl = generateReadSasUrl(blobPath);
            return { jsonBody: { imageUrl, imageFileName: file.name } };
        }
        catch (err) {
            return serverError(err);
        }
    },
});
// DELETE /internal/v1/products/{id}/image
app.http("deleteProductImage", {
    route: "internal/v1/products/{id}/image",
    methods: ["DELETE"],
    authLevel: "anonymous",
    handler: async (req, _ctx) => {
        try {
            const user = await authenticate(req);
            if (!hasRole(user, "Editor"))
                return forbidden();
            const productId = parseInt(req.params.id, 10);
            const product = await getProductCountry(productId);
            if (!product)
                return notFound();
            const allowed = await canAccessCountry(user.entraObjectId, product.countryId, "Editor", user.roles);
            if (!allowed)
                return forbidden();
            const pool = await getPool();
            const existing = await pool.request()
                .input("Id", sql.Int, productId)
                .query("SELECT ImageBlobPath FROM Products WHERE Id = @Id");
            await pool.request()
                .input("Id", sql.Int, productId)
                .input("ModifiedBy", sql.NVarChar(36), user.entraObjectId)
                .query(`
          UPDATE Products
          SET ImageBlobPath = NULL, ImageFileName = NULL,
              ModifiedBy = @ModifiedBy, ModifiedAt = SYSUTCDATETIME()
          WHERE Id = @Id
        `);
            await writeAuditLog("Products", productId, "Update", user.entraObjectId, { imageBlobPath: existing.recordset[0]?.ImageBlobPath }, { imageBlobPath: null });
            return { status: 204 };
        }
        catch (err) {
            return serverError(err);
        }
    },
});
function notFound() { return { status: 404, jsonBody: { error: "Not found" } }; }
function forbidden() { return { status: 403, jsonBody: { error: "Forbidden" } }; }
function serverError(err) {
    console.error(err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
}

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole, canAccessCountry } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
import { mapProductSupplier } from "../utils/map.js";

// GET /internal/v1/products/{productId}/suppliers
async function listProductSuppliers(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Reader")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return { status: 400, jsonBody: { error: "Invalid productId" } };

  const pool = await getPool();

  // Verify product exists and user can access its country
  const productResult = await pool
    .request()
    .input("Id", sql.Int, productId)
    .query("SELECT CountryId FROM Products WHERE Id = @Id");
  if (!productResult.recordset[0]) return { status: 404, jsonBody: { error: "Product not found" } };

  const countryId = productResult.recordset[0].CountryId;
  const allowed = await canAccessCountry(user.entraObjectId, countryId, "Reader", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const result = await pool
    .request()
    .input("ProductId", sql.Int, productId)
    .query(`
      SELECT ps.Id, ps.ProductId, ps.SupplierId, ps.Priority, ps.Notes,
             s.Name AS SupplierName, s.ContactEmail, s.ContactPhone, s.IsActive AS SupplierIsActive
      FROM ProductSuppliers ps
      JOIN Suppliers s ON s.Id = ps.SupplierId
      WHERE ps.ProductId = @ProductId
      ORDER BY ps.Priority ASC, s.Name ASC
    `);

  return { jsonBody: result.recordset.map(mapProductSupplier) };
}

// POST /internal/v1/products/{productId}/suppliers
async function addProductSupplier(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Editor")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return { status: 400, jsonBody: { error: "Invalid productId" } };

  const pool = await getPool();

  const productResult = await pool
    .request()
    .input("Id", sql.Int, productId)
    .query("SELECT CountryId FROM Products WHERE Id = @Id");
  if (!productResult.recordset[0]) return { status: 404, jsonBody: { error: "Product not found" } };

  const countryId = productResult.recordset[0].CountryId;
  const allowed = await canAccessCountry(user.entraObjectId, countryId, "Editor", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const body = (await req.json()) as any;
  if (!body.supplierId) return { status: 400, jsonBody: { error: "supplierId is required" } };

  // Priority uniqueness is enforced by filtered unique index in DB
  const result = await pool
    .request()
    .input("ProductId", sql.Int, productId)
    .input("SupplierId", sql.Int, body.supplierId)
    .input("Priority", sql.Int, body.priority ?? null)
    .input("Notes", sql.NVarChar(500), body.notes ?? null)
    .query(`
      INSERT INTO ProductSuppliers (ProductId, SupplierId, Priority, Notes)
      OUTPUT INSERTED.Id, INSERTED.ProductId, INSERTED.SupplierId, INSERTED.Priority, INSERTED.Notes
      VALUES (@ProductId, @SupplierId, @Priority, @Notes)
    `);

  const created = result.recordset[0];
  await writeAuditLog("ProductSuppliers", created.Id, "Insert", user.entraObjectId, null, created);
  return { status: 201, jsonBody: mapProductSupplier(created) };
}

// PUT /internal/v1/products/{productId}/suppliers/{id}
async function updateProductSupplier(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Editor")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  const id = parseInt(req.params.id);
  if (isNaN(productId) || isNaN(id)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const pool = await getPool();

  const productResult = await pool
    .request()
    .input("Id", sql.Int, productId)
    .query("SELECT CountryId FROM Products WHERE Id = @Id");
  if (!productResult.recordset[0]) return { status: 404, jsonBody: { error: "Product not found" } };

  const countryId = productResult.recordset[0].CountryId;
  const allowed = await canAccessCountry(user.entraObjectId, countryId, "Editor", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const existing = await pool
    .request()
    .input("Id", sql.Int, id)
    .input("ProductId", sql.Int, productId)
    .query("SELECT * FROM ProductSuppliers WHERE Id = @Id AND ProductId = @ProductId");
  if (!existing.recordset[0]) return { status: 404, jsonBody: { error: "Not found" } };

  const old = existing.recordset[0];
  const body = (await req.json()) as any;

  const result = await pool
    .request()
    .input("Id", sql.Int, id)
    .input("Priority", sql.Int, body.priority !== undefined ? body.priority : old.Priority)
    .input("Notes", sql.NVarChar(500), body.notes !== undefined ? body.notes : old.Notes)
    .query(`
      UPDATE ProductSuppliers
      SET Priority = @Priority, Notes = @Notes
      OUTPUT INSERTED.Id, INSERTED.ProductId, INSERTED.SupplierId, INSERTED.Priority, INSERTED.Notes
      WHERE Id = @Id
    `);

  const updated = result.recordset[0];
  await writeAuditLog("ProductSuppliers", id, "Update", user.entraObjectId, old, updated);
  return { jsonBody: mapProductSupplier(updated) };
}

// DELETE /internal/v1/products/{productId}/suppliers/{id}
async function removeProductSupplier(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Editor")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const productId = parseInt(req.params.productId);
  const id = parseInt(req.params.id);
  if (isNaN(productId) || isNaN(id)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const pool = await getPool();

  const productResult = await pool
    .request()
    .input("Id", sql.Int, productId)
    .query("SELECT CountryId FROM Products WHERE Id = @Id");
  if (!productResult.recordset[0]) return { status: 404, jsonBody: { error: "Product not found" } };

  const countryId = productResult.recordset[0].CountryId;
  const allowed = await canAccessCountry(user.entraObjectId, countryId, "Editor", user.roles);
  if (!allowed) return { status: 403, jsonBody: { error: "Forbidden" } };

  const existing = await pool
    .request()
    .input("Id", sql.Int, id)
    .input("ProductId", sql.Int, productId)
    .query("SELECT * FROM ProductSuppliers WHERE Id = @Id AND ProductId = @ProductId");
  if (!existing.recordset[0]) return { status: 404, jsonBody: { error: "Not found" } };

  await pool
    .request()
    .input("Id", sql.Int, id)
    .query("DELETE FROM ProductSuppliers WHERE Id = @Id");

  await writeAuditLog("ProductSuppliers", id, "Delete", user.entraObjectId, existing.recordset[0], null);
  return { status: 204 };
}

app.http("listProductSuppliers", {
  route: "internal/v1/products/{productId}/suppliers",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listProductSuppliers,
});

app.http("addProductSupplier", {
  route: "internal/v1/products/{productId}/suppliers",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: addProductSupplier,
});

app.http("updateProductSupplier", {
  route: "internal/v1/products/{productId}/suppliers/{id}",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: updateProductSupplier,
});

app.http("removeProductSupplier", {
  route: "internal/v1/products/{productId}/suppliers/{id}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: removeProductSupplier,
});

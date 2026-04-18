import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
import { mapSupplier } from "../utils/map.js";

// GET /internal/v1/suppliers
async function listSuppliers(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Reader")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT s.Id, s.Name, s.ContactEmail, s.ContactPhone, s.Address, s.IsActive, s.CreatedAt,
           COUNT(DISTINCT ps.ProductId) AS ProductCount
    FROM Suppliers s
    LEFT JOIN ProductSuppliers ps ON ps.SupplierId = s.Id
    GROUP BY s.Id, s.Name, s.ContactEmail, s.ContactPhone, s.Address, s.IsActive, s.CreatedAt
    ORDER BY s.Name
  `);

  return { jsonBody: result.recordset.map(mapSupplier) };
}

// POST /internal/v1/suppliers
async function createSupplier(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const body = (await req.json()) as any;
  if (!body.name?.trim()) return { status: 400, jsonBody: { error: "name is required" } };

  const pool = await getPool();
  const result = await pool
    .request()
    .input("Name", sql.NVarChar(200), body.name.trim())
    .input("ContactEmail", sql.NVarChar(254), body.contactEmail ?? null)
    .input("ContactPhone", sql.NVarChar(50), body.contactPhone ?? null)
    .input("Address", sql.NVarChar(500), body.address ?? null)
    .query(`
      INSERT INTO Suppliers (Name, ContactEmail, ContactPhone, Address, IsActive)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.ContactEmail, INSERTED.ContactPhone,
             INSERTED.Address, INSERTED.IsActive, INSERTED.CreatedAt
      VALUES (@Name, @ContactEmail, @ContactPhone, @Address, 1)
    `);

  const created = result.recordset[0];
  await writeAuditLog("Suppliers", created.Id, "Insert", user.entraObjectId, null, created);
  return { status: 201, jsonBody: mapSupplier(created) };
}

// GET /internal/v1/suppliers/{id}
async function getSupplier(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Reader")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const id = parseInt(req.params.id);
  if (isNaN(id)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const pool = await getPool();
  const result = await pool
    .request()
    .input("Id", sql.Int, id)
    .query(`
      SELECT s.Id, s.Name, s.ContactEmail, s.ContactPhone, s.Address, s.IsActive, s.CreatedAt,
             COUNT(DISTINCT ps.ProductId) AS ProductCount
      FROM Suppliers s
      LEFT JOIN ProductSuppliers ps ON ps.SupplierId = s.Id
      WHERE s.Id = @Id
      GROUP BY s.Id, s.Name, s.ContactEmail, s.ContactPhone, s.Address, s.IsActive, s.CreatedAt
    `);

  if (!result.recordset[0]) return { status: 404, jsonBody: { error: "Not found" } };
  return { jsonBody: mapSupplier(result.recordset[0]) };
}

// PUT /internal/v1/suppliers/{id}
async function updateSupplier(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const id = parseInt(req.params.id);
  if (isNaN(id)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const pool = await getPool();
  const existing = await pool
    .request()
    .input("Id", sql.Int, id)
    .query("SELECT * FROM Suppliers WHERE Id = @Id");
  if (!existing.recordset[0]) return { status: 404, jsonBody: { error: "Not found" } };

  const old = existing.recordset[0];
  const body = (await req.json()) as any;

  const result = await pool
    .request()
    .input("Id", sql.Int, id)
    .input("Name", sql.NVarChar(200), body.name?.trim() ?? old.Name)
    .input("ContactEmail", sql.NVarChar(254), body.contactEmail !== undefined ? body.contactEmail : old.ContactEmail)
    .input("ContactPhone", sql.NVarChar(50), body.contactPhone !== undefined ? body.contactPhone : old.ContactPhone)
    .input("Address", sql.NVarChar(500), body.address !== undefined ? body.address : old.Address)
    .input("IsActive", sql.Bit, body.isActive !== undefined ? body.isActive : old.IsActive)
    .query(`
      UPDATE Suppliers
      SET Name = @Name, ContactEmail = @ContactEmail, ContactPhone = @ContactPhone,
          Address = @Address, IsActive = @IsActive
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.ContactEmail, INSERTED.ContactPhone,
             INSERTED.Address, INSERTED.IsActive, INSERTED.CreatedAt
      WHERE Id = @Id
    `);

  const updated = result.recordset[0];
  await writeAuditLog("Suppliers", id, "Update", user.entraObjectId, old, updated);
  return { jsonBody: mapSupplier(updated) };
}

app.http("listSuppliers", {
  route: "internal/v1/suppliers",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listSuppliers,
});

app.http("createSupplier", {
  route: "internal/v1/suppliers",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createSupplier,
});

app.http("getSupplier", {
  route: "internal/v1/suppliers/{id}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getSupplier,
});

app.http("updateSupplier", {
  route: "internal/v1/suppliers/{id}",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: updateSupplier,
});

import { app } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
import { mapCategory } from "../utils/map.js";
// GET /internal/v1/reference/allergens
async function listAllergens(req, ctx) {
    const user = await authenticate(req);
    if (!hasRole(user, "Reader"))
        return { status: 403, jsonBody: { error: "Forbidden" } };
    const langId = user.preferredLanguageId;
    const pool = await getPool();
    const result = await pool
        .request()
        .input("LangId", sql.Int, langId ?? null)
        .query(`
      SELECT a.Id, a.Code, a.SortOrder,
             COALESCE(t.Name, en.Name) AS Name,
             COALESCE(t.Description, en.Description) AS Description
      FROM Allergens a
      LEFT JOIN AllergenTranslations en ON en.AllergenId = a.Id AND en.LanguageId = (
        SELECT Id FROM Languages WHERE IsoCode = 'en'
      )
      LEFT JOIN AllergenTranslations t ON t.AllergenId = a.Id AND t.LanguageId = @LangId
      WHERE a.IsActive = 1
      ORDER BY a.SortOrder, a.Code
    `);
    return { jsonBody: result.recordset.map((r) => ({
            id: r.Id, code: r.Code, sortOrder: r.SortOrder, name: r.Name, description: r.Description ?? null,
        })) };
}
// GET /internal/v1/reference/categories
async function listCategories(req, ctx) {
    const user = await authenticate(req);
    if (!hasRole(user, "Reader"))
        return { status: 403, jsonBody: { error: "Forbidden" } };
    const pool = await getPool();
    const result = await pool.request().query(`
    SELECT Id, Name, Description, IsActive
    FROM ProductCategories
    WHERE IsActive = 1
    ORDER BY Name
  `);
    return { jsonBody: result.recordset.map((r) => ({
            id: r.Id, name: r.Name, description: r.Description ?? null, isActive: r.IsActive,
        })) };
}
// GET /internal/v1/reference/regions
async function listRegions(req, ctx) {
    const user = await authenticate(req);
    if (!hasRole(user, "Reader"))
        return { status: 403, jsonBody: { error: "Forbidden" } };
    const pool = await getPool();
    const result = await pool.request().query(`
    SELECT r.Id, r.Name,
           (SELECT COUNT(*) FROM Countries c WHERE c.RegionId = r.Id AND c.IsActive = 1) AS CountryCount
    FROM Regions r
    ORDER BY r.Name
  `);
    return { jsonBody: result.recordset.map((r) => ({
            id: r.Id, name: r.Name, countryCount: r.CountryCount,
        })) };
}
// GET /internal/v1/reference/countries
async function listCountries(req, ctx) {
    const user = await authenticate(req);
    if (!hasRole(user, "Reader"))
        return { status: 403, jsonBody: { error: "Forbidden" } };
    const regionId = req.query.get("regionId");
    const pool = await getPool();
    const request = pool.request();
    let where = "WHERE c.IsActive = 1";
    if (regionId) {
        request.input("RegionId", sql.Int, parseInt(regionId));
        where += " AND c.RegionId = @RegionId";
    }
    const result = await request.query(`
    SELECT c.Id, c.Name, c.IsoCode, c.RegionId, r.Name AS RegionName
    FROM Countries c
    JOIN Regions r ON r.Id = c.RegionId
    ${where}
    ORDER BY r.Name, c.Name
  `);
    return { jsonBody: result.recordset.map((r) => ({
            id: r.Id, name: r.Name, isoCode: r.IsoCode, regionId: r.RegionId, regionName: r.RegionName,
        })) };
}
// GET /internal/v1/reference/languages
async function listLanguages(req, ctx) {
    const user = await authenticate(req);
    if (!hasRole(user, "Reader"))
        return { status: 403, jsonBody: { error: "Forbidden" } };
    const pool = await getPool();
    const result = await pool.request().query(`
    SELECT Id, Name, IsoCode, IsActive
    FROM Languages
    ORDER BY Name
  `);
    return { jsonBody: result.recordset.map((r) => ({
            id: r.Id, name: r.Name, isoCode: r.IsoCode, isActive: r.IsActive,
        })) };
}
// POST /internal/v1/reference/categories  (Admin only)
async function createCategory(req, ctx) {
    const user = await authenticate(req);
    if (!user.roles.includes("Admin"))
        return { status: 403, jsonBody: { error: "Admin only" } };
    const body = (await req.json());
    if (!body.name?.trim())
        return { status: 400, jsonBody: { error: "name is required" } };
    const pool = await getPool();
    const result = await pool
        .request()
        .input("Name", sql.NVarChar(100), body.name.trim())
        .input("Description", sql.NVarChar(500), body.description ?? null)
        .query(`
      INSERT INTO ProductCategories (Name, Description, IsActive)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Description, INSERTED.IsActive
      VALUES (@Name, @Description, 1)
    `);
    const created = result.recordset[0];
    await writeAuditLog("ProductCategories", created.Id, "Insert", user.entraObjectId, null, created);
    return { status: 201, jsonBody: mapCategory(created) };
}
// PUT /internal/v1/reference/categories/{id}  (Admin only)
async function updateCategory(req, ctx) {
    const user = await authenticate(req);
    if (!user.roles.includes("Admin"))
        return { status: 403, jsonBody: { error: "Admin only" } };
    const id = parseInt(req.params.id);
    if (isNaN(id))
        return { status: 400, jsonBody: { error: "Invalid id" } };
    const pool = await getPool();
    const existing = await pool
        .request()
        .input("Id", sql.Int, id)
        .query("SELECT * FROM ProductCategories WHERE Id = @Id");
    if (!existing.recordset[0])
        return { status: 404, jsonBody: { error: "Not found" } };
    const old = existing.recordset[0];
    const body = (await req.json());
    const result = await pool
        .request()
        .input("Id", sql.Int, id)
        .input("Name", sql.NVarChar(100), body.name?.trim() ?? old.Name)
        .input("Description", sql.NVarChar(500), body.description !== undefined ? body.description : old.Description)
        .input("IsActive", sql.Bit, body.isActive !== undefined ? body.isActive : old.IsActive)
        .query(`
      UPDATE ProductCategories
      SET Name = @Name, Description = @Description, IsActive = @IsActive
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Description, INSERTED.IsActive
      WHERE Id = @Id
    `);
    const updated = result.recordset[0];
    await writeAuditLog("ProductCategories", id, "Update", user.entraObjectId, old, updated);
    return { jsonBody: mapCategory(updated) };
}
app.http("listAllergens", {
    route: "internal/v1/reference/allergens",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: listAllergens,
});
app.http("listCategories", {
    route: "internal/v1/reference/categories",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: listCategories,
});
app.http("createCategory", {
    route: "internal/v1/reference/categories",
    methods: ["POST"],
    authLevel: "anonymous",
    handler: createCategory,
});
app.http("updateCategory", {
    route: "internal/v1/reference/categories/{id}",
    methods: ["PUT"],
    authLevel: "anonymous",
    handler: updateCategory,
});
app.http("listRegions", {
    route: "internal/v1/reference/regions",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: listRegions,
});
app.http("listCountries", {
    route: "internal/v1/reference/countries",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: listCountries,
});
app.http("listLanguages", {
    route: "internal/v1/reference/languages",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: listLanguages,
});

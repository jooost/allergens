import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
import { writeAuditLog } from "../utils/audit.js";
import { mapUser, mapPermission } from "../utils/map.js";

// GET /internal/v1/users
// Manager sees only their permitted countries; Admin sees all
async function listUsers(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const pool = await getPool();
  const result = await pool
    .request()
    .input("EntraObjectId", sql.NVarChar(36), user.entraObjectId)
    .input("IsAdmin", sql.Bit, user.roles.includes("Admin") ? 1 : 0)
    .query(`
      SELECT DISTINCT up.EntraObjectId, up.DisplayName, up.Email, up.CreatedAt, up.LastLoginAt,
             up.PreferredLanguageId
      FROM UserProfiles up
      WHERE @IsAdmin = 1
         OR EXISTS (
           SELECT 1 FROM UserPermissions perm
           WHERE perm.UserEntraObjectId = up.EntraObjectId
             AND perm.RegionId IN (
               SELECT RegionId FROM UserPermissions WHERE UserEntraObjectId = @EntraObjectId
             )
         )
      ORDER BY up.DisplayName
    `);

  return { jsonBody: result.recordset.map(mapUser) };
}

// GET /internal/v1/users/{entraObjectId}/permissions
async function getUserPermissions(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const targetId = req.params.entraObjectId;

  const pool = await getPool();
  const result = await pool
    .request()
    .input("TargetId", sql.NVarChar(36), targetId)
    .query(`
      SELECT up.Id, up.UserEntraObjectId, up.RegionId, up.CountryId, up.Role,
             r.Name AS RegionName,
             c.Name AS CountryName, c.IsoCode
      FROM UserPermissions up
      JOIN Regions r ON r.Id = up.RegionId
      LEFT JOIN Countries c ON c.Id = up.CountryId
      WHERE up.UserEntraObjectId = @TargetId
      ORDER BY r.Name, c.Name
    `);

  return { jsonBody: result.recordset.map(mapPermission) };
}

// POST /internal/v1/users/{entraObjectId}/permissions
async function grantPermission(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const targetId = req.params.entraObjectId;
  const body = (await req.json()) as any;

  if (!body.regionId) return { status: 400, jsonBody: { error: "regionId is required" } };
  if (!body.role) return { status: 400, jsonBody: { error: "role is required" } };

  const validRoles = ["Reader", "Editor", "Manager", "Admin"];
  if (!validRoles.includes(body.role)) {
    return { status: 400, jsonBody: { error: `role must be one of: ${validRoles.join(", ")}` } };
  }

  // Only Admin can grant Admin or Manager roles
  if ((body.role === "Admin" || body.role === "Manager") && !user.roles.includes("Admin")) {
    return { status: 403, jsonBody: { error: "Only Admin can grant Manager or Admin permissions" } };
  }

  const pool = await getPool();

  // Verify target user profile exists
  const profileCheck = await pool
    .request()
    .input("TargetId", sql.NVarChar(36), targetId)
    .query("SELECT EntraObjectId FROM UserProfiles WHERE EntraObjectId = @TargetId");
  if (!profileCheck.recordset[0]) {
    return { status: 404, jsonBody: { error: "User profile not found — user must log in first" } };
  }

  const result = await pool
    .request()
    .input("UserEntraObjectId", sql.NVarChar(36), targetId)
    .input("RegionId", sql.Int, body.regionId)
    .input("CountryId", sql.Int, body.countryId ?? null)
    .input("Role", sql.NVarChar(20), body.role)
    .query(`
      MERGE UserPermissions AS target
      USING (SELECT @UserEntraObjectId AS uid, @RegionId AS rid, @CountryId AS cid) AS src
        ON target.UserEntraObjectId = src.uid
           AND target.RegionId = src.rid
           AND (target.CountryId = src.cid OR (target.CountryId IS NULL AND src.cid IS NULL))
      WHEN MATCHED THEN
        UPDATE SET Role = @Role
      WHEN NOT MATCHED THEN
        INSERT (UserEntraObjectId, RegionId, CountryId, Role)
        VALUES (@UserEntraObjectId, @RegionId, @CountryId, @Role);

      SELECT up.Id, up.RegionId, up.CountryId, up.Role,
             r.Name AS RegionName,
             c.Name AS CountryName, c.IsoCode
      FROM UserPermissions up
      JOIN Regions r ON r.Id = up.RegionId
      LEFT JOIN Countries c ON c.Id = up.CountryId
      WHERE up.UserEntraObjectId = @UserEntraObjectId
        AND up.RegionId = @RegionId
        AND (up.CountryId = @CountryId OR (up.CountryId IS NULL AND @CountryId IS NULL))
    `);

  const perm = result.recordset[0];
  await writeAuditLog("UserPermissions", perm.Id, "Insert", user.entraObjectId, null, perm);
  return { status: 201, jsonBody: mapPermission(perm) };
}

// DELETE /internal/v1/users/{entraObjectId}/permissions/{id}
async function revokePermission(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  if (!hasRole(user, "Manager")) return { status: 403, jsonBody: { error: "Forbidden" } };

  const targetId = req.params.entraObjectId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return { status: 400, jsonBody: { error: "Invalid id" } };

  const pool = await getPool();

  const existing = await pool
    .request()
    .input("Id", sql.Int, id)
    .input("TargetId", sql.NVarChar(36), targetId)
    .query("SELECT * FROM UserPermissions WHERE Id = @Id AND UserEntraObjectId = @TargetId");

  if (!existing.recordset[0]) return { status: 404, jsonBody: { error: "Permission not found" } };

  const perm = existing.recordset[0];

  // Only Admin can revoke Manager/Admin permissions
  if ((perm.Role === "Admin" || perm.Role === "Manager") && !user.roles.includes("Admin")) {
    return { status: 403, jsonBody: { error: "Only Admin can revoke Manager or Admin permissions" } };
  }

  await pool.request().input("Id", sql.Int, id).query("DELETE FROM UserPermissions WHERE Id = @Id");

  await writeAuditLog("UserPermissions", id, "Delete", user.entraObjectId, perm, null);
  return { status: 204 };
}

// GET /internal/v1/users/me
async function getMe(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = await authenticate(req);

  const pool = await getPool();
  const permsResult = await pool
    .request()
    .input("EntraObjectId", sql.NVarChar(36), user.entraObjectId)
    .query(`
      SELECT up.Id, up.RegionId, up.CountryId, up.Role,
             r.Name AS RegionName,
             c.Name AS CountryName, c.IsoCode
      FROM UserPermissions up
      JOIN Regions r ON r.Id = up.RegionId
      LEFT JOIN Countries c ON c.Id = up.CountryId
      WHERE up.UserEntraObjectId = @EntraObjectId
    `);

  return {
    jsonBody: {
      entraObjectId: user.entraObjectId,
      displayName: user.displayName,
      email: user.email,
      roles: user.roles,
      preferredLanguageId: user.preferredLanguageId,
      permissions: permsResult.recordset.map(mapPermission),
    },
  };
}

// PUT /internal/v1/users/me/language
async function setPreferredLanguage(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const user = await authenticate(req);
  const body = (await req.json()) as any;

  if (!body.languageId) return { status: 400, jsonBody: { error: "languageId is required" } };

  const pool = await getPool();
  await pool
    .request()
    .input("EntraObjectId", sql.NVarChar(36), user.entraObjectId)
    .input("LanguageId", sql.Int, body.languageId)
    .query("UPDATE UserProfiles SET PreferredLanguageId = @LanguageId WHERE EntraObjectId = @EntraObjectId");

  return { jsonBody: { preferredLanguageId: body.languageId } };
}

app.http("listUsers", {
  route: "internal/v1/users",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listUsers,
});

app.http("getMe", {
  route: "internal/v1/users/me",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getMe,
});

app.http("setPreferredLanguage", {
  route: "internal/v1/users/me/language",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: setPreferredLanguage,
});

app.http("getUserPermissions", {
  route: "internal/v1/users/{entraObjectId}/permissions",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getUserPermissions,
});

app.http("grantPermission", {
  route: "internal/v1/users/{entraObjectId}/permissions",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: grantPermission,
});

app.http("revokePermission", {
  route: "internal/v1/users/{entraObjectId}/permissions/{id}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: revokePermission,
});

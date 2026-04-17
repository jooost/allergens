import { getPool, sql } from "../utils/db.js";
const ROLE_RANK = {
    Reader: 1,
    Editor: 2,
    Manager: 3,
    Admin: 4,
};
export function hasRole(user, minimum) {
    // Admin always passes
    if (user.roles.includes("Admin"))
        return true;
    return user.roles.some((r) => ROLE_RANK[r] !== undefined && ROLE_RANK[r] >= ROLE_RANK[minimum]);
}
export async function getUserCountryPermissions(entraObjectId) {
    const pool = await getPool();
    const result = await pool
        .request()
        .input("EntraObjectId", sql.NVarChar(36), entraObjectId)
        .query(`
      SELECT RegionId, CountryId, Role
      FROM UserPermissions
      WHERE UserEntraObjectId = @EntraObjectId
    `);
    return result.recordset.map((r) => ({
        regionId: r.RegionId,
        countryId: r.CountryId,
        role: r.Role,
    }));
}
export async function canAccessCountry(entraObjectId, countryId, minimumRole, userRoles) {
    // Admin bypasses UserPermissions entirely
    if (userRoles.includes("Admin"))
        return true;
    const permissions = await getUserCountryPermissions(entraObjectId);
    return permissions.some((p) => {
        const roleOk = ROLE_RANK[p.role] >= ROLE_RANK[minimumRole];
        const countryOk = p.countryId === null || p.countryId === countryId;
        return roleOk && countryOk;
    });
}
export async function getPermittedCountryIds(entraObjectId, userRoles) {
    if (userRoles.includes("Admin"))
        return "all";
    const pool = await getPool();
    // Country-level permissions
    const result = await pool
        .request()
        .input("EntraObjectId", sql.NVarChar(36), entraObjectId)
        .query(`
      SELECT DISTINCT c.Id
      FROM UserPermissions up
      LEFT JOIN Countries c ON c.RegionId = up.RegionId
      WHERE up.UserEntraObjectId = @EntraObjectId
        AND (up.CountryId IS NULL OR up.CountryId = c.Id)
    `);
    return result.recordset.map((r) => r.Id);
}

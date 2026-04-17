import { getPool, sql } from "../utils/db.js";
import { AuthenticatedUser } from "./auth.js";

export type Role = "Reader" | "Editor" | "Manager" | "Admin";

const ROLE_RANK: Record<Role, number> = {
  Reader: 1,
  Editor: 2,
  Manager: 3,
  Admin: 4,
};

export function hasRole(user: AuthenticatedUser, minimum: Role): boolean {
  // Admin always passes
  if (user.roles.includes("Admin")) return true;
  return user.roles.some(
    (r) => ROLE_RANK[r as Role] !== undefined && ROLE_RANK[r as Role] >= ROLE_RANK[minimum],
  );
}

export interface CountryPermission {
  regionId: number;
  countryId: number | null;
  role: Role;
}

export async function getUserCountryPermissions(
  entraObjectId: string,
): Promise<CountryPermission[]> {
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
    role: r.Role as Role,
  }));
}

export async function canAccessCountry(
  entraObjectId: string,
  countryId: number,
  minimumRole: Role,
  userRoles: string[],
): Promise<boolean> {
  // Admin bypasses UserPermissions entirely
  if (userRoles.includes("Admin")) return true;

  const permissions = await getUserCountryPermissions(entraObjectId);

  return permissions.some((p) => {
    const roleOk = ROLE_RANK[p.role] >= ROLE_RANK[minimumRole];
    const countryOk = p.countryId === null || p.countryId === countryId;
    return roleOk && countryOk;
  });
}

export async function getPermittedCountryIds(
  entraObjectId: string,
  userRoles: string[],
): Promise<number[] | "all"> {
  if (userRoles.includes("Admin")) return "all";

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

  return result.recordset.map((r) => r.Id as number);
}

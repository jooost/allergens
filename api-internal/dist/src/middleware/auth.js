import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { getPool, sql } from "../utils/db.js";
const jwks = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
});
function getSigningKey(header) {
    return new Promise((resolve, reject) => {
        jwks.getSigningKey(header.kid, (err, key) => {
            if (err)
                return reject(err);
            resolve(key.getPublicKey());
        });
    });
}
export async function authenticate(req) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        throw { status: 401, message: "Missing or invalid Authorization header" };
    }
    const token = authHeader.slice(7);
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string") {
        throw { status: 401, message: "Invalid token format" };
    }
    const signingKey = await getSigningKey(decoded.header);
    const payload = jwt.verify(token, signingKey, {
        audience: process.env.ENTRA_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    });
    const entraObjectId = payload.oid ?? payload.sub;
    const roles = payload.roles ?? [];
    // Upsert user profile
    const pool = await getPool();
    const result = await pool
        .request()
        .input("EntraObjectId", sql.NVarChar(36), entraObjectId)
        .input("DisplayName", sql.NVarChar(200), payload.name ?? "")
        .input("Email", sql.NVarChar(254), payload.preferred_username ?? payload.email ?? "")
        .query(`
      MERGE UserProfiles AS target
      USING (SELECT @EntraObjectId AS EntraObjectId) AS source
        ON target.EntraObjectId = source.EntraObjectId
      WHEN MATCHED THEN
        UPDATE SET DisplayName = @DisplayName, Email = @Email, LastLoginAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (EntraObjectId, DisplayName, Email, CreatedAt, LastLoginAt)
        VALUES (@EntraObjectId, @DisplayName, @Email, SYSUTCDATETIME(), SYSUTCDATETIME());

      SELECT PreferredLanguageId FROM UserProfiles WHERE EntraObjectId = @EntraObjectId;
    `);
    const preferredLanguageId = result.recordset[0]?.PreferredLanguageId ?? null;
    return {
        entraObjectId,
        displayName: payload.name ?? "",
        email: payload.preferred_username ?? payload.email ?? "",
        roles,
        preferredLanguageId,
    };
}

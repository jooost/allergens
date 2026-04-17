import { getPool, sql } from "./db.js";
export async function writeAuditLog(tableName, recordId, action, changedBy, oldValues, newValues) {
    const pool = await getPool();
    await pool
        .request()
        .input("TableName", sql.NVarChar(100), tableName)
        .input("RecordId", sql.Int, recordId)
        .input("Action", sql.NVarChar(20), action)
        .input("ChangedBy", sql.NVarChar(36), changedBy)
        .input("OldValues", sql.NVarChar(sql.MAX), oldValues ? JSON.stringify(oldValues) : null)
        .input("NewValues", sql.NVarChar(sql.MAX), newValues ? JSON.stringify(newValues) : null)
        .query(`
      INSERT INTO AuditLog (TableName, RecordId, Action, ChangedBy, OldValues, NewValues)
      VALUES (@TableName, @RecordId, @Action, @ChangedBy, @OldValues, @NewValues)
    `);
}

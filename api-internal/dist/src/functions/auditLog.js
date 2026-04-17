import { app } from "@azure/functions";
import { authenticate } from "../middleware/auth.js";
import { hasRole } from "../middleware/rbac.js";
import { getPool, sql } from "../utils/db.js";
// GET /internal/v1/audit
// Query params: tableName, recordId, action, changedBy, from, to, page, pageSize
async function queryAuditLog(req, ctx) {
    const user = await authenticate(req);
    if (!hasRole(user, "Manager"))
        return { status: 403, jsonBody: { error: "Forbidden" } };
    const tableName = req.query.get("tableName");
    const recordId = req.query.get("recordId");
    const action = req.query.get("action");
    const changedBy = req.query.get("changedBy");
    const from = req.query.get("from");
    const to = req.query.get("to");
    const page = Math.max(1, parseInt(req.query.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.get("pageSize") ?? "50")));
    const offset = (page - 1) * pageSize;
    const pool = await getPool();
    const request = pool.request();
    const conditions = [];
    if (tableName) {
        request.input("TableName", sql.NVarChar(100), tableName);
        conditions.push("TableName = @TableName");
    }
    if (recordId) {
        request.input("RecordId", sql.Int, parseInt(recordId));
        conditions.push("RecordId = @RecordId");
    }
    if (action) {
        request.input("Action", sql.NVarChar(20), action);
        conditions.push("Action = @Action");
    }
    if (changedBy) {
        request.input("ChangedBy", sql.NVarChar(36), changedBy);
        conditions.push("ChangedBy = @ChangedBy");
    }
    if (from) {
        request.input("From", sql.DateTime2, new Date(from));
        conditions.push("ChangedAt >= @From");
    }
    if (to) {
        request.input("To", sql.DateTime2, new Date(to));
        conditions.push("ChangedAt <= @To");
    }
    request.input("Offset", sql.Int, offset);
    request.input("PageSize", sql.Int, pageSize);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await pool
        .request()
        .query(`SELECT COUNT(*) AS Total FROM AuditLog ${where}`);
    // Re-use conditions in the data query (need separate request due to mssql input binding)
    const dataRequest = pool.request();
    if (tableName)
        dataRequest.input("TableName", sql.NVarChar(100), tableName);
    if (recordId)
        dataRequest.input("RecordId", sql.Int, parseInt(recordId));
    if (action)
        dataRequest.input("Action", sql.NVarChar(20), action);
    if (changedBy)
        dataRequest.input("ChangedBy", sql.NVarChar(36), changedBy);
    if (from)
        dataRequest.input("From", sql.DateTime2, new Date(from));
    if (to)
        dataRequest.input("To", sql.DateTime2, new Date(to));
    dataRequest.input("Offset", sql.Int, offset);
    dataRequest.input("PageSize", sql.Int, pageSize);
    const dataResult = await dataRequest.query(`
    SELECT Id, TableName, RecordId, Action, ChangedBy, ChangedAt, OldValues, NewValues
    FROM AuditLog
    ${where}
    ORDER BY ChangedAt DESC, Id DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
  `);
    const total = countResult.recordset[0].Total;
    return {
        jsonBody: {
            data: dataResult.recordset,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        },
    };
}
app.http("queryAuditLog", {
    route: "internal/v1/audit",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: queryAuditLog,
});

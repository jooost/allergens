import sql from "mssql";
let pool = null;
export async function getPool() {
    if (pool && pool.connected)
        return pool;
    pool = await sql.connect(process.env.SQLCONNSTR_Default);
    return pool;
}
export { sql };

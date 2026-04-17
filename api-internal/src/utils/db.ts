import sql from "mssql";

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;

  pool = await sql.connect(process.env.SQLCONNSTR_Default!);
  return pool;
}

export { sql };

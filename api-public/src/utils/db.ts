import mssql from "mssql";

let pool: mssql.ConnectionPool | null = null;

export { mssql as sql };

export async function getPool(): Promise<mssql.ConnectionPool> {
  if (pool) return pool;
  pool = await mssql.connect(process.env.SQLCONNSTR_Default!);
  return pool;
}

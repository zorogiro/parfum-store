import "dotenv/config";
import { Pool } from "pg";

/**
 * Direct SQL access for the WRITING e2e specs (setup and cleanup). It uses DATABASE_URL, so
 * run these specs only against the Neon dev branch. Nothing here runs unless the spec opted in
 * with E2E_ALLOW_DB_WRITES=1.
 */
export const writesAllowed = process.env.E2E_ALLOW_DB_WRITES === "1";

let pool: Pool | null = null;
export function sql() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

export const FAKE_NAME = "TEST E2E Client";

/** Orders created by the specs are recognised by this name and deleted afterwards. */
export async function deleteTestOrders() {
  const db = sql();
  await db.query(
    `DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "customerName" = $1)`,
    [FAKE_NAME],
  );
  await db.query(`DELETE FROM "Order" WHERE "customerName" = $1`, [FAKE_NAME]);
}

export async function countTestOrdersByPhone(phone: string): Promise<number> {
  const { rows } = await sql().query(
    `SELECT count(*)::int AS n FROM "Order" WHERE "customerName" = $1 AND phone = $2`,
    [FAKE_NAME, phone],
  );
  return rows[0].n;
}

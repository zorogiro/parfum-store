import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

/**
 * Tests the order_status_history backfill (the INSERT ... SELECT at the end of migration
 * 20261017000000_order_status_history) on synthetic data, WITHOUT touching real rows:
 * inside one transaction it creates TEMP tables named "Order" and "OrderStatusHistory" (they
 * shadow the real ones for this session), inserts orders in every status, runs the exact SQL
 * taken from the migration file, asserts the result, and rolls back.
 * Needs a database connection, so it is skipped unless E2E_ALLOW_DB_WRITES=1 (dev branch only).
 */
const enabled = process.env.E2E_ALLOW_DB_WRITES === "1";

const migration = readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20261017000000_order_status_history/migration.sql",
  ),
  "utf8",
);
/** The backfill statement: everything from the "-- Backfill" comment to the end of the file. */
const backfillSql = migration.slice(migration.indexOf("-- Backfill"));

const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;

describe.skipIf(!enabled)("order status history backfill (rolled-back transaction)", () => {
  it("creates exactly one history row per existing order, with its status and timestamp", async () => {
    expect(backfillSql).toContain('INSERT INTO "OrderStatusHistory"');

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      // Temp tables shadow public."Order" / public."OrderStatusHistory" for this session only.
      await client.query(`CREATE TEMP TABLE "Order" (LIKE public."Order" INCLUDING ALL)`);
      await client.query(
        `CREATE TEMP TABLE "OrderStatusHistory" (LIKE public."OrderStatusHistory" INCLUDING ALL)`,
      );

      const expected = new Map<string, { status: string; updatedAt: Date }>();
      let i = 0;
      for (const status of STATUSES) {
        for (const age of [0, 1]) {
          // age 1 = an order that was changed later than it was created (updatedAt > createdAt)
          i += 1;
          const createdAt = new Date(Date.UTC(2026, 0, i, 10, 0, 0));
          const updatedAt = age ? new Date(Date.UTC(2026, 2, i, 15, 30, 0)) : createdAt;
          const id = `synthetic-${i}`;
          await client.query(
            `INSERT INTO "Order" (id, number, "trackingToken", status, "customerName", phone,
               governorate, city, address, subtotal, "shippingFee", total, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4::"OrderStatus", 'Synthetic', '+21620000000', 'Tunis', 'Tunis',
               'x', 1000, 0, 1000, $5, $6)`,
            [id, `ORD-S${i}`, `token-${i}-${"x".repeat(32)}`, status, createdAt, updatedAt],
          );
          expected.set(id, { status, updatedAt });
        }
      }

      // The exact SQL from the migration.
      await client.query(backfillSql);

      const { rows } = await client.query(
        `SELECT id, "orderId", "fromStatus", "toStatus", "changedAt", "changedBy", note
         FROM "OrderStatusHistory" ORDER BY "orderId"`,
      );

      expect(rows).toHaveLength(expected.size); // one row per order, no more, no less
      expect(new Set(rows.map((r) => r.orderId))).toEqual(new Set(expected.keys()));
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length); // unique ids
      for (const row of rows) {
        const order = expected.get(row.orderId)!;
        expect(row.toStatus).toBe(order.status);
        expect(row.fromStatus).toBeNull();
        expect(new Date(row.changedAt).getTime()).toBe(order.updatedAt.getTime());
        expect(row.changedBy).toBe("system");
        expect(row.note).toBeNull();
        expect(row.id).toMatch(/^bf[0-9a-f]{32}$/);
      }
      // Every one of the six statuses is represented.
      expect(new Set(rows.map((r) => r.toStatus))).toEqual(new Set(STATUSES));
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }

    // Nothing leaked: the real tables hold no synthetic data.
    const check = new Client({ connectionString: process.env.DATABASE_URL });
    await check.connect();
    try {
      const { rows } = await check.query(
        `SELECT count(*)::int AS n FROM "Order" WHERE id LIKE 'synthetic-%'`,
      );
      expect(rows[0].n).toBe(0);
    } finally {
      await check.end();
    }
  }, 60_000);
});

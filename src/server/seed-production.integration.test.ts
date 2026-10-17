import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { GOVERNORATES } from "../../prisma/seed-data";
import { seedProduction } from "../../prisma/seed-production-core";

/**
 * Runs the PRODUCTION seed several times against a throwaway Postgres schema (migrations applied
 * inside it) in the database of DIRECT_URL / DATABASE_URL (use the Neon dev branch), then drops
 * the schema. It never touches the `public` schema. Skipped unless E2E_ALLOW_DB_WRITES=1.
 *   $env:E2E_ALLOW_DB_WRITES = "1"; npx vitest run src/server/seed-production.integration.test.ts
 */
const enabled = process.env.E2E_ALLOW_DB_WRITES === "1";
const baseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const schema = `seedtest_${randomBytes(4).toString("hex")}`;

function urlWithSchema() {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

describe.skipIf(!enabled)("production seed (scratch schema)", () => {
  let prisma: PrismaClient;
  const config = {
    email: "owner@example.com",
    password: "first-strong-password",
    resetAdminPassword: false,
  };

  beforeAll(async () => {
    const client = new Client({ connectionString: baseUrl });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.end();
    const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DIRECT_URL: urlWithSchema(), DATABASE_URL: urlWithSchema() },
      shell: true,
      encoding: "utf8",
    });
    if (migrate.status !== 0) throw new Error("migrate deploy into the scratch schema failed");
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: baseUrl }, { schema }),
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    const client = new Client({ connectionString: baseUrl });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }, 60_000);

  const counts = async () => ({
    zones: await prisma.shippingZone.count(),
    settings: await prisma.setting.count(),
    roots: await prisma.category.count({ where: { parentId: null } }),
    subs: await prisma.category.count({ where: { parentId: { not: null } } }),
    admins: await prisma.adminUser.count(),
    products: await prisma.product.count(),
    images: await prisma.productImage.count(),
    variants: await prisma.variant.count(),
    orders: await prisma.order.count(),
  });

  it("creates exactly the reference data, with no products", async () => {
    const summary = await seedProduction(prisma, config);
    expect(summary).toMatchObject({
      shippingZonesCreated: 24,
      categoriesCreated: 9,
      admin: "created",
    });
    expect([...summary.settingsCreated].sort()).toEqual([
      "freeShippingThreshold",
      "notificationEmail",
      "storePhone",
    ]);
    expect(await counts()).toEqual({
      zones: 24,
      settings: 3,
      roots: 3,
      subs: 6,
      admins: 1,
      products: 0,
      images: 0,
      variants: 0,
      orders: 0,
    });
    const zones = await prisma.shippingZone.findMany({ select: { fee: true, governorate: true } });
    expect(new Set(zones.map((z) => z.fee))).toEqual(new Set([8000]));
    expect(zones.map((z) => z.governorate).sort()).toEqual([...GOVERNORATES].sort());
  });

  it("is idempotent and keeps existing data and the admin password", async () => {
    await prisma.shippingZone.update({ where: { governorate: "Tunis" }, data: { fee: 5000 } });
    await prisma.setting.update({ where: { key: "storePhone" }, data: { value: "+21620123456" } });
    const before = await counts();
    const hashBefore = (await prisma.adminUser.findFirstOrThrow()).passwordHash;

    const summary = await seedProduction(prisma, { ...config, password: "a-different-password" });

    expect(summary).toEqual({
      shippingZonesCreated: 0,
      settingsCreated: [],
      categoriesCreated: 0,
      admin: "kept",
    });
    expect(await counts()).toEqual(before);
    const tunis = await prisma.shippingZone.findUniqueOrThrow({ where: { governorate: "Tunis" } });
    expect(tunis.fee).toBe(5000);
    const phone = await prisma.setting.findUniqueOrThrow({ where: { key: "storePhone" } });
    expect(phone.value).toBe("+21620123456");
    expect((await prisma.adminUser.findFirstOrThrow()).passwordHash).toBe(hashBefore);
    expect(await bcrypt.compare("first-strong-password", hashBefore)).toBe(true);
  });

  it("fills only what is missing", async () => {
    await prisma.shippingZone.delete({ where: { governorate: "Sfax" } });
    await prisma.setting.delete({ where: { key: "notificationEmail" } });
    const summary = await seedProduction(prisma, config);
    expect(summary.shippingZonesCreated).toBe(1);
    expect(summary.settingsCreated).toEqual(["notificationEmail"]);
    expect((await counts()).zones).toBe(24);
  });

  it("resets the admin password only with the flag", async () => {
    const summary = await seedProduction(prisma, {
      ...config,
      password: "second-strong-password",
      resetAdminPassword: true,
    });
    expect(summary.admin).toBe("password-reset");
    const admin = await prisma.adminUser.findFirstOrThrow();
    expect(await bcrypt.compare("second-strong-password", admin.passwordHash)).toBe(true);
    expect((await counts()).admins).toBe(1);
  });

  it("matches the admin email case-insensitively", async () => {
    const summary = await seedProduction(prisma, { ...config, email: "OWNER@example.com" });
    expect(summary.admin).toBe("kept");
    expect((await counts()).admins).toBe(1);
  });
});

import bcrypt from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { CATEGORIES, DEFAULT_FEE, GOVERNORATES } from "./seed-data";

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** Placeholder values, only written when the key does not exist yet. The admin sets the real ones. */
export const PLACEHOLDER_SETTINGS = {
  /** "0" = free shipping disabled. */
  freeShippingThreshold: "0",
  storePhone: "+21600000000",
  notificationEmail: "orders@example.com",
} as const;

export type SeedEnv = Record<string, string | undefined>;

export type SeedConfig = {
  email: string;
  password: string;
  resetAdminPassword: boolean;
};

/** Host and database name of a connection string, never the user, password or query. */
export function describeDatabase(connectionString: string | undefined): string {
  if (!connectionString) return "(no connection string)";
  try {
    const url = new URL(connectionString);
    return `${url.host}${url.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
}

/**
 * Validates the environment BEFORE any connection is opened. Throws a message that never contains
 * the password or the connection string.
 */
export function readSeedConfig(env: SeedEnv): SeedConfig {
  if (env.CONFIRM_PRODUCTION_SEED !== "yes") {
    throw new Error(
      "Refusing to run: set CONFIRM_PRODUCTION_SEED=yes to confirm you want to seed the database printed above.",
    );
  }
  if (!env.DIRECT_URL && !env.DATABASE_URL) {
    throw new Error("DIRECT_URL (or DATABASE_URL) must be set in the shell for this command.");
  }
  const email = env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be set to a valid email address.");
  }
  const password = env.ADMIN_PASSWORD ?? "";
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  }
  return { email, password, resetAdminPassword: env.RESET_ADMIN_PASSWORD === "1" };
}

export type SeedSummary = {
  shippingZonesCreated: number;
  settingsCreated: string[];
  categoriesCreated: number;
  admin: "created" | "kept" | "password-reset";
};

/** Idempotent: creates what is missing and never modifies existing rows (except the opt-in reset). */
export async function seedProduction(
  prisma: PrismaClient,
  config: SeedConfig,
): Promise<SeedSummary> {
  // Hash first (slow) so a failure leaves nothing half written.
  const passwordHash = await bcrypt.hash(config.password, 12);

  const zones = await prisma.shippingZone.createMany({
    data: GOVERNORATES.map((governorate) => ({ governorate, fee: DEFAULT_FEE })),
    skipDuplicates: true,
  });

  const settingsCreated: string[] = [];
  for (const [key, value] of Object.entries(PLACEHOLDER_SETTINGS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.setting.create({ data: { key, value } });
    settingsCreated.push(key);
  }

  let categoriesCreated = 0;
  let position = 0;
  for (const { children, ...root } of CATEGORIES) {
    const rootPosition = position++;
    let parent = await prisma.category.findUnique({ where: { slug: root.slug } });
    if (!parent) {
      parent = await prisma.category.create({ data: { ...root, position: rootPosition } });
      categoriesCreated++;
    }
    let childPosition = 0;
    for (const child of children) {
      const pos = childPosition++;
      const existing = await prisma.category.findUnique({ where: { slug: child.slug } });
      if (existing) continue;
      await prisma.category.create({ data: { ...child, parentId: parent.id, position: pos } });
      categoriesCreated++;
    }
  }

  const admin = await prisma.adminUser.findFirst({
    where: { email: { equals: config.email, mode: "insensitive" } },
  });
  let adminResult: SeedSummary["admin"];
  if (!admin) {
    await prisma.adminUser.create({ data: { email: config.email, passwordHash } });
    adminResult = "created";
  } else if (config.resetAdminPassword) {
    await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });
    adminResult = "password-reset";
  } else {
    adminResult = "kept";
  }

  return {
    shippingZonesCreated: zones.count,
    settingsCreated,
    categoriesCreated,
    admin: adminResult,
  };
}

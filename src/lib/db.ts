import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Serverless: each warm function instance keeps ONE client (module singleton, also across hot
 * reloads in dev) with a small pool, and DATABASE_URL points at Neon's pooler (PgBouncer), so
 * many concurrent instances do not exhaust Postgres connections.
 */
const POOL_MAX = 5;

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: POOL_MAX });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

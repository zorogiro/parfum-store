/**
 * Prints WHICH database the Prisma CLI and the seed scripts will use (host and database name only,
 * never credentials). Run it before `prisma migrate deploy` or `db:seed:prod`.
 * Mirrors prisma.config.ts: shell variables win over .env, DIRECT_URL wins over DATABASE_URL.
 */
import "dotenv/config";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.log("No DIRECT_URL / DATABASE_URL set.");
} else {
  try {
    const parsed = new URL(url);
    console.log(`Prisma CLI target: ${parsed.host}${parsed.pathname}`);
    console.log(`Source: ${process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL"}`);
    if (parsed.host.includes("-pooler")) {
      console.log("WARNING: this is a POOLED host; migrations need the DIRECT (non-pooler) host.");
    }
  } catch {
    console.log("The connection string is not a valid URL.");
  }
}

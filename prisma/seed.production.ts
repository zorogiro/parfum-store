/**
 * PRODUCTION seed: only the reference data a new store needs (24 shipping zones, placeholder
 * settings, the category tree, the admin user). No products, no images, no test data.
 *
 * Deliberately does NOT load .env: every value must be set in the shell for this one command,
 * so a development connection string left in .env can never be picked up by accident.
 * See docs/DEPLOY.md, step 3.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { describeDatabase, readSeedConfig, seedProduction } from "./seed-production-core";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  console.log(`Target database: ${describeDatabase(connectionString)}`);

  const config = readSeedConfig(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const summary = await seedProduction(prisma, config);
    console.log(`Shipping zones created: ${summary.shippingZonesCreated}`);
    console.log(`Settings created: ${summary.settingsCreated.join(", ") || "none"}`);
    console.log(`Categories created: ${summary.categoriesCreated}`);
    console.log(`Admin user: ${summary.admin}`);
    if (summary.settingsCreated.length > 0) {
      console.log(
        "Now set the real phone, notification email, shipping fees and free-shipping threshold in /admin/settings and /admin/shipping.",
      );
    }
    console.log("Production seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Only the message of OUR guards is printed; never the error object of a failed connection.
  const known = error instanceof Error && /^(Refusing|ADMIN_|DIRECT_URL)/.test(error.message);
  console.error(known ? error.message : `Production seed failed (${error?.name ?? "unknown"}).`);
  process.exit(1);
});

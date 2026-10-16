import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma 7 no longer reads url/directUrl from schema.prisma. The CLI
    // (migrate, db push) needs a direct connection, so prefer DIRECT_URL;
    // the app itself uses the pooled DATABASE_URL via the pg adapter (src/lib/db.ts).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

async function main() {
  const [zones, settings, roots, subs, products, variants, images, admins] = await Promise.all([
    prisma.shippingZone.count(),
    prisma.setting.count(),
    prisma.category.count({ where: { parentId: null } }),
    prisma.category.count({ where: { parentId: { not: null } } }),
    prisma.product.count(),
    prisma.variant.count(),
    prisma.productImage.count(),
    prisma.adminUser.count(),
  ]);
  console.log({
    zones,
    settings,
    roots,
    subs,
    products,
    variants,
    images,
    admins,
  });
}

main().finally(() => prisma.$disconnect());

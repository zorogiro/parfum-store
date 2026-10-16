import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductType } from "../src/generated/prisma/client";
import { CATEGORIES, DEFAULT_FEE, GOVERNORATES } from "./seed-data";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type SeedVariant = {
  sku: string;
  label: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  options: Record<string, string | number>;
};
type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  brand?: string;
  category: string;
  type: ProductType;
  variants: SeedVariant[];
};

const SIZES = ["S", "M", "L", "XL"];
const sizedVariants = (
  skuBase: string,
  color: string,
  price: number,
  compareAtPrice?: number,
): SeedVariant[] =>
  SIZES.map((size) => ({
    sku: `${skuBase}-${size}`,
    label: `${size} / ${color}`,
    price,
    compareAtPrice,
    stock: 10,
    options: { size, color },
  }));

const PRODUCTS: SeedProduct[] = [
  {
    name: "Nuit d'Oud",
    slug: "nuit-d-oud",
    description: "Un parfum boisé et profond aux notes d'oud et d'ambre.",
    brand: "Maison Atlas",
    category: "parfums-homme",
    type: "PERFUME",
    variants: [
      {
        sku: "NOUD-50",
        label: "50 ml",
        price: 120000,
        stock: 15,
        options: { volumeMl: 50 },
      },
      {
        sku: "NOUD-100",
        label: "100 ml",
        price: 190000,
        compareAtPrice: 220000,
        stock: 10,
        options: { volumeMl: 100 },
      },
    ],
  },
  {
    name: "Rose de Carthage",
    slug: "rose-de-carthage",
    description: "Une eau de parfum florale à la rose et au musc blanc.",
    brand: "Maison Atlas",
    category: "parfums-femme",
    type: "PERFUME",
    variants: [
      {
        sku: "RCAR-50",
        label: "50 ml",
        price: 110000,
        stock: 12,
        options: { volumeMl: 50 },
      },
      {
        sku: "RCAR-100",
        label: "100 ml",
        price: 175000,
        stock: 8,
        options: { volumeMl: 100 },
      },
    ],
  },
  {
    name: "T-shirt Coton Premium",
    slug: "t-shirt-coton-premium",
    description: "T-shirt en coton épais, coupe droite, toucher doux.",
    category: "vetements-homme",
    type: "CLOTHING",
    variants: [
      ...sizedVariants("TSH-NOIR", "Noir", 35000),
      ...sizedVariants("TSH-BLANC", "Blanc", 35000),
    ],
  },
  {
    name: "Robe d'Été Fluide",
    slug: "robe-d-ete-fluide",
    description: "Robe légère et fluide, idéale pour les journées chaudes.",
    category: "vetements-femme",
    type: "CLOTHING",
    variants: [
      ...sizedVariants("ROBE-BLEU", "Bleu", 89000, 110000),
      ...sizedVariants("ROBE-BEIGE", "Beige", 89000, 110000),
    ],
  },
  {
    name: "Sac Bandoulière Cuir",
    slug: "sac-bandouliere-cuir",
    description: "Sac bandoulière en cuir véritable, finitions soignées.",
    category: "sacs",
    type: "ACCESSORY",
    variants: [
      {
        sku: "SAC-CUIR",
        label: "Unique",
        price: 145000,
        stock: 6,
        options: { color: "Marron" },
      },
    ],
  },
  {
    name: "Montre Classique Acier",
    slug: "montre-classique-acier",
    description: "Montre à quartz, boîtier et bracelet en acier inoxydable.",
    category: "montres",
    type: "ACCESSORY",
    variants: [
      {
        sku: "MONTRE-ACIER",
        label: "Unique",
        price: 210000,
        stock: 5,
        options: { color: "Argent" },
      },
    ],
  },
];

async function seedShipping() {
  for (const governorate of GOVERNORATES) {
    await prisma.shippingZone.upsert({
      where: { governorate },
      update: {},
      create: { governorate, fee: DEFAULT_FEE },
    });
  }
}

async function seedSettings() {
  const settings = {
    freeShippingThreshold: "200000",
    storePhone: "+21600000000",
    notificationEmail: "orders@example.com",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
}

async function seedCategories() {
  let position = 0;
  for (const { children, ...root } of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: root.slug },
      update: {},
      create: { ...root, position: position++ },
    });
    let childPosition = 0;
    for (const child of children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {},
        create: { ...child, parentId: parent.id, position: childPosition++ },
      });
    }
  }
}

async function seedProducts() {
  for (const { category, variants, ...product } of PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });
    if (existing) continue;
    const cat = await prisma.category.findUniqueOrThrow({
      where: { slug: category },
    });
    await prisma.product.create({
      data: {
        ...product,
        categoryId: cat.id,
        images: {
          create: [0, 1].map((position) => ({
            url: `https://placehold.co/800x800/png?text=${encodeURIComponent(product.name)}+${position + 1}`,
            publicId: `placeholder/${product.slug}-${position + 1}`,
            position,
          })),
        },
        variants: { create: variants },
      },
    });
  }
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
}

async function main() {
  await seedShipping();
  await seedSettings();
  await seedCategories();
  await seedProducts();
  await seedAdmin();
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

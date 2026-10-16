# Parfum Store

Tunisian e-commerce store selling perfumes, clothes and accessories. Guest checkout, cash on delivery only.

**The full plan is in `docs/mvp-plan.md`. Read it before starting any task** (it holds the data model, scope and the ordered task list).
Also read `AGENTS.md`: this Next.js version differs from older ones; check `node_modules/next/dist/docs/` before using framework APIs.

## Stack

Next.js (App Router, TypeScript, `src/`), Tailwind CSS v4, shadcn/ui, Prisma 7 + PostgreSQL (`@prisma/adapter-pg`), Zod, Auth.js (admin only, later), Cloudinary (images), Resend (email), Vitest (+ Playwright later), ESLint + Prettier.

## Conventions

- **Prices are integers in millimes** (1 TND = 1000 millimes). Never use floats for money. Format with `formatTND()` from `src/lib/money.ts` (e.g. `45,500 TND`).
- **Validate every server action with Zod** (schemas in `src/lib/validators`), and never trust prices or totals from the client. Admin actions and route handlers must call `requireAdmin()`.
- **No card data**, ever. **Cash on delivery only** in the MVP. No customer accounts.
- **French UI.** All user-facing text goes through `src/lib/strings.ts` (no hardcoded UI strings) so Arabic can be added later.
- **Admin auth** (Auth.js v5, JWT, credentials): `src/server/auth.ts` (`requireAdmin()`: call it first in every admin server action and route handler; the proxy is not enough), `src/server/auth.config.ts` (edge-safe config), `src/proxy.ts` (Next 16 name for middleware; guards `/admin/*`). Login attempts are limited via `src/lib/rate-limit.ts` (in-memory, per instance only; swap for DB/Redis). The app refuses to start without `AUTH_SECRET`. All `/admin` pages are `noindex`; never add them to a sitemap. Admin panel pages live in `src/app/admin/(panel)/`; the login page is outside it.
- **Admin catalog** (`/admin/categories`, `/admin/products`): server actions in `src/server/categories.ts` and `src/server/products.ts` return `ActionResult` (`src/lib/action-result.ts`) instead of throwing; Zod schemas in `src/lib/validators/{category,product}.ts`. Admins type prices in TND; `parseTND()` / `toTNDInputValue()` in `src/lib/money.ts` convert to/from millimes. Slugs: `slugify()` / `uniqueSlug()` in `src/lib/slug.ts`. Variant `options` JSON is normalized per product type (PERFUME: volumeMl; CLOTHING: size + color; ACCESSORY: color). Categories are max 2 levels; deleting a category with products/subcategories is blocked; deleting a product that appears in orders soft-disables it (`isActive=false`). Image upload (Cloudinary) is not built yet (the cover column is a placeholder).
- **Product images** (Cloudinary): browser uploads directly with a signature from `getUploadSignature()` (`src/server/images.ts`, `requireAdmin()`); the API secret stays in `src/server/cloudinary.ts` (server-only). Images are saved with the product form (ordered list, first = cover); `publicId` must be `store/products/<id>` and the URL must be our cloud (`src/lib/cloudinary-validation.ts`). Files are deleted from Cloudinary best-effort (logged on failure) when removed on save or when the product is deleted.
- **Storefront** (`src/app/(shop)/`: `/`, `/c/[slug]`, `/search`, legal pages `/conditions-generales` `/confidentialite` `/retours`): only `isActive` products. URL params are parsed/whitelisted in `src/lib/catalog-query.ts` (`parseListingParams`, `buildFilterWhere`, `buildSearchWhere`, `buildListingHref`; params: `sort`, `page`, `min`/`max` in TND, `stock=1`, `brand`, `volume`, `size`, `color`; `q` for search). Cached queries (`"use cache"` + tag `catalog`/`settings`) live in `src/server/storefront.ts`; admin actions call `revalidateCatalog()` (does `updateTag("catalog")`), and the order flow must too when stock changes. Search is uncached and escapes LIKE wildcards. Price sorts sort in memory by lowest variant price. `ProductCard` data comes from `toProductCardData()` (`src/lib/product-card-data.ts`). Cart header icon: `CartButton` + placeholder hook `useCartItemCount()` (`src/components/shop/`). Legal page copy is in `legalPages` in `strings.ts`; `format()` (utils) fills `{placeholders}`. Set `NEXT_PUBLIC_SITE_URL` for canonical/OG URLs.
- **Product page** (`/p/[slug]`): `getProductBySlug` / `getRelatedProducts` in `src/server/storefront.ts` (cached, tag `catalog`). Pure logic in `src/lib/product-variants.ts` (variant model/selection, stock label, discount %, qty cap) and `src/lib/product-jsonld.ts` (JSON-LD, meta description). UI: `product-gallery` (lightbox, swipe), `product-purchase` (selectors, qty, sticky mobile bar). The page only talks to the cart through `useCartActions().addItem(variantId, quantity)` in `src/components/shop/use-cart-actions.ts` (placeholder toast until Task 6 replaces its body). **Real 404s**: with Cache Components an unseen slug gets the prerendered shell (HTTP 200) before `notFound()` can run, so `src/proxy.ts` checks `/p/:slug` and `/c/:slug` via `catalogSlugExists()` (`src/server/catalog-slugs.ts`) and rewrites misses to the prerendered `/introuvable` (404). Do NOT add `loading.tsx` to `/p/[slug]` or `/c/[slug]` (it would start streaming before `notFound()`). Order flow must call `revalidateCatalog()` when stock changes.
- Prisma client is generated to `src/generated/prisma`; import the shared instance from `@/lib/db`.
- Prisma 7: connection URLs live in `prisma.config.ts` (CLI uses `DIRECT_URL`); the app uses the pooled `DATABASE_URL` via the pg adapter. Order numbers come from `nextOrderNumber(tx)` in `src/server/order-number.ts` (Postgres sequence `order_number_seq`); call it inside the order-creating transaction.
- Commit after each task; keep this file up to date.

## Layout

- `src/app` routes (App Router)
- `src/components` React components (`ui/` = shadcn)
- `src/lib` db, utils, money, strings, `validators/`
- `src/server` server actions and services
- `prisma/` schema, migrations, seed
- `docs/` plan and deployment docs

## Commands

- `npm run dev` dev server
- `npm run build` production build
- `npm run lint` ESLint
- `npm run typecheck` TypeScript check
- `npm test` Vitest (unit)
- `npm run format` Prettier
- `npm run db:migrate` Prisma migrate dev
- `npm run db:seed` run `prisma/seed.ts` (needs `ADMIN_EMAIL` / `ADMIN_PASSWORD`; idempotent)
- `npx tsx scripts/verify-db.ts` print row counts of the seeded tables

Copy `.env.example` to `.env` and fill it in. `.env` is gitignored.

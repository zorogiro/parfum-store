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

# Parfum Store

[![CI](https://github.com/zorogiro/parfum-store/actions/workflows/ci.yml/badge.svg)](https://github.com/zorogiro/parfum-store/actions/workflows/ci.yml)

Tunisian e-commerce store selling perfumes, clothes and accessories. Guest checkout, **cash on delivery only**, French UI, prices in TND (stored as integer millimes), admin panel for the catalog, orders, shipping fees and settings.

## Stack

Next.js 16 (App Router, Cache Components, TypeScript, `src/`), Tailwind CSS v4 + shadcn/ui, Prisma 7 + PostgreSQL (Neon, `@prisma/adapter-pg`), Zod, Auth.js v5 (admin only), Cloudinary (images), Resend (email), Sentry (optional), Vitest + Playwright, ESLint + Prettier. Hosting: Vercel + Neon.

## Local setup

Requirements: Node 24 (see `.nvmrc`), a PostgreSQL database (a free Neon **dev** branch is fine).

```bash
git clone https://github.com/zorogiro/parfum-store.git
cd parfum-store
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill it in (every variable is documented in the file)
npm run db:migrate          # apply migrations to the DEV database
npm run db:seed             # dev seed: zones, settings, categories, 6 sample products, admin user
npm run dev                 # http://localhost:3000, admin at /admin
```

`.env` is gitignored. **Never put production connection strings in it** (see [docs/DEPLOY.md](docs/DEPLOY.md)). Generate `AUTH_SECRET` with `npx auth secret`. `ADMIN_EMAIL` / `ADMIN_PASSWORD` are only read by the seed scripts.

## Scripts

| Command                   | What it does                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`             | Dev server                                                                            |
| `npm run build` / `start` | Production build / server (the build queries the database to prerender catalog pages) |
| `npm run lint`            | ESLint                                                                                |
| `npm run typecheck`       | TypeScript                                                                            |
| `npm run format`          | Prettier (write); CI runs `npx prettier --check .`                                    |
| `npm test`                | Vitest unit tests (no database needed)                                                |
| `npm run test:e2e`        | Playwright against a production build served on port 3100 (run `npm run build` first) |
| `npm run db:migrate`      | `prisma migrate dev` (development only)                                               |
| `npm run db:seed`         | Dev seed, includes sample products                                                    |
| `npm run db:seed:prod`    | **Production** seed: reference data + admin only, guarded (see DEPLOY.md)             |
| `npm run db:host`         | Prints which database the Prisma CLI / seeds would use (host only, no credentials)    |

## Tests

- `npm test`: unit tests, no database. The `*.integration.test.ts` files skip themselves unless `E2E_ALLOW_DB_WRITES=1`.
- DB-writing tests (`src/server/*.integration.test.ts`, `e2e/*.write.spec.ts`) need `E2E_ALLOW_DB_WRITES=1` **and `DATABASE_URL` on the Neon dev branch**. They create and clean up their own data.
- Read-only Playwright specs: cart, security headers/CSP, accessibility (axe), keyboard, admin auth. `admin-a11y` and the admin write spec log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the environment.
- CI (`.github/workflows/ci.yml`) runs lint, type-check, Prettier, unit tests, `npm audit --omit=dev --audit-level=high` and a build against a throwaway Postgres container. It never runs DB-writing tests.

## Folder structure

```
src/app/            routes: (shop)/ storefront, admin/ (panel)/, api/, sitemap, robots
src/components/     ui/ (shadcn), shop/, admin/, shared/
src/lib/            pure logic: money, pricing, validators/, strings (French UI), catalog query...
src/server/         server actions, queries, auth, email, rate limiters (Postgres-backed)
src/proxy.ts        Next 16 "middleware": admin guard, real 404s, order-link check
prisma/             schema, migrations, seed.ts (dev), seed.production.ts (prod), seed-data.ts
e2e/                Playwright specs
scripts/            small CLI helpers (db:host, verify-db)
docs/               mvp-plan.md, DEPLOY.md
```

More detail on conventions and security rules is in [CLAUDE.md](CLAUDE.md) and [docs/mvp-plan.md](docs/mvp-plan.md).

## Deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)**: Neon, migrations, production seed, Cloudinary, Resend, Vercel, first-deploy verification, backups, operations.

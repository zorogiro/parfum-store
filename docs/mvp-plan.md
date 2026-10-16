# E-commerce MVP Plan (Perfumes, Clothes, Accessories, Tunisia, Cash on Delivery)

## 1. Final stack (adjusted to your answers)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Single codebase, good SEO |
| UI | Tailwind CSS + shadcn/ui | |
| DB | PostgreSQL (Neon or Supabase) | |
| ORM | Prisma | |
| Validation | Zod | Shared by forms and server actions |
| Admin auth | Auth.js (credentials) | Admin only, no customer accounts in the MVP |
| Images | Cloudinary | Upload and resize product photos |
| Email | Resend | Order notifications to you (customer email optional) |
| Hosting | Vercel + Neon | |
| Tests | Vitest + Playwright | Cart/pricing logic + checkout E2E |
| Errors | Sentry | |

### Tunisia-specific decisions
- **Payment:** cash on delivery only. No payment gateway in the MVP (add Konnect/Flouci later if wanted).
- **Guest checkout only.** Name, phone (+216, 8 digits), governorate, city, address. No customer accounts yet.
- **Prices:** stored as integers in millimes (1 TND = 1000 millimes) to avoid float errors. Displayed as TND with 3 decimals.
- **Shipping:** flat fee per governorate (configurable in admin), optional free-shipping threshold. Delivery carrier handled manually at first.
- **Order tracking:** customer enters order number + phone.
- **Language:** French UI first, with strings kept in one place so Arabic can be added later.
- **Confirmation:** orders start as `PENDING`; you confirm by phone or WhatsApp, then change status.

### MVP scope
In: catalog, variants, cart, COD checkout, admin (products, categories, orders, shipping fees), order notification email, deploy.
Out (later): customer accounts, online payment, reviews, wishlist, discount codes, search engine, blog.

## 2. Data model (reference for Task 1)

- **Category**: id, name, slug, parentId?, image?, position
- **Product**: id, name, slug, description, brand?, categoryId, type (PERFUME | CLOTHING | ACCESSORY), isActive, createdAt
- **ProductImage**: id, productId, url, publicId, position
- **Variant**: id, productId, sku, label, price (millimes), compareAtPrice?, stock, options (JSON: size, color, volumeMl)
- **ShippingZone**: id, governorate (unique), fee (millimes)
- **Setting**: key, value (e.g. freeShippingThreshold, storePhone, notificationEmail)
- **Order**: id, number (e.g. ORD-000123), status (PENDING | CONFIRMED | SHIPPED | DELIVERED | CANCELLED | RETURNED), customerName, phone, email?, governorate, city, address, notes?, subtotal, shippingFee, total, createdAt
- **OrderItem**: id, orderId, variantId, productName, variantLabel, unitPrice, quantity (snapshots, so later edits don't change old orders)
- **AdminUser**: id, email, passwordHash

## 3. Tasks and Claude Code prompts

Run them in order. Commit after each task. Start each prompt in a fresh Claude Code session at the repo root. Create a `CLAUDE.md` in Task 0 so later sessions keep context.

---

### Task 0: Project setup

```
Set up a new Next.js (App Router, TypeScript, src/ directory) project for a Tunisian e-commerce store selling perfumes, clothes and accessories.

Do:
- Install and configure Tailwind CSS, shadcn/ui, Prisma (PostgreSQL), Zod, Vitest, ESLint + Prettier.
- Folder structure: src/app (routes), src/components, src/lib (db, utils, validators), src/server (actions/services), prisma/.
- Add .env.example with DATABASE_URL, AUTH_SECRET, CLOUDINARY_*, RESEND_API_KEY.
- Add a src/lib/money.ts helper: prices are integers in millimes; formatTND(millimes) outputs e.g. "45,500 TND" (3 decimals, French locale).
- Add a minimal i18n-ready strings file (French) so UI text is not hardcoded everywhere.
- Create CLAUDE.md at the root describing: stack, conventions (prices in millimes, Zod validation on every server action, no card data, COD only, French UI), folder layout, and the commands to run/test.
- Add npm scripts: dev, build, lint, test, db:migrate, db:seed.

Do not build any features yet. Finish by running lint and build to confirm everything works.
```

---

### Task 1: Database schema and seed

```
Using Prisma, create the database schema for the store described in CLAUDE.md.

Models: Category (self-referencing parent), Product (type enum PERFUME | CLOTHING | ACCESSORY), ProductImage, Variant (price in millimes as Int, stock Int, options Json), ShippingZone, Setting, Order (status enum PENDING | CONFIRMED | SHIPPED | DELIVERED | CANCELLED | RETURNED), OrderItem (snapshot fields: productName, variantLabel, unitPrice), AdminUser.

Requirements:
- Unique slugs for Category and Product, unique SKU for Variant, unique order number.
- Indexes on Product.categoryId, Product.isActive, Order.status, Order.createdAt, Order.phone.
- Order number generator util (ORD-000001 style) that is safe against concurrent orders (use a DB sequence or transaction).
- Seed script: all 24 Tunisian governorates as ShippingZone with a default fee of 8000 millimes (8 TND) and a few larger-region examples at 7000; Settings (freeShippingThreshold = 200000, storePhone, notificationEmail); 3 root categories (Parfums, Vêtements, Accessoires) with 2 subcategories each; 6 sample products across the three types with variants (perfume: volumeMl 50/100; clothing: size S-XL and color; accessories: single variant) and placeholder images; one admin user (email and password from env vars, hashed with bcrypt).

Run the migration and seed, and verify with a quick script or Prisma Studio that the data is there.
```

---

### Task 2: Admin authentication

```
Add admin authentication using Auth.js (credentials provider) against the AdminUser table with bcrypt password check.

Requirements:
- Route /admin/login with a clean form (email, password), French labels, error messages.
- Middleware that protects every /admin/* route (except /admin/login) and redirects to login when unauthenticated.
- Server-side session check helper requireAdmin() to call inside every admin server action and route handler (do not rely on middleware alone).
- Rate-limit login attempts (simple in-memory or DB-based limiter is fine for now: 5 attempts per 15 minutes per IP + email).
- Admin layout at /admin with a sidebar (Produits, Catégories, Commandes, Livraison, Paramètres) and a logout button. Pages can be empty placeholders.
- Secure cookie settings for production.

Write a Vitest test for the rate limiter. Verify that unauthenticated access to /admin/products redirects to login.
```

---

### Task 3: Admin catalog management (categories, products, variants, images)

```
Build the admin catalog management under /admin, following the schema and CLAUDE.md.

Categories: list, create, edit, delete (block delete if it has products), set parent and position.

Products:
- List with search, filter by category/type/active status, pagination.
- Create/edit form: name, auto-generated editable slug, description (simple rich text or textarea), brand, category, type, active toggle.
- Variants editor inside the product form: add/remove rows with label, SKU, price (entered in TND, stored in millimes), compare-at price, stock, and options fields that adapt to product type (perfume: volume ml; clothing: size + color; accessory: optional color).
- Image upload to Cloudinary (multiple images, drag to reorder, delete, first image is the cover). Use a signed upload or server-side upload; never expose the API secret to the client.
- Soft-disable products (isActive) instead of hard delete when they appear in orders.

Use Zod schemas for all inputs and server actions, call requireAdmin() in each action, and show toast feedback. Add Vitest tests for the TND to millimes conversion and slug generation.
```

---

### Task 4: Storefront layout, home and catalog

```
Build the public storefront (French UI, mobile-first, fast).

- Global layout: header (logo, category menu with dropdown for subcategories, search icon, cart icon with item count), footer (contact phone, social links placeholders, links to legal pages).
- Home page: hero banner, featured categories (Parfums, Vêtements, Accessoires), "Nouveautés" product grid (latest active products), a short trust strip (paiement à la livraison, livraison partout en Tunisie).
- Category page /c/[slug] (includes products of subcategories): product grid with pagination, sorting (newest, price asc/desc), and filters: price range, in stock only, plus type-specific filters (perfume: brand and volume; clothing: size and color). Filters live in the URL search params.
- Search page /search?q= using Postgres (ILIKE or full-text) over product name, brand and category.
- ProductCard component: cover image (next/image), name, price "à partir de" if multiple variants, compare-at price strikethrough, "Épuisé" badge when all variants are out of stock.
- Use server components and caching/revalidation where sensible. Add per-page metadata (title, description, Open Graph).
- Loading skeletons and empty states.

Add the legal pages as simple static routes: /conditions-generales, /confidentialite, /retours (placeholder French text I can edit later).
```

---

### Task 5: Product detail page

```
Build the product page /p/[slug].

- Image gallery (thumbnails, zoom or lightbox, swipe on mobile).
- Name, brand, price (updates per selected variant), compare-at price, stock status ("En stock", "Plus que 3", "Épuisé").
- Variant selector that adapts to type: perfume → volume buttons; clothing → size buttons and color swatches (disable unavailable combinations); accessory → color or none.
- Quantity selector capped by stock, "Ajouter au panier" button (wire to the cart in the next task; for now a TODO-free stub that calls a cart context function we will implement).
- Description, a delivery and payment info block (paiement à la livraison, délai 2-4 jours, retours).
- Related products (same category).
- SEO: dynamic metadata, JSON-LD Product schema (price in TND, availability), canonical URL.
- 404 for inactive or missing products.

Make sure it is fully usable on a 360px wide screen.
```

---

### Task 6: Cart

```
Implement the shopping cart for guests (no account).

- Store the cart in localStorage as a list of {variantId, quantity}, with a React context provider and a useCart hook (add, update quantity, remove, clear).
- Cart drawer opened from the header and a full /cart page.
- Never trust prices from the client: the cart only stores variantId and quantity. A server action `getCartDetails(items)` returns fresh product name, variant label, image, unit price, stock and availability from the DB, and flags lines that are out of stock or exceed stock (and auto-adjusts quantity with a visible message).
- Show subtotal, estimated shipping note, and a "Commander" button to /checkout.
- Put the pricing logic (subtotal, shipping fee with free-shipping threshold, total) in a pure function in src/lib/pricing.ts.

Write Vitest tests for pricing.ts covering: threshold exactly met, just below, zero items, and a governorate with a custom fee.
```

---

### Task 7: Checkout (cash on delivery)

```
Build /checkout with guest checkout and cash on delivery.

Form fields: full name, phone (Tunisian format: 8 digits, optionally +216 prefix; normalize on save), email (optional), governorate (select from ShippingZone), city/delegation, full address, notes (optional). Payment method: show "Paiement à la livraison" as the only option.

Behavior:
- Order summary side panel with live shipping fee based on the selected governorate and free shipping threshold from Settings.
- Server action placeOrder(formData, cartItems): validate with Zod; re-fetch variants and prices from the DB; recompute totals server-side with pricing.ts; inside a single transaction check stock, decrement stock atomically (fail cleanly if stock changed), create Order and OrderItems with snapshots, generate the order number.
- Basic abuse protection: honeypot field and a rate limit per IP and per phone (e.g., max 5 orders per hour).
- On success: clear the cart, redirect to /order/confirmation?number=...&token=... showing the order number, summary and "we will call you to confirm" message. Use a random unguessable token so the page cannot be enumerated.
- Order lookup page /suivi: customer enters order number + phone and sees the status.
- Send a notification email via Resend to the notificationEmail setting with the order details (and to the customer if they provided an email). Email failure must not fail the order; log it.

Write Vitest tests for phone normalization and for the stock-conflict case in placeOrder (two concurrent orders for the last unit: exactly one succeeds). Add a Playwright E2E test: add a product to the cart, go through checkout, see the confirmation.
```

---

### Task 8: Admin orders and shipping settings

```
Build the admin order management under /admin/orders.

- List: filter by status, search by order number, name or phone, date range, pagination, newest first. Badge colors per status. Highlight PENDING orders.
- Detail page: customer info (click-to-call and WhatsApp links wa.me), address, items with images, totals, notes, status history.
- Status changes with allowed transitions only (PENDING → CONFIRMED | CANCELLED, CONFIRMED → SHIPPED | CANCELLED, SHIPPED → DELIVERED | RETURNED). When an order is CANCELLED or RETURNED, restore stock in a transaction. Store a status history table (status, changedAt, changedBy).
- Internal admin note field.
- Printable order sheet / delivery slip (print-friendly CSS page with order number, customer, address, phone, items, total to collect in TND).
- CSV export of orders for the selected filters.

Also build /admin/shipping to edit the fee per governorate and the free-shipping threshold, and /admin/settings for store phone and notification email.

Add a dashboard at /admin with simple stats: orders today, pending orders, revenue this month (delivered orders), low-stock variants (stock <= 3).
Every action must call requireAdmin() and validate input with Zod.
```

---

### Task 9: Security, testing and performance pass

```
Do a review and hardening pass on the whole project.

Security:
- Confirm every admin server action and API route calls requireAdmin().
- Confirm all inputs are validated with Zod, and no raw SQL with user input.
- Add security headers (CSP suitable for Cloudinary images, X-Frame-Options, Referrer-Policy) in next.config.
- Confirm secrets are never exposed to the client, and the Cloudinary upload does not leak the API secret.
- Check that order confirmation and tracking pages cannot be enumerated.

Quality:
- Run lint, type-check, unit tests and Playwright E2E; fix failures.
- Add missing tests for critical logic (pricing, stock decrement, status transitions).
- Add error boundaries and friendly French error pages (404, 500).

Performance and SEO:
- Check Lighthouse on home, category and product pages (mobile), fix the main issues (image sizes, fonts, layout shift).
- Generate sitemap.xml and robots.txt dynamically from products and categories.
- Check accessibility basics: labels, focus states, alt text, color contrast.

Produce a short report listing what you found, what you fixed and what remains.
```

---

### Task 10: Deployment

```
Prepare the project for production deployment on Vercel with a Neon PostgreSQL database.

- Document every required environment variable in README.md and .env.example.
- Add the Prisma setup for production (prisma migrate deploy in the build or a release step, connection pooling URL vs direct URL for migrations).
- Add Sentry for error monitoring (client and server) with source maps.
- Add a GitHub Actions workflow: install, lint, type-check, unit tests on every PR.
- Write a deployment checklist in docs/DEPLOY.md: create Neon DB, set env vars on Vercel, run migrations and the production seed (governorates and settings only, no sample products, admin user creation), connect the domain, verify SSL, test a real order end to end, set up database backups.
- Add a production-safe seed script separate from the dev seed.

Do not deploy automatically. Give me the exact manual steps for what I need to do in the Vercel and Neon dashboards.
```

---

## 4. After the MVP (backlog)
1. Customer accounts and order history
2. Online payment (Konnect / Flouci / Paymee) alongside COD
3. Discount codes and promotions
4. Reviews and wishlist
5. Arabic language and RTL
6. Delivery carrier integration (tracking numbers)
7. Abandoned cart recovery and WhatsApp notifications
8. Meilisearch if catalog grows large

## 5. Tips for working with Claude Code
- Keep CLAUDE.md up to date; it is how each new session remembers your rules.
- One task per session, commit after each, and review the diff before moving on.
- For Tasks 7 and 8 (money and stock), read the code carefully yourself; these are the riskiest parts.
- If a task is too big for one session, split it at its bullet points.
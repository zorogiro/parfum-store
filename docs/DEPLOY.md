# Deploying Parfum Store (Vercel Hobby + Neon free)

A checklist for the owner. Do the steps **in order**. Nothing here is automated: the repository is prepared, but every action on Neon, Cloudinary, Resend and Vercel is manual.

## Read this first

- **Order matters.** `next build` queries the database to prerender product and category pages, so the production database must already have its tables (step 2) and reference data (step 3) **before the first Vercel build**. Deploying first fails the build.
- **Migrations are NOT run by the Vercel build.** Why: a build that migrates can apply a destructive or half-finished migration to production automatically, on every push and every preview, and a failed build would leave the schema and the running code out of sync. You run `prisma migrate deploy` yourself, deliberately, _before_ promoting code that needs the new schema. Keep migrations additive (add columns/tables first, remove later) so the previous deployment keeps working during a rollback.
- **Production strings never go in a file, in git, or in a chat.** Use a separate terminal window (not the Claude Code session), type them at a prompt, and close it afterwards. `Read-Host` input is not saved in PowerShell history; a pasted `$env:X="..."` line is.
- Two Neon branches: **`production`** (real data) and **`dev`** (what `.env` points to on your machine, used by tests). Local commands must never see the production strings.
- The agent that prepared this repo never connected to production. The production seed was tested only on a throw-away schema in the dev database, and the whole "migrate, seed, build" sequence was dry-run on an empty local Postgres.

Connection strings: the app uses the **pooled** one (`DATABASE_URL`, host contains `-pooler`); migrations and seeds use the **direct** one (`DIRECT_URL`, no `-pooler`).

---

## 1. Neon (production branch)

1. Go to <https://console.neon.tech> and open your project.
2. In the left menu click **Branches** and open the branch named **`production`** (the default branch). Check its name in the top bar so you do not copy the dev branch by mistake.
3. Reset the role password: **Roles & Databases** (or the project's **Settings → Roles**) → on your role (usually `neondb_owner`) click the **⋯ menu → Reset password**. Copy the new password only into the password field of the connection strings below. Anything that used the old password stops working (this includes the `.env` if it had been pointed at this branch: it should not be).
4. Click **Connect** (top of the project dashboard). Select **Branch: production**, the database (`neondb`), the role.
   - Turn **Connection pooling ON** and copy the string. This is **`DATABASE_URL`** (host contains `-pooler`).
   - Turn **Connection pooling OFF** and copy the string. This is **`DIRECT_URL`** (no `-pooler`).
5. Keep both strings somewhere private (a password manager). Do **not** paste them into a chat, an issue, `.env`, or a file in the repo.
6. Note the **host** of the production branch (the `ep-…` part). You will compare it with what `npm run db:host` prints, to prove you are not touching dev.

## 2. Create the tables on production (`prisma migrate deploy`)

Open a **new PowerShell window** in the project folder (`cd C:\Users\moham\Documents\GitHub\parfum-store`). Do not use the Claude Code terminal. Make sure you have the code you will deploy (`git checkout main`, `git pull`, `npm ci`) so the migrations applied are the ones in that commit.

```powershell
# Paste the strings at the prompt (they are not stored in history). Both point at the DIRECT string,
# so a leftover dev value in .env can never be used by mistake.
$env:DIRECT_URL = Read-Host "Paste the PRODUCTION DIRECT string (no -pooler)"
$env:DATABASE_URL = $env:DIRECT_URL

# 1) Check the target BEFORE doing anything. The host must be the production branch host.
npm run db:host
```

Stop if the printed host is the dev branch's or contains `-pooler`. Otherwise:

```powershell
# 2) Apply the migrations
npx prisma migrate deploy
```

Expected: `4 migrations found`, then "All migrations have been successfully applied":

1. `20261016000000_init` (catalog, orders, settings, admin tables)
2. `20261016120000_checkout_tracking` (tracking token, idempotency key)
3. `20261017000000_order_status_history` (order status history)
4. `20261018000000_rate_limit_bucket` (rate-limit counters)

**Verify in Neon:** Console → **Tables** (select Branch: production). You must see: `AdminUser`, `Category`, `Order`, `OrderItem`, `OrderStatusHistory`, `Product`, `ProductImage`, `RateLimitBucket`, `Setting`, `ShippingZone`, `Variant`, and `_prisma_migrations` (4 rows, all with a finish date). The `order_number_seq` sequence is created by the first migration.

Leave this PowerShell window open for step 3.

## 3. Production seed (reference data + your admin)

The production seed creates only: the 24 governorate shipping zones (8 TND each), three settings with **placeholder** values (you set the real ones in the admin, step 8), the 3 root categories with their 6 subcategories, and your admin user. **No products, no images, no test data.** It is safe to re-run: it only adds what is missing, and it never changes an existing admin password (unless `RESET_ADMIN_PASSWORD=1`).

In the same window (the two `$env:` variables from step 2 are still set; if you closed it, repeat step 2's first block):

```powershell
$env:ADMIN_EMAIL = "your-real-admin@email.com"
$sec = Read-Host "Admin password (12+ characters, unique)" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $sec).Password
$env:CONFIRM_PRODUCTION_SEED = "yes"

npm run db:seed:prod
```

Expected output: `Target database: <production host>/neondb`, `Shipping zones created: 24`, `Settings created: …`, `Categories created: 9`, `Admin user: created`, `Production seed complete.` It refuses to run (and says why) without `CONFIRM_PRODUCTION_SEED=yes`, with a password shorter than 12 characters, or without a database string.

Then **clear everything and close the window**:

```powershell
Remove-Item Env:DIRECT_URL, Env:DATABASE_URL, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:CONFIRM_PRODUCTION_SEED -ErrorAction SilentlyContinue
exit
```

Forgot the admin password later? Run the same block again with a new password **and** `$env:RESET_ADMIN_PASSWORD = "1"`.

## 4. Cloudinary and Resend

**Cloudinary** (product images)

1. <https://console.cloudinary.com> → copy **Cloud name**, **API Key**, **API Secret** (Settings → API Keys, or the dashboard "Product Environment Credentials").
2. The app uploads into the folder **`store/products`**. It is created automatically by the first signed upload; you can also create it under **Media Library → Create folder `store`, then `products`**. Nothing else is needed (uploads are signed by the server, no upload preset).
3. You will enter `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Vercel (step 5). The cloud name is also needed at **build** time.

**Resend** (order emails)

1. <https://resend.com> → **API Keys → Create API Key** (permission: _Sending access_). Copy it once: it becomes `RESEND_API_KEY`.
2. **Without a verified domain**, Resend only delivers to **your own Resend account email**. So with `RESEND_FROM=onboarding@resend.dev`: the merchant notification works only if the `notificationEmail` setting (step 8) equals your Resend account email, and **customers will not receive confirmations**. That is acceptable for the first tests; orders are never blocked by an email failure.
3. To email customers: **Resend → Domains → Add Domain** (e.g. `your-domain.tn`), add the DNS records Resend shows (SPF, DKIM, optionally DMARC) at your domain registrar, click **Verify**. Then set `RESEND_FROM` to `Parfum Store <commandes@your-domain.tn>` in Vercel and redeploy.

**Sentry (optional)**: create a project (platform Next.js) at <https://sentry.io>, copy its DSN, and set both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (same value) in Vercel _before_ the build (the public one is inlined at build time). Without them nothing is sent. Browser events go through `/monitoring` on your own domain; no personal data is sent (see `src/lib/sentry-scrub.ts`). Source-map upload is off unless you also set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

## 5. Vercel

**Import**

1. <https://vercel.com/new> → **Import Git Repository** → pick `zorogiro/parfum-store` (install the Vercel GitHub app if asked).
2. **Framework Preset:** Next.js (auto-detected). **Root directory:** `./`. Build command, install command and the region come from `vercel.json` (`npm ci`, `npm run build`, region `fra1`); leave the dashboard fields at their defaults/overrides off. `postinstall` runs `prisma generate`.
3. **Production branch:** `main` (Project → Settings → Git). Merge the work to `main` first, or choose the branch you want live.
4. **Do not click Deploy yet.** Add the environment variables first (the build needs them). Do it on the import screen, or later in **Project → Settings → Environment Variables** and then redeploy.

**Region:** `vercel.json` sets `fra1` (Frankfurt), next to Neon's `eu-central-1` (Frankfurt). The Hobby plan allows one function region, so this is accepted. Check it in Project → Settings → **Functions → Function Region**.

**Environment variables.** Tick the environments exactly as in the table. Mark secrets as **Sensitive**.

| Variable                 | Production | Preview             | Value / note                                                                                       |
| ------------------------ | :--------: | ------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           |     ✔      | ✔ (**dev** string)  | Production: the **pooled** production string. Preview: the pooled string of the **dev** branch.    |
| `DIRECT_URL`             |  optional  | —                   | Not read at runtime or by the build. Skip it on Vercel; keep it only on your machine (steps 2–3).  |
| `AUTH_SECRET`            |     ✔      | ✔ (different value) | Generate a NEW one per environment: `npx auth secret` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Never reuse the dev one in production. |
| `NEXT_PUBLIC_SITE_URL`   |     ✔      | optional            | `https://<project>.vercel.app` (no trailing slash). Inlined at **build** time: redeploy after any change. |
| `CLOUDINARY_CLOUD_NAME`  |     ✔      | ✔                   | Needed at build and runtime.                                                                       |
| `CLOUDINARY_API_KEY`     |     ✔      | ✔                   | Sensitive.                                                                                         |
| `CLOUDINARY_API_SECRET`  |     ✔      | ✔                   | Sensitive.                                                                                         |
| `RESEND_API_KEY`         |     ✔      | **leave unset**     | Without it previews send no email (logged, not an error).                                          |
| `RESEND_FROM`            |     ✔      | —                   | `onboarding@resend.dev` until your domain is verified.                                             |
| `SENTRY_DSN`             |  optional  | —                   | Optional monitoring.                                                                               |
| `NEXT_PUBLIC_SENTRY_DSN` |  optional  | —                   | Same DSN, public.                                                                                  |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | optional | — | Only for source-map upload at build.                                                    |

**Do NOT set on Vercel (any environment):** `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed only, not needed at runtime), `CONFIRM_PRODUCTION_SEED`, `RESET_ADMIN_PASSWORD`, `E2E_ALLOW_DB_WRITES`, `E2E_BASE_URL`, `AUTH_TRUST_HOST` (Vercel is trusted automatically), `NODE_ENV` / `VERCEL_ENV` (automatic).

**Isolating previews from production data.** Every pull request/branch gets a Preview deployment. Previews must never see the production database:

- Set Preview `DATABASE_URL` to the **dev** branch pooled string (the build of a preview also needs a reachable database), with its own `AUTH_SECRET`. In the variable's dialog, untick _Production_ and tick only _Preview_, so the two values never mix.
- Do **not** give Preview `RESEND_API_KEY` (no real emails from test orders) and never put the production `DATABASE_URL` in Preview.
- The dev database must have tables and the dev seed so the preview build succeeds (it does: `.env` points to it).
- Preview deployments are protected by Vercel Authentication by default (Project → Settings → Deployment Protection); keep it on.
- Preview Cloudinary shares the same cloud as production (images upload to `store/products`); delete test images, or leave the Cloudinary variables off Preview if you never test uploads there (the admin image upload then simply fails on previews).

## 6. First deploy and verification

1. Click **Deploy** (or **Deployments → Redeploy** after adding variables). Wait for "Ready". If the build fails with "Can't reach database" or "table does not exist", steps 2–3 or `DATABASE_URL` are wrong (see the build log).
2. Open `https://<project>.vercel.app`. The storefront loads with an empty catalog (that is expected: no products yet).
3. Log in at `/admin/login` with the email/password from step 3.
4. In the admin set the real data:
   - **Paramètres:** the real `storePhone` (shown in the footer) and `notificationEmail` (where order alerts go; with the Resend limitation it must be your Resend account email), then **Livraison:** shipping fee per governorate and the free-shipping threshold (empty or 0 = disabled).
   - Replace the placeholders `+21600000000` and `orders@example.com` immediately.
5. **Produits → Nouveau produit:** create one real product with images and variants. Confirm it appears on the home page and in its category.
6. **From your phone**, place a real test order (cash on delivery, your own number). Check: the confirmation page, the order in the admin (`/admin/orders`), the stock decreased, the merchant email arrived (to `notificationEmail`), the customer email behaves as expected (only delivered if your domain is verified or the address is your Resend account email), and tracking at `/suivi` (order number + phone). Then change its status in the admin and cancel it to restore the stock.
7. Check `https://<project>.vercel.app/sitemap.xml` (home, categories, active products, legal pages; URLs must start with your real site URL, not `localhost`) and `/robots.txt` (disallows `/admin`, `/cart`, `/checkout`, `/order`, `/suivi`, `/search`).
8. Security headers:

   ```powershell
   curl.exe -sI https://<project>.vercel.app/
   ```

   Look for `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy`. Also `curl.exe -sI https://<project>.vercel.app/admin/login` must show `x-robots-tag: noindex, nofollow`, and `curl.exe -s -o NUL -w "%{http_code}" https://<project>.vercel.app/p/does-not-exist` must print `404`.

9. Lighthouse: open the live URL in Chrome → DevTools (F12) → **Lighthouse** tab → Mobile → Analyze. Do it on the home page and a product page. Note that the first request after idle is slow because of the cold database (section 8).
10. Optional: delete the test order's data later (orders are never hard-deleted by the app; if you want a clean start, ask for a cleanup script rather than editing the database by hand).

## 7. Backups and recovery

- **What Neon gives you on the free plan:** a **history window of 6 hours** (instant restore / point-in-time restore of a branch to any moment in the last 6 hours, capped at 1 GB of change history). Paid plans extend this (days). This is not a backup you can rely on for a mistake discovered next week. _Verify the current limits in Neon's docs ("History window") and your project's Settings → Instant restore: plans change and I could not read your console._
- **Manual backup with `pg_dump`** (from your machine; needs PostgreSQL client tools of version ≥ the server's, e.g. the PostgreSQL 17 installer's command-line tools). Same rules as step 2: type the string at a prompt, close the window after.

  ```powershell
  $env:PGURL = Read-Host "Paste the PRODUCTION DIRECT string"
  & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" $env:PGURL --format=custom --no-owner --no-privileges --file "$HOME\Backups\parfum-$(Get-Date -Format yyyy-MM-dd).dump"
  Remove-Item Env:PGURL
  ```

  Create `~\Backups` first, **outside the repository**. The file contains customer names, phones and addresses: store it privately, encrypted if possible, and never commit it. Do this at least weekly once you have orders, and before every migration.

- **Test a restore on a scratch branch** (do this once now, before you need it): Neon → Branches → **Create branch** `restore-test` (from production). Take its DIRECT string, then:

  ```powershell
  $env:PGURL = Read-Host "Paste the restore-test DIRECT string"
  & "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --no-owner --clean --if-exists --dbname $env:PGURL "$HOME\Backups\parfum-YYYY-MM-DD.dump"
  Remove-Item Env:PGURL
  ```

  Check the tables and row counts in the Neon Tables view, then **delete the `restore-test` branch**.

- **Undo a bad change within 6 hours:** Neon → Branches → production → **Restore** (to a timestamp). Prefer restoring to a _new branch_ first to inspect it.

## 8. Operations

- **Cold database (first request is slow).** The free Neon compute suspends after about 5 minutes of inactivity; the next request wakes it (typically a second or two, sometimes more). It is normal, not an outage. If it fails once, reload. The app's rate limiters fail open for customers if the database is briefly unavailable.
- **Logs.** Vercel → your project → **Logs** (runtime logs; filter by status/route) and **Deployments → a deployment → Build Logs / Runtime Logs**. Hobby keeps logs only for a short time. Logs never contain customer data by design (error name and code only). If you enabled Sentry, errors are also there.
- **Roll back a bad deployment.** Vercel → **Deployments** → open the last good deployment → **⋯ → Promote to Production** (instant, no rebuild). The database is _not_ rolled back: this is why migrations must be additive. If a migration is the problem, restore from the Neon history window (section 7).
- **Rotate `AUTH_SECRET`.** Generate a new value, update it in Vercel (Production), **Redeploy**. Effects: every admin is logged out (log in again), and the rate-limit counters reset (their keys are derived from the secret). Rotate it if it ever leaked.
- **Rotate the database password.** Neon → Roles → **Reset password** (step 1.3), copy the new pooled string, update `DATABASE_URL` in Vercel, **Redeploy**. Until the redeploy the live site cannot reach the database, so do it in one go. Update your private copy of `DIRECT_URL` too.
- **Schema change in the future.** Merge code that is compatible with both the old and the new schema → run `npx prisma migrate deploy` against production (step 2 procedure) → deploy.

## 9. Hobby plan limits (important)

Vercel's **Hobby plan is for non-commercial, personal use only** (Vercel's Fair Use Guidelines: <https://vercel.com/docs/limits/fair-use-policy>). Their definition of commercial use covers any deployment used for the financial gain of anyone involved, for example processing payments or taking orders from visitors. **A store that takes orders from paying customers is a commercial use.** Before opening to real customers, move the project to a paid Vercel plan (Pro) or to another host. Vercel's terms can change and the borderline cases are theirs to judge: check the current page above or ask Vercel support. Using Hobby to build, test and demo the store is fine. The Neon free plan also has compute/storage limits and a short history window: review them before launch.

## 10. Custom domain (later)

1. Vercel → Project → **Settings → Domains → Add** your domain and follow the DNS instructions at your registrar (an `A` record to Vercel's IP for the apex and a `CNAME` for `www`, as the dashboard shows). Wait for the green check; the HTTPS certificate is automatic.
2. Choose the canonical host (apex or `www`) and redirect the other one (Domains screen).
3. Update `NEXT_PUBLIC_SITE_URL` (Production) to the new `https://…` URL and **Redeploy** (it is inlined at build time: canonical links, Open Graph and the sitemap use it). Re-check `/sitemap.xml`.
4. Verify the domain in Resend (step 4) and update `RESEND_FROM`.
5. **HSTS:** the app sends `Strict-Transport-Security: max-age=63072000; includeSubDomains` (2 years). Once a browser has seen it on your domain, it refuses plain http for every subdomain too. Make sure all your subdomains support https before pointing the domain at the store, and **do not add `preload`** (and do not submit to the HSTS preload list) until the domain is final: preload is very hard to undo.
6. Submit `https://your-domain/sitemap.xml` in Google Search Console when ready.

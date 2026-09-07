# topupshop — Free Fire Diamond TopUp (Next.js full-stack clone)

A full-stack, database-backed TopUp site built for learning/portfolio purposes.
Next.js 16 (App Router) + TypeScript + Prisma (MySQL) + Auth.js v5 (NextAuth) + Tailwind CSS v4.

> **Scope note:** This is a learning/demo project. Payments are handled via an in-app
> wallet + manual bKash/Nagad/Rocket verification (admin approves deposits/orders by hand),
> since there is no public Garena top-up API and no real payment-gateway credentials were
> configured. See "Going to real production" below for what to add before taking real money.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack, Server Actions)
- **Language:** TypeScript
- **Database:** MySQL via Prisma ORM 7 (driver adapter: `@prisma/adapter-mariadb`)
- **Auth:** Auth.js v5 (`next-auth@beta`) — credentials (bcrypt) + Google OAuth
- **Styling:** Tailwind CSS v4
- **Validation:** Zod

## Features

- Public site: homepage (DB-driven banners/notices/products), product/topup order page,
  contact page, login/register — all with SEO metadata, JSON-LD, sitemap.xml, robots.txt.
- User dashboard: wallet balance, deposit requests (bKash/Nagad/Rocket, admin-verified),
  order history.
- Order flow: pick a recharge option → pay from wallet or submit a manual transaction ID →
  order goes to admin as `PENDING`.
- Admin panel (`/admin`, role-protected): approve/reject deposits (credits wallet),
  approve/reject/deliver orders (auto-refunds wallet on reject/cancel), manage products,
  recharge options, banners and the homepage notice bar.
- Route protection via `src/proxy.ts` (Next 16's renamed middleware) + a second
  server-side check in `admin/layout.tsx` and inside every server action (defense in depth,
  since proxy matchers don't cover Server Actions on other routes).

## Getting started

### 1. Prerequisites

- Node.js 20.9+
- A MySQL-compatible server (local install, XAMPP/WAMP, Docker, or a managed provider like
  PlanetScale/Railway/Aiven)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL connection string, e.g. `mysql://user:pass@localhost:3306/topupshop` |
| `AUTH_SECRET` | Random 32-byte secret for session encryption — generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials (optional; leave blank to disable Google login) |
| `NEXT_PUBLIC_SITE_URL` | Public base URL, used in metadata/sitemap |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials for the admin account created by the seed script |

### 4. Create the database schema and seed data

```bash
npx prisma db push   # creates all tables from prisma/schema.prisma
npx prisma db seed    # seeds products, banners, notice, site settings, and the admin user
```

### 5. Run the dev server

```bash
npm run dev
```

Visit http://localhost:3000. Log in with the seeded admin account (`SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`) and open `/admin` to manage the site.

### 6. Production build

```bash
npm run build
npm run start
```

## Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build + type-check |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push the Prisma schema to the database (no migration history) |
| `npm run db:migrate` | Create/apply a versioned migration (use this once you have a stable schema) |
| `npm run db:seed` | Re-run the seed script |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

## Project structure

```
prisma/schema.prisma        Database schema (User, Product, Order, WalletTransaction, ...)
prisma/seed.ts               Seed script (demo products/banners/notice/admin user)
src/lib/prisma.ts            Prisma client singleton (MariaDB driver adapter)
src/lib/auth.ts              Auth.js config (credentials + Google, JWT sessions)
src/lib/data.ts               Read-only data-fetching helpers used by pages
src/lib/actions/              Server Actions (auth, orders, wallet, admin)
src/lib/validation.ts         Zod schemas shared by forms + server actions
src/proxy.ts                  Route protection for /dashboard and /admin
src/app/                      Routes (App Router)
src/components/               UI components
```

## Going to real production

This project is deliberately scoped as a **manual-verification** topup site (the
same approach most small Bangladeshi topup sites use, since Garena has no public
top-up API). Before operating it for real money, you would need to:

1. **Real payment gateway** — replace the "submit a transaction ID, admin verifies
   manually" flow with a real bKash/Nagad/Rocket merchant API (requires a registered
   business + merchant agreement with each provider).
2. **Real Google OAuth credentials** — create an OAuth client in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and set
   `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
3. **Managed MySQL** — point `DATABASE_URL` at a managed instance (PlanetScale, RDS,
   etc.) instead of a local server, and switch from `prisma db push` to
   `prisma migrate deploy` for versioned migrations.
4. **Image uploads** — product/banner images currently take a path or URL typed by
   an admin; wire up real file uploads (e.g. S3, Cloudinary, UploadThing) if you want
   admins to upload from disk.
5. **Rate limiting / abuse protection** — add rate limiting on `/login`, `/register`,
   and the order/deposit Server Actions (e.g. Upstash Ratelimit) before exposing this
   publicly.
6. **Business registration & legal** — a real topup business handling customer money
   needs proper business registration and terms of service; this repo has none of that.

## License

For personal/educational use.

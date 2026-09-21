# Deployment Guide

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard and create a new project.
2. Note down (Project Settings → API):
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret — server only)
3. Project Settings → Database → Connection string:
   - Copy the **Transaction pooler** (port 6543) URI → `DATABASE_URL` (append `?pgbouncer=true`)
   - Copy the **Session/direct** URI (port 5432) → `DIRECT_URL`

## 2. Push the schema

```bash
cp .env.example .env.local   # fill in the values from step 1
npx prisma generate
npx prisma migrate deploy
```

This creates every table in `prisma/schema.prisma` (users, products,
purchase_batches, purchase_items, inventory, customers, sales, sale_items,
expenses, promotions, payments, audit_logs, settings, stores).

## 3. Apply Row Level Security

Open the Supabase SQL editor and run the full contents of
`supabase/migrations/001_init_rls.sql`. This enables RLS on every table,
adds the store-isolation + manager-sees-own-sales policies, the invoice/
purchase numbering functions, and the duplicate-IMEI-sale trigger.

> Run this only after `prisma migrate deploy` has created the tables —
> Prisma owns table structure, this file owns RLS + triggers.

## 4. Seed demo data (optional but recommended for first run)

```bash
npm run db:seed
```

Creates one store, an Owner + Manager Supabase Auth user (via the Admin
API — needs `SUPABASE_SERVICE_ROLE_KEY` in your env), 5 Samsung products,
one purchase batch, and 20 IMEI-tracked inventory units.

## 5. Enable Supabase Auth email/password sign-in

Authentication → Providers → Email: leave enabled (default). Disable
"Confirm email" during development if you want to create users without a
verification step, or keep it on and confirm via the Admin API as the seed
script does (`email_confirm: true`).

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect the GitHub repo in the Vercel dashboard. Add every variable from
`.env.example` to Vercel → Project → Settings → Environment Variables
(all three environments: Production, Preview, Development). Redeploy after
adding them.

Build command: `next build` (default). Prisma's `postinstall` runs
`prisma generate` automatically via the `db:generate` script — if you use a
custom build pipeline, make sure `prisma generate` runs before `next build`.

## 7. Multi-store rollout

Every table already carries `storeId`, and RLS enforces isolation per
store. To onboard a second Samsung retail location:

1. Insert a new `Store` row (or build a simple "Create Store" admin flow).
2. Create that store's Owner via the same `createUser` Admin-API pattern
   used in `scripts/seed.ts`, pointing `storeId` at the new store.
3. Nothing else changes — Prisma models, RLS policies, and every page
   already scope every query by the signed-in user's `storeId`.

## 8. PWA / installable app

`next-pwa` is wired up in `next.config.js` and registers a service worker
in production builds automatically (`disable: process.env.NODE_ENV ===
"development"`). After deploying, visiting the site on Android Chrome will
show an "Install app" prompt; `public/manifest.json` controls the name,
icons, and theme color. Drop real 192×192 and 512×512 PNG icons into
`public/icons/` before going live (see the README placeholder there).

## 9. Database backups

Supabase Pro and above include daily automated backups and point-in-time
recovery out of the box (Project Settings → Database → Backups). On the
Free tier, schedule a periodic `pg_dump` via a cron job (e.g. a scheduled
GitHub Action calling `pg_dump $DIRECT_URL`) and store the dump in Supabase
Storage or an external bucket — this satisfies the "Database Backup"
requirement in the security spec even without a paid Supabase plan.

## Troubleshooting

- **"new row violates row-level security policy"** — the signed-in user
  has no matching row in `public.users` (i.e. `authId` doesn't match
  `auth.uid()`). Make sure every Supabase Auth user you create is paired
  with a `prisma.user.create({ authId: ... })` call, exactly as
  `scripts/seed.ts` and `createStaffUser` do.
- **IMEI lookup returns "not found" for a real unit** — confirm the
  purchase batch was received through `/purchase/new` (or the seed script);
  inventory rows only exist once a `PurchaseItem` has been created.
- **Prisma can't reach the database from Vercel** — make sure
  `DATABASE_URL` uses the **pooled** (port 6543, `pgbouncer=true`)
  connection string, not the direct one; serverless functions exhaust
  direct connections quickly.

# Samsung Mobile Shop ERP

A production-grade, mobile-first ERP built specifically for **Samsung authorized
retail shops in Bangladesh** — not a generic POS. Every phone is tracked by
IMEI from the moment it's purchased from the distributor to the moment it's
sold, with Samsung monthly promotions, profit calculation, and full
Owner/Manager role separation baked in.

## Stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui ·
React Hook Form + Zod · TanStack Table · Recharts · Framer Motion ·
Supabase (Postgres + Auth + Storage) · Prisma ORM · Row Level Security ·
Vercel · PWA (installable, offline cache via `next-pwa`)

## What's fully implemented

- **Complete Prisma schema** (`prisma/schema.prisma`) — 14 normalized tables
  matching the spec exactly: users, products, purchase_batches,
  purchase_items, inventory, customers, sales, sale_items, expenses,
  promotions, payments, audit_logs, settings, plus a `stores` table so the
  system is multi-tenant/multi-store from day one.
- **Full Supabase RLS policy set** (`supabase/migrations/001_init_rls.sql`)
  — store isolation on every table, Manager-sees-own-sales-only,
  Owner-only writes on products/purchases/promotions/expenses/reports,
  plus two safety-net DB triggers that block a duplicate IMEI sale even if
  application logic were ever bypassed.
- **The core "two mandatory fields" sales flow** — `lookupImei` and
  `lookupCustomer` server actions, `ImeiScanner` (camera + manual + USB/BT
  scanner compatible), `CustomerLookup` (auto-fill or inline new-customer
  form), and `SaleForm`, which together implement the exact IMEI/customer
  auto-fill logic, duplicate-sale blocking, and profit formula
  (`sellingPrice - buyingPrice + promo - discount`) from the spec. Buying
  price is never sent to a Manager's browser.
- **Repository-pattern data layer** (`src/repositories`) sitting between
  Prisma and the server actions (`src/actions`), each action validated with
  Zod, each mutation wrapped in a Prisma transaction, each writing an
  `audit_logs` row.
- **Owner + Manager dashboards**, **purchase intake with dynamic IMEI
  rows**, **inventory browser**, **product catalog**, **Samsung monthly
  promotions**, **customers with purchase history**, **expenses**,
  **printable invoices** (A4 / 58mm / 80mm thermal, with QR code), **staff
  user management**, **store settings**, and a **reports module** with 7
  report types and Excel/CSV/PDF export.
- **Auth** via Supabase (`@supabase/ssr`), with middleware-based session
  refresh and route protection, and role gating (`requireOwner()`) enforced
  server-side on every Owner-only action — not just hidden in the UI.
- Mobile-first UI: bottom nav on mobile, sidebar on desktop, large tap
  targets, dark/light mode via CSS variables, One-UI-inspired rounded cards.
- PWA manifest + `next-pwa` service worker registration for installability
  and offline asset caching.

## What's scaffolded / stubbed for you to extend

This is a genuinely large system — the pieces above are real, working code,
not pseudocode. A few lower-priority screens are intentionally left as thin
stubs so you can extend them without fighting generated boilerplate:

- **Global search UI** — the `globalSearch` server action
  (`src/actions/search.actions.ts`) is complete and searches IMEI / phone /
  invoice / customer / model; wire it into a command-palette or search page
  of your choice.
- **Notifications panel** — `getNotificationCount` computes a badge count
  (low stock + promos ending soon) for the topbar bell; a dedicated
  notifications dropdown/page is not built out.
- **Commission rules** — the Manager dashboard uses a flat 0.5% placeholder
  commission rate; replace with your real commission structure in
  `src/actions/reports.actions.ts`.
- **Discount is currently split evenly** across multi-item sales in
  `createSale` — swap in a per-item discount UI if you need item-level
  control.
- **USB/Bluetooth barcode scanners**: these work automatically since they
  emulate a keyboard + Enter keypress into the manual IMEI field — no
  special driver code needed, but it hasn't been tested against a specific
  hardware model.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npx prisma generate
npx prisma migrate deploy    # creates all tables
# then run supabase/migrations/001_init_rls.sql in the Supabase SQL editor
npm run db:seed              # demo store, 2 users, 5 products, 20 IMEIs
npm run dev
```

Demo logins after seeding:
- Owner: `owner@demo.samsungerp.com` / `Owner@12345`
- Manager: `manager@demo.samsungerp.com` / `Manager@12345`

See `DEPLOYMENT.md` for the full Supabase + Vercel deployment walkthrough.

## Folder structure

```
prisma/schema.prisma          Full normalized DB schema
supabase/migrations/          RLS policies + DB triggers + numbering functions
scripts/seed.ts                Demo data seeder
src/
  app/
    (auth)/login/              Public login route
    (dashboard)/                All authenticated routes (owner + manager)
      dashboard/                Owner dashboard
      dashboard/manager/        Manager dashboard
      sales/new/                 THE core sales screen
      sales/[id]/                 Sale detail + printable invoice
      purchase/, products/, inventory/, customers/, promotions/,
      expenses/, reports/, users/, settings/
  actions/                      Server actions — one file per domain
  repositories/                 Repository-pattern data access
  components/
    ui/                         shadcn-style primitives
    sales/                      IMEI scanner, customer lookup, sale form, invoice
    dashboard/, layout/, shared/
  lib/
    supabase/                   Browser/server/admin clients + middleware
    validations/                Zod schemas, one per domain
    auth.ts, prisma.ts, utils.ts
  types/index.ts
middleware.ts                   Route protection + session refresh
```

## Security model in one paragraph

Every table carries `storeId`; Postgres RLS policies (not just app code)
enforce that a signed-in user can only ever read/write rows in their own
store, and that a Manager can only see their own sales. Every Owner-only
server action calls `requireOwner()` before touching the database, which
throws if the caller isn't an Owner — so even if a Manager somehow reached
an Owner page in the UI, the mutation itself would be rejected. Buying price
is filtered out of every server action response a Manager can call. A
Postgres trigger blocks a duplicate IMEI sale even if the application-level
check were ever bypassed.

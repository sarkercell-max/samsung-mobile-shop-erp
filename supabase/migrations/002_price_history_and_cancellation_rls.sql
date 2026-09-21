-- ============================================================================
-- Samsung Mobile Shop ERP — RLS additions for price history + purchase
-- cancellation + customer archiving.
-- Run AFTER prisma/migrations/20260816_price_history_and_cancellation has
-- been applied, and AFTER 001_init_rls.sql.
-- ============================================================================

alter table product_price_history enable row level security;

create policy "price_history_select" on product_price_history for select using ("storeId" = auth_store_id());
create policy "price_history_owner_insert" on product_price_history for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "price_history_owner_update" on product_price_history for update using (auth_role() = 'OWNER' and "storeId" = auth_store_id());
-- No delete policy — a price period is closed by setting effectiveTo, never
-- deleted, so history stays intact.

create policy "purchase_batches_owner_update" on purchase_batches for update using (
  auth_role() = 'OWNER' and "storeId" = auth_store_id()
);

-- Customers: archiving is enforced Owner-only at the application layer
-- (requireOwner() in customers.actions.ts) — no RLS change needed beyond
-- what 001_init_rls.sql already grants for UPDATE.

-- ============================================================================
-- Samsung Mobile Shop ERP — Row Level Security & helper functions
-- Run this AFTER `prisma migrate deploy` has created the tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper functions
-- ----------------------------------------------------------------------------

-- Returns the store_id of the currently authenticated user
create or replace function auth_store_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select "storeId"
  from users
  where "authId" = auth.uid()::text
  limit 1;
$$;

-- Returns the role of the currently authenticated user
create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from users where "authId" = auth.uid()::text limit 1;
$$;

-- Returns the internal users.id (not the auth uid) of the current user
create or replace function auth_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
  from users
  where "authId" = auth.uid()::text
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 2. Enable RLS on every tenant table
-- ----------------------------------------------------------------------------

alter table stores enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table purchase_batches enable row level security;
alter table purchase_items enable row level security;
alter table inventory enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table promotions enable row level security;
alter table expenses enable row level security;
alter table audit_logs enable row level security;
alter table settings enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Store isolation — every row must belong to the caller's store
-- ----------------------------------------------------------------------------

create policy "store_isolation_select" on stores for select using (id = auth_store_id());
create policy "store_isolation_update" on stores for update using (id = auth_store_id() and auth_role() = 'OWNER');

create policy "users_select" on users for select using ("storeId" = auth_store_id());
create policy "users_owner_write" on users for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "users_owner_update" on users for update using (auth_role() = 'OWNER' and "storeId" = auth_store_id());

create policy "products_select" on products for select using ("storeId" = auth_store_id());
create policy "products_owner_write" on products for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "products_owner_update" on products for update using (auth_role() = 'OWNER' and "storeId" = auth_store_id());

create policy "purchase_batches_select" on purchase_batches for select using ("storeId" = auth_store_id());
create policy "purchase_batches_owner_write" on purchase_batches for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());

create policy "purchase_items_select" on purchase_items for select using (
  exists (select 1 from purchase_batches pb where pb.id = purchase_items."purchaseBatchId" and pb."storeId" = auth_store_id())
);
create policy "purchase_items_owner_write" on purchase_items for insert with check (
  auth_role() = 'OWNER' and exists (select 1 from purchase_batches pb where pb.id = purchase_items."purchaseBatchId" and pb."storeId" = auth_store_id())
);

create policy "inventory_select" on inventory for select using ("storeId" = auth_store_id());
create policy "inventory_owner_write" on inventory for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());
-- Both roles may UPDATE inventory (status flips to SOLD during a sale),
-- but only via the sale server action which runs with the service role.
create policy "inventory_update" on inventory for update using ("storeId" = auth_store_id());

create policy "customers_select" on customers for select using ("storeId" = auth_store_id());
create policy "customers_write" on customers for insert with check ("storeId" = auth_store_id());
create policy "customers_update" on customers for update using ("storeId" = auth_store_id());

-- Sales: managers can see/insert only their own sales; owners see everything.
create policy "sales_select" on sales for select using (
  "storeId" = auth_store_id()
  and (auth_role() = 'OWNER' or "soldById" = auth_user_id())
);
create policy "sales_insert" on sales for insert with check (
  "storeId" = auth_store_id() and "soldById" = auth_user_id()
);
-- Only owners may soft-delete / update a sale (e.g. mark RETURNED)
create policy "sales_owner_update" on sales for update using (
  "storeId" = auth_store_id() and auth_role() = 'OWNER'
);

create policy "sale_items_select" on sale_items for select using (
  exists (
    select 1 from sales s where s.id = sale_items."saleId"
    and s."storeId" = auth_store_id()
    and (auth_role() = 'OWNER' or s."soldById" = auth_user_id())
  )
);
create policy "sale_items_insert" on sale_items for insert with check (
  exists (select 1 from sales s where s.id = sale_items."saleId" and s."soldById" = auth_user_id())
);

create policy "payments_select" on payments for select using (
  exists (select 1 from sales s where s.id = payments."saleId" and s."storeId" = auth_store_id())
);
create policy "payments_insert" on payments for insert with check (
  exists (select 1 from sales s where s.id = payments."saleId" and s."soldById" = auth_user_id())
);

create policy "promotions_select" on promotions for select using ("storeId" = auth_store_id());
create policy "promotions_owner_write" on promotions for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "promotions_owner_update" on promotions for update using (auth_role() = 'OWNER' and "storeId" = auth_store_id());

-- Reports / expenses / audit / settings — OWNER only, per spec
create policy "expenses_owner_all_select" on expenses for select using (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "expenses_owner_write" on expenses for insert with check (auth_role() = 'OWNER' and "storeId" = auth_store_id());

create policy "audit_logs_owner_select" on audit_logs for select using (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "audit_logs_insert" on audit_logs for insert with check ("storeId" = auth_store_id());

create policy "settings_owner_select" on settings for select using (auth_role() = 'OWNER' and "storeId" = auth_store_id());
create policy "settings_owner_update" on settings for update using (auth_role() = 'OWNER' and "storeId" = auth_store_id());

-- ----------------------------------------------------------------------------
-- 4. Auto invoice / purchase numbering
-- ----------------------------------------------------------------------------

create sequence if not exists invoice_seq start 1;
create sequence if not exists purchase_seq start 1;

create or replace function next_invoice_number(prefix text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('invoice_seq');
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

create or replace function next_purchase_number(prefix text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('purchase_seq');
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Guard: prevent selling an IMEI twice at the DB level (belt & suspenders
--    on top of the application check)
-- ----------------------------------------------------------------------------

create or replace function prevent_duplicate_imei_sale()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from inventory
    where id = new."inventoryId" and status = 'SOLD'
  ) then
    raise exception 'This IMEI has already been sold.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_imei_sale on sale_items;
create trigger trg_prevent_duplicate_imei_sale
  before insert on sale_items
  for each row execute function prevent_duplicate_imei_sale();

-- Automatically flip inventory status to SOLD when a sale_item is inserted
create or replace function mark_inventory_sold()
returns trigger
language plpgsql
as $$
begin
  update inventory set status = 'SOLD', "updatedAt" = now() where id = new."inventoryId";
  return new;
end;
$$;

drop trigger if exists trg_mark_inventory_sold on sale_items;
create trigger trg_mark_inventory_sold
  after insert on sale_items
  for each row execute function mark_inventory_sold();

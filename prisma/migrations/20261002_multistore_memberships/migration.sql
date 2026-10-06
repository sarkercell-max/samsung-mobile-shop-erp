CREATE TABLE "store_memberships" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "store_memberships_userId_storeId_key" ON "store_memberships"("userId", "storeId");
CREATE INDEX "store_memberships_storeId_idx" ON "store_memberships"("storeId");
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "store_memberships" ("id", "userId", "storeId")
SELECT gen_random_uuid()::text, "id", "storeId" FROM "users"
ON CONFLICT ("userId", "storeId") DO NOTHING;

ALTER TABLE "store_memberships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_memberships_self_select" ON "store_memberships" FOR SELECT
  USING ("userId" = auth_user_id() OR auth_role() = 'OWNER');
CREATE POLICY "store_memberships_owner_manage" ON "store_memberships" FOR ALL
  USING (auth_role() = 'OWNER')
  WITH CHECK (auth_role() = 'OWNER');

CREATE OR REPLACE FUNCTION auth_can_access_store(target_store_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth_role() = 'OWNER' OR EXISTS (
    SELECT 1 FROM store_memberships sm
    JOIN users u ON u.id = sm."userId"
    WHERE u."authId" = auth.uid()::text AND sm."storeId" = target_store_id
  );
$$;

CREATE POLICY "stores_owner_or_membership_select" ON stores FOR SELECT
  USING (auth_can_access_store(id));
CREATE POLICY "stores_owner_insert" ON stores FOR INSERT WITH CHECK (auth_role() = 'OWNER');
CREATE POLICY "stores_owner_global_update" ON stores FOR UPDATE USING (auth_role() = 'OWNER');
CREATE POLICY "users_owner_or_membership_select" ON users FOR SELECT
  USING (auth_role() = 'OWNER' OR "storeId" = auth_store_id() OR EXISTS (
    SELECT 1 FROM store_memberships sm WHERE sm."userId" = users.id AND auth_can_access_store(sm."storeId")
  ));
CREATE POLICY "users_owner_global_insert" ON users FOR INSERT WITH CHECK (auth_role() = 'OWNER');
CREATE POLICY "users_owner_global_update" ON users FOR UPDATE USING (auth_role() = 'OWNER');
CREATE POLICY "purchase_batches_membership_select" ON purchase_batches FOR SELECT
  USING (auth_can_access_store("storeId"));
CREATE POLICY "purchase_batches_owner_membership_insert" ON purchase_batches FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "purchase_batches_owner_membership_update" ON purchase_batches FOR UPDATE
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "purchase_items_membership_select" ON purchase_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM purchase_batches pb WHERE pb.id = purchase_items."purchaseBatchId" AND auth_can_access_store(pb."storeId")));
CREATE POLICY "purchase_items_owner_membership_insert" ON purchase_items FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND EXISTS (SELECT 1 FROM purchase_batches pb WHERE pb.id = purchase_items."purchaseBatchId" AND auth_can_access_store(pb."storeId")));
CREATE POLICY "purchase_items_owner_membership_update" ON purchase_items FOR UPDATE
  USING (auth_role() = 'OWNER' AND EXISTS (SELECT 1 FROM purchase_batches pb WHERE pb.id = purchase_items."purchaseBatchId" AND auth_can_access_store(pb."storeId")));
CREATE POLICY "inventory_membership_select" ON inventory FOR SELECT
  USING (auth_can_access_store("storeId"));
CREATE POLICY "inventory_owner_membership_insert" ON inventory FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "inventory_membership_update" ON inventory FOR UPDATE
  USING (auth_can_access_store("storeId")) WITH CHECK (auth_can_access_store("storeId"));
CREATE POLICY "customers_membership_select" ON customers FOR SELECT
  USING (auth_can_access_store("storeId"));
CREATE POLICY "customers_membership_insert" ON customers FOR INSERT
  WITH CHECK (auth_can_access_store("storeId"));
CREATE POLICY "customers_membership_update" ON customers FOR UPDATE
  USING (auth_can_access_store("storeId")) WITH CHECK (auth_can_access_store("storeId"));
CREATE POLICY "sales_membership_select" ON sales FOR SELECT
  USING (auth_can_access_store("storeId") AND (auth_role() = 'OWNER' OR "soldById" = auth_user_id()));
CREATE POLICY "sales_membership_insert" ON sales FOR INSERT
  WITH CHECK (auth_can_access_store("storeId") AND "soldById" = auth_user_id());
CREATE POLICY "sales_owner_membership_update" ON sales FOR UPDATE
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "sale_items_membership_select" ON sale_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items."saleId" AND auth_can_access_store(s."storeId") AND (auth_role() = 'OWNER' OR s."soldById" = auth_user_id())));
CREATE POLICY "sale_items_membership_insert" ON sale_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items."saleId" AND auth_can_access_store(s."storeId") AND s."soldById" = auth_user_id()));
CREATE POLICY "sale_items_owner_membership_update" ON sale_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items."saleId" AND auth_role() = 'OWNER' AND auth_can_access_store(s."storeId")));
CREATE POLICY "payments_membership_select" ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = payments."saleId" AND auth_can_access_store(s."storeId")));
CREATE POLICY "payments_membership_insert" ON payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM sales s WHERE s.id = payments."saleId" AND auth_can_access_store(s."storeId") AND s."soldById" = auth_user_id()));
CREATE POLICY "expenses_owner_membership_select" ON expenses FOR SELECT
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "expenses_owner_membership_insert" ON expenses FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "settings_owner_membership_select" ON settings FOR SELECT
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "settings_owner_membership_update" ON settings FOR UPDATE
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "settings_owner_membership_insert" ON settings FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "audit_logs_owner_membership_select" ON audit_logs FOR SELECT
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "audit_logs_membership_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth_can_access_store("storeId"));
CREATE POLICY "stock_movements_membership_select" ON stock_movements FOR SELECT
  USING (auth_can_access_store("storeId"));
CREATE POLICY "stock_movements_membership_insert" ON stock_movements FOR INSERT
  WITH CHECK (auth_can_access_store("storeId"));
CREATE POLICY "suppliers_membership_select" ON suppliers FOR SELECT
  USING (auth_can_access_store("storeId"));
CREATE POLICY "suppliers_owner_membership_insert" ON suppliers FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "suppliers_owner_membership_update" ON suppliers FOR UPDATE
  USING (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));
CREATE POLICY "supplier_payments_membership_select" ON supplier_payments FOR SELECT
  USING (auth_can_access_store("storeId"));
CREATE POLICY "supplier_payments_owner_membership_insert" ON supplier_payments FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND auth_can_access_store("storeId"));

-- Bootstrap the requested second location for single-shop installations.
-- Additional shops remain unlimited and can be created from the Shops page.
DO $$
DECLARE new_store_id text;
BEGIN
  IF (SELECT COUNT(*) FROM stores) = 1
     AND NOT EXISTS (SELECT 1 FROM stores WHERE lower(name) = 'shop 2') THEN
    new_store_id := gen_random_uuid()::text;
    INSERT INTO stores (id, name, "createdAt", "updatedAt")
      VALUES (new_store_id, 'Shop 2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO settings (id, "storeId", "updatedAt")
      VALUES (gen_random_uuid()::text, new_store_id, CURRENT_TIMESTAMP);
  END IF;
END $$;

-- Products are the shared catalog (SKU is globally unique). Current price and
-- promotion history follows the product, while stock and transactions stay
-- scoped to each store.
CREATE POLICY "products_shared_authenticated_select" ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "price_history_shared_authenticated_select" ON product_price_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "promotions_shared_authenticated_select" ON promotions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Owners can manage shared master data from any assigned shop context.
CREATE POLICY "products_owner_global_insert" ON products FOR INSERT WITH CHECK (auth_role() = 'OWNER');
CREATE POLICY "products_owner_global_update" ON products FOR UPDATE USING (auth_role() = 'OWNER');
CREATE POLICY "products_owner_global_delete" ON products FOR DELETE USING (auth_role() = 'OWNER');
CREATE POLICY "price_history_owner_global_insert" ON product_price_history FOR INSERT WITH CHECK (auth_role() = 'OWNER');
CREATE POLICY "price_history_owner_global_update" ON product_price_history FOR UPDATE USING (auth_role() = 'OWNER');
CREATE POLICY "price_history_owner_global_delete" ON product_price_history FOR DELETE USING (auth_role() = 'OWNER');
CREATE POLICY "promotions_owner_global_insert" ON promotions FOR INSERT WITH CHECK (auth_role() = 'OWNER');
CREATE POLICY "promotions_owner_global_update" ON promotions FOR UPDATE USING (auth_role() = 'OWNER');
CREATE POLICY "promotions_owner_global_delete" ON promotions FOR DELETE USING (auth_role() = 'OWNER');

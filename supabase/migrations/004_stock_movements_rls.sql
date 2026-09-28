ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_store_select" ON stock_movements FOR SELECT USING ("storeId" = auth_store_id());
CREATE POLICY "stock_movements_authorized_insert" ON stock_movements FOR INSERT WITH CHECK (auth_role() IN ('OWNER','MANAGER') AND "storeId" = auth_store_id());

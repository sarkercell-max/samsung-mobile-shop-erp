-- Supplier tenancy policies. Run after supplier_payments and suppliers exist.
-- Preserve and link historical purchase supplier names to their store record.
INSERT INTO suppliers (id, "storeId", name, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, pb."storeId", pb."supplierName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM purchase_batches pb
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers s WHERE s."storeId" = pb."storeId" AND s.name = pb."supplierName"
);
UPDATE purchase_batches pb SET "supplierId" = s.id
FROM suppliers s WHERE s."storeId" = pb."storeId" AND s.name = pb."supplierName" AND pb."supplierId" IS NULL;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_store_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_update" ON suppliers;
DROP POLICY IF EXISTS "supplier_payments_store_select" ON supplier_payments;
DROP POLICY IF EXISTS "supplier_payments_owner_insert" ON supplier_payments;
CREATE POLICY "suppliers_store_select" ON suppliers FOR SELECT
  USING ("storeId" = auth_store_id());
CREATE POLICY "suppliers_owner_insert" ON suppliers FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND "storeId" = auth_store_id());
CREATE POLICY "suppliers_owner_update" ON suppliers FOR UPDATE
  USING (auth_role() = 'OWNER' AND "storeId" = auth_store_id());

CREATE POLICY "supplier_payments_store_select" ON supplier_payments FOR SELECT
  USING ("storeId" = auth_store_id() AND EXISTS (
    SELECT 1 FROM suppliers s WHERE s.id = supplier_payments."supplierId" AND s."storeId" = auth_store_id()
  ));
CREATE POLICY "supplier_payments_owner_insert" ON supplier_payments FOR INSERT
  WITH CHECK (auth_role() = 'OWNER' AND "storeId" = auth_store_id() AND EXISTS (
    SELECT 1 FROM suppliers s WHERE s.id = supplier_payments."supplierId" AND s."storeId" = auth_store_id()
  ));

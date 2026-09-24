CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "purchase_batches" ADD COLUMN "supplierId" TEXT;
INSERT INTO "suppliers" ("id", "storeId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "storeId", "supplierName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "storeId", "supplierName" FROM "purchase_batches") existing_suppliers;
UPDATE "purchase_batches" pb SET "supplierId" = s."id"
FROM "suppliers" s WHERE s."storeId" = pb."storeId" AND s."name" = pb."supplierName";

CREATE UNIQUE INDEX "suppliers_storeId_name_key" ON "suppliers"("storeId", "name");
CREATE INDEX "suppliers_storeId_idx" ON "suppliers"("storeId");
CREATE INDEX "supplier_payments_storeId_paymentDate_idx" ON "supplier_payments"("storeId", "paymentDate");
CREATE INDEX "supplier_payments_supplierId_paymentDate_idx" ON "supplier_payments"("supplierId", "paymentDate");
CREATE INDEX "purchase_batches_supplierId_idx" ON "purchase_batches"("supplierId");

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_batches" ADD CONSTRAINT "purchase_batches_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_store_select" ON suppliers FOR SELECT USING ("storeId" = auth_store_id());
CREATE POLICY "suppliers_owner_insert" ON suppliers FOR INSERT WITH CHECK (auth_role() = 'OWNER' AND "storeId" = auth_store_id());
CREATE POLICY "suppliers_owner_update" ON suppliers FOR UPDATE USING (auth_role() = 'OWNER' AND "storeId" = auth_store_id());
CREATE POLICY "supplier_payments_store_select" ON supplier_payments FOR SELECT USING ("storeId" = auth_store_id());
CREATE POLICY "supplier_payments_owner_insert" ON supplier_payments FOR INSERT WITH CHECK (auth_role() = 'OWNER' AND "storeId" = auth_store_id());


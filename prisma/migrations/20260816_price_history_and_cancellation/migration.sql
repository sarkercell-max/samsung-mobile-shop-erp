-- Additive, non-destructive migration.
-- Adds: purchase cancellation, customer archiving, and product price history.

-- 1. Purchase cancellation ---------------------------------------------------
CREATE TYPE "PurchaseStatus" AS ENUM ('RECEIVED', 'CANCELLED');

ALTER TABLE "purchase_batches"
  ADD COLUMN "status" "PurchaseStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "purchase_batches"
  ADD CONSTRAINT "purchase_batches_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "purchase_batches_status_idx" ON "purchase_batches"("status");

-- 2. Customer archiving -------------------------------------------------------
ALTER TABLE "customers" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 3. Product price history ----------------------------------------------------
ALTER TABLE "products" ADD COLUMN "defaultBuyingPrice" DECIMAL(12,2);

CREATE TABLE "product_price_history" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_price_history_storeId_productId_idx" ON "product_price_history"("storeId", "productId");
CREATE INDEX "product_price_history_productId_effectiveFrom_effectiveTo_idx" ON "product_price_history"("productId", "effectiveFrom", "effectiveTo");

ALTER TABLE "product_price_history"
  ADD CONSTRAINT "product_price_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "product_price_history_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: give every existing product a currently open price history
-- period so the "current price" lookup has data immediately.
INSERT INTO "product_price_history" ("id", "storeId", "productId", "purchasePrice", "salePrice", "effectiveFrom", "effectiveTo", "createdById", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."storeId",
  p."id",
  COALESCE(
    (SELECT AVG(i."buyingPrice") FROM "inventory" i WHERE i."productId" = p."id"),
    p."defaultSellingPrice" * 0.85
  ),
  p."defaultSellingPrice",
  p."createdAt",
  NULL,
  (SELECT u."id" FROM "users" u WHERE u."storeId" = p."storeId" AND u."role" = 'OWNER' ORDER BY u."createdAt" ASC LIMIT 1),
  now(),
  now()
FROM "products" p
WHERE EXISTS (SELECT 1 FROM "users" u WHERE u."storeId" = p."storeId" AND u."role" = 'OWNER');

UPDATE "products" p
SET "defaultBuyingPrice" = h."purchasePrice"
FROM "product_price_history" h
WHERE h."productId" = p."id" AND h."effectiveTo" IS NULL;

-- 4. New terminal inventory status for units whose purchase was voided
--    before ever being sold (additive enum value — non-destructive).
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

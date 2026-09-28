-- Additive stock tracking: no production rows are removed or rewritten.
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'DAMAGED';
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE','SALE','SALE_RETURN','PURCHASE_RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT','DAMAGE','LOSS');
ALTER TABLE "products" ADD COLUMN "minimumStock" INTEGER NOT NULL DEFAULT 5;
CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "inventoryId" TEXT,
  "movementType" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "previousStock" INTEGER NOT NULL,
  "newStock" INTEGER NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "batchId" TEXT,
  "reason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "purchase_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "stock_movements_storeId_createdAt_idx" ON "stock_movements"("storeId","createdAt");
CREATE INDEX "stock_movements_storeId_productId_createdAt_idx" ON "stock_movements"("storeId","productId","createdAt");
CREATE INDEX "stock_movements_batchId_idx" ON "stock_movements"("batchId");
CREATE INDEX "stock_movements_movementType_idx" ON "stock_movements"("movementType");
CREATE INDEX "stock_movements_inventoryId_idx" ON "stock_movements"("inventoryId");

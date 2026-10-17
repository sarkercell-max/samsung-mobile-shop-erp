ALTER TABLE "products" ADD COLUMN "productName" TEXT;
UPDATE "products"
SET "productName" = concat_ws(' ', "model", concat('(', "ram", '/', "storageCapacity", ')'), "color"),
    "model" = concat("model", ' (', "ram", '/', "storageCapacity", ')');
ALTER TABLE "products" ALTER COLUMN "productName" SET NOT NULL;
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_storeId_model_ram_storageCapacity_color_key";
ALTER TABLE "products" DROP COLUMN "ram";
ALTER TABLE "products" DROP COLUMN "storageCapacity";
ALTER TABLE "products" DROP COLUMN "color";
CREATE UNIQUE INDEX "products_storeId_productName_key" ON "products"("storeId", "productName");

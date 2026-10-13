-- Claim inventory in the sale-item trigger using one conditional UPDATE.
-- This keeps the database guard atomic under concurrent sale transactions.
CREATE OR REPLACE FUNCTION prevent_duplicate_imei_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE inventory
    SET status = 'SOLD', "updatedAt" = now()
    WHERE id = NEW."inventoryId" AND status = 'AVAILABLE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This IMEI has already been sold.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_inventory_sold ON sale_items;
DROP FUNCTION IF EXISTS mark_inventory_sold();

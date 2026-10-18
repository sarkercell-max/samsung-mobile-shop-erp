-- The previous product migration appended RAM/storage to the model even when
-- the model already contained it. Remove only that duplicated trailing pair.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "storeId",
        CASE
          WHEN "productName" ~ ' [(][0-9]+/[0-9]+[)]( [^()]*)$'
            THEN regexp_replace("productName", ' [(][0-9]+/[0-9]+[)]( [^()]*)$', '\1')
          ELSE "productName"
        END AS cleaned_name
      FROM "products"
    ) cleaned
    GROUP BY "storeId", cleaned_name
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Product name cleanup would create duplicate product names; resolve duplicates before applying this migration.';
  END IF;
END $$;

UPDATE "products"
SET
  "model" = regexp_replace("model", ' [(][0-9]+/[0-9]+[)]$', ''),
  "productName" = CASE
    WHEN "productName" ~ ' [(][0-9]+/[0-9]+[)]( [^()]*)$'
      THEN regexp_replace("productName", ' [(][0-9]+/[0-9]+[)]( [^()]*)$', '\1')
    ELSE "productName"
  END
WHERE "model" ~ ' [(][0-9]+/[0-9]+[)]$'
   OR "productName" ~ ' [(][0-9]+/[0-9]+[)]( [^()]*)$';

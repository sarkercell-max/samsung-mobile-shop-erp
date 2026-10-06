-- Explicit rate adjustments are owner-only, and remain scoped to the
-- authenticated owner's store when PostgreSQL RLS is active.
CREATE POLICY "sale_items_owner_rate_update" ON sale_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items."saleId"
        AND s."storeId" = auth_store_id()
        AND auth_role() = 'OWNER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items."saleId"
        AND s."storeId" = auth_store_id()
        AND auth_role() = 'OWNER'
    )
  );

CREATE POLICY "purchase_items_owner_rate_update" ON purchase_items FOR UPDATE
  USING (
    auth_role() = 'OWNER'
    AND EXISTS (
      SELECT 1 FROM purchase_batches pb
      WHERE pb.id = purchase_items."purchaseBatchId"
        AND pb."storeId" = auth_store_id()
        AND pb.status = 'RECEIVED'
    )
  )
  WITH CHECK (
    auth_role() = 'OWNER'
    AND EXISTS (
      SELECT 1 FROM purchase_batches pb
      WHERE pb.id = purchase_items."purchaseBatchId"
        AND pb."storeId" = auth_store_id()
        AND pb.status = 'RECEIVED'
    )
  );

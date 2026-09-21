import { z } from "zod";

export const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  imei: z.string().regex(/^\d{14,17}$/, "Invalid IMEI"),
  buyingPrice: z.coerce.number().positive(),
  sellingPrice: z.coerce.number().positive().optional(), // defaults to product price
  warrantyMonths: z.coerce.number().int().min(0).default(12),
});

export const createPurchaseBatchSchema = z
  .object({
    supplierName: z.string().min(1, "Supplier is required"),
    batchNumber: z.string().min(1, "Batch number is required"),
    purchaseDate: z.coerce.date(),
    remarks: z.string().optional(),
    items: z.array(purchaseItemSchema).min(1, "Add at least one IMEI"),
  })
  // Root-cause guard for the "purchase saved, phones missing from inventory"
  // report: a duplicate IMEI typo'd twice into the SAME batch would previously
  // reach the database and fail on the unique constraint deep inside the
  // transaction with an opaque error. Catching it here gives an immediate,
  // actionable validation message before any DB round-trip.
  .refine(
    (data) => new Set(data.items.map((i) => i.imei)).size === data.items.length,
    { message: "Duplicate IMEI within this purchase — each IMEI can only appear once per batch.", path: ["items"] }
  );

export type CreatePurchaseBatchInput = z.infer<typeof createPurchaseBatchSchema>;

export const cancelPurchaseBatchSchema = z.object({
  purchaseBatchId: z.string().uuid(),
  reason: z.string().min(1, "A cancellation reason is required"),
});
export type CancelPurchaseBatchInput = z.infer<typeof cancelPurchaseBatchSchema>;

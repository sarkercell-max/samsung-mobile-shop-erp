import { z } from "zod";

export const createProductSchema = z.object({
  brand: z.string().default("Samsung"),
  model: z.string().min(1, "Model is required"),
  ram: z.string().min(1, "RAM is required"),
  storageCapacity: z.string().min(1, "Storage is required"),
  color: z.string().min(1, "Color is required"),
  sku: z.string().min(1, "SKU is required"),
  // Empty/whitespace barcodes must be stored as NULL; the database enforces
  // uniqueness for non-NULL barcode values.
  barcode: z.string().optional().transform((value) => value?.trim() || undefined),
  defaultSellingPrice: z.coerce.number().positive("Sale price must be greater than 0"),
  defaultBuyingPrice: z.coerce.number().positive("Purchase price must be greater than 0"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

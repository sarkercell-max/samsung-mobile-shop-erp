import { z } from "zod";

export const createProductSchema = z.object({
  brand: z.string().default("Samsung"),
  productName: z.string().min(1, "Product Name is required"),
  model: z.string().min(1, "Model Name is required"),
  // Empty/whitespace barcodes must be stored as NULL; the database enforces
  // uniqueness for non-NULL barcode values.
  barcode: z.string().optional().transform((value) => value?.trim() || undefined),
  defaultSellingPrice: z.coerce.number().positive("Sale price must be greater than 0"),
  defaultBuyingPrice: z.coerce.number().positive("Purchase price must be greater than 0"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

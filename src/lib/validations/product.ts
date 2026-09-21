import { z } from "zod";

export const createProductSchema = z.object({
  brand: z.string().default("Samsung"),
  model: z.string().min(1, "Model is required"),
  ram: z.string().min(1, "RAM is required"),
  storageCapacity: z.string().min(1, "Storage is required"),
  color: z.string().min(1, "Color is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  defaultSellingPrice: z.coerce.number().positive("Sale price must be greater than 0"),
  defaultBuyingPrice: z.coerce.number().positive("Purchase price must be greater than 0"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

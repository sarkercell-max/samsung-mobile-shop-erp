import { z } from "zod";

export const createPricePeriodSchema = z.object({
  productId: z.string().uuid(),
  purchasePrice: z.coerce.number().positive("Purchase price must be greater than 0"),
  salePrice: z.coerce.number().positive("Sale price must be greater than 0"),
  effectiveFrom: z.coerce.date(),
});

export type CreatePricePeriodInput = z.infer<typeof createPricePeriodSchema>;

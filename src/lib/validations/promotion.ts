import { z } from "zod";

export const createPromotionSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  productId: z.string().uuid(),
  promoAmount: z.coerce.number().positive(),
  promoType: z.enum(["CASHBACK", "GIFT", "DEALER_INCENTIVE"]),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

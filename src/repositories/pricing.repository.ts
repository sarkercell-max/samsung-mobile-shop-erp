import { prisma } from "@/lib/prisma";

/**
 * Every read of "what is the price of this product right now" goes through
 * here. There is exactly one open period per product at a time
 * (effectiveTo IS NULL) — see pricing.actions.ts for how that invariant is
 * maintained when a new period is created.
 */
export const pricingRepository = {
  async getCurrentPeriod(storeId: string, productId: string) {
    return prisma.productPriceHistory.findFirst({
      where: { storeId, productId, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
    });
  },

  async getPeriodAt(storeId: string, productId: string, date: Date) {
    return prisma.productPriceHistory.findFirst({
      where: {
        storeId,
        productId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  },

  async listHistory(storeId: string, productId: string) {
    return prisma.productPriceHistory.findMany({
      where: { storeId, productId },
      orderBy: { effectiveFrom: "desc" },
    });
  },
};

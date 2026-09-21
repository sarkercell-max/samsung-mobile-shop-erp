"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Aggregates the 4 notification types from the spec: Low Stock, Promo
 *  Ending, Sold IMEI (duplicate-sale attempts are blocked inline, not
 *  queued here), Duplicate IMEI. Powers the topbar bell badge count. */
export async function getNotificationCount() {
  const user = await getCurrentUser();
  if (user.role !== "OWNER") return 0;

  const settings = await prisma.settings.findUnique({ where: { storeId: user.storeId } });
  const threshold = settings?.lowStockThreshold ?? 5;

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [lowStockCount, endingPromoCount] = await Promise.all([
    prisma.product.count({
      where: {
        storeId: user.storeId,
        isActive: true,
        inventory: { none: { status: "AVAILABLE" } }, // fully out — cheap first pass
      },
    }),
    prisma.promotion.count({
      where: { storeId: user.storeId, isActive: true, endDate: { gte: now, lte: soon } },
    }),
  ]);

  return lowStockCount + endingPromoCount;
}

"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createPromotionSchema, type CreatePromotionInput } from "@/lib/validations/promotion";
import { revalidatePath } from "next/cache";

export async function createPromotion(input: CreatePromotionInput) {
  const user = await requireOwner();
  const parsed = createPromotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const promo = await prisma.promotion.create({ data: { ...parsed.data, storeId: user.storeId } });

  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: "promotion.create", entityType: "Promotion", entityId: promo.id },
  });

  revalidatePath("/promotions");
  return { ok: true as const, data: promo };
}

export async function listPromotions() {
  const user = await requireOwner();
  return prisma.promotion.findMany({
    where: { storeId: user.storeId },
    include: { product: true },
    orderBy: { startDate: "desc" },
  });
}

export async function togglePromotion(promotionId: string, isActive: boolean) {
  const user = await requireOwner();
  await prisma.promotion.update({ where: { id: promotionId, storeId: user.storeId }, data: { isActive } });
  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: isActive ? "promotion.activate" : "promotion.deactivate", entityType: "Promotion", entityId: promotionId },
  });
  revalidatePath("/promotions");
  return { ok: true as const };
}

/**
 * Hard delete — only permitted when the promotion has never been applied to
 * a sale. A promotion that HAS been used can only be deactivated — its
 * historical sales keep their snapshotted promoAmount either way, but
 * keeping the row lets the Samsung Promo Report still show what it was.
 */
export async function deletePromotionIfUnused(promotionId: string) {
  const user = await requireOwner();
  const promo = await prisma.promotion.findFirst({ where: { id: promotionId, storeId: user.storeId } });
  if (!promo) return { ok: false as const, error: "Promotion not found." };

  const usageCount = await prisma.saleItem.count({ where: { promotionId } });
  if (usageCount > 0) {
    return { ok: false as const, error: `This promotion was applied to ${usageCount} sale(s) and cannot be deleted — deactivate it instead.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.promotion.delete({ where: { id: promotionId } });
    await tx.auditLog.create({
      data: { storeId: user.storeId, userId: user.id, action: "promotion.delete", entityType: "Promotion", entityId: promotionId, metadata: { productId: promo.productId, month: promo.month } },
    });
  });

  revalidatePath("/promotions");
  return { ok: true as const };
}

/** Promotions ending within the next 3 days — powers the "Promo Ending" notification. */
export async function getEndingSoonPromotions() {
  const user = await requireOwner();
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  return prisma.promotion.findMany({
    where: { storeId: user.storeId, isActive: true, endDate: { gte: now, lte: soon } },
    include: { product: true },
  });
}

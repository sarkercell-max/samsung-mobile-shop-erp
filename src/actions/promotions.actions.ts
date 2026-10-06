"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createPromotionSchema, type CreatePromotionInput } from "@/lib/validations/promotion";
import { revalidatePath } from "next/cache";

export async function createPromotion(input: CreatePromotionInput) {
  const user = await requireOwner();
  const parsed = createPromotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) return { ok: false as const, error: "Product not found." };
  const promo = await prisma.$transaction(async (tx) => {
    const overlapping = await tx.promotion.findMany({ where: { productId: product.id, isActive: true, startDate: { lte: parsed.data.endDate }, endDate: { gte: parsed.data.startDate } } });
    await tx.promotion.updateMany({ where: { id: { in: overlapping.map((row) => row.id) } }, data: { isActive: false } });
    const created = await tx.promotion.create({ data: { ...parsed.data, storeId: product.storeId } });
    await tx.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "global_promotion_update", entityType: "Promotion", entityId: created.id, metadata: {
      type: "Global Promotion Update", productId: product.id,
      oldValues: overlapping.map((row) => ({ promotionId: row.id, promoAmount: Number(row.promoAmount), promoType: row.promoType })),
      newValues: { promoAmount: parsed.data.promoAmount, promoType: parsed.data.promoType }, effectiveFrom: parsed.data.startDate,
    } } });
    return created;
  });

  revalidatePath("/promotions");
  revalidatePath("/sales/new");
  revalidatePath("/dashboard");
  return { ok: true as const, data: promo };
}

export async function listPromotions() {
  const user = await requireOwner();
  return prisma.promotion.findMany({
    include: { product: true },
    orderBy: { startDate: "desc" },
  });
}

export async function togglePromotion(promotionId: string, isActive: boolean) {
  const user = await requireOwner();
  const existing = await prisma.promotion.findUnique({ where: { id: promotionId } });
  if (!existing) return { ok: false as const, error: "Promotion not found." };
  await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.promotion.updateMany({ where: { productId: existing.productId, id: { not: existing.id }, isActive: true, startDate: { lte: existing.endDate }, endDate: { gte: existing.startDate } }, data: { isActive: false } });
    }
    await tx.promotion.update({ where: { id: promotionId }, data: { isActive } });
    await tx.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: isActive ? "promotion.activate" : "promotion.deactivate", entityType: "Promotion", entityId: promotionId } });
  });
  revalidatePath("/promotions");
  revalidatePath("/sales/new");
  revalidatePath("/dashboard");
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
  const promo = await prisma.promotion.findUnique({ where: { id: promotionId } });
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
      where: { isActive: true, endDate: { gte: now, lte: soon } },
    include: { product: true },
  });
}

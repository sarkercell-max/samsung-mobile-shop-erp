"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createPricePeriodSchema, type CreatePricePeriodInput } from "@/lib/validations/pricing";
import { pricingRepository } from "@/repositories/pricing.repository";
import { revalidatePath } from "next/cache";

/**
 * Opens a new price period for a product, effective from the given date.
 * NEVER edits or deletes an existing ProductPriceHistory row — only closes
 * the currently-open period and inserts a new open-ended one. Every
 * Inventory/SaleItem row created under the old period keeps whatever price
 * it already captured.
 */
export async function createPricePeriod(input: CreatePricePeriodInput) {
  const user = await requireOwner();
  const parsed = createPricePeriodSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const product = await prisma.product.findFirst({ where: { id: data.productId, storeId: user.storeId } });
  if (!product) return { ok: false as const, error: "Product not found." };

  const current = await pricingRepository.getCurrentPeriod(user.storeId, data.productId);

  if (current && data.effectiveFrom <= current.effectiveFrom) {
    return { ok: false as const, error: "New price period must start after the current period's start date to avoid overlapping history." };
  }

  const overlapping = await prisma.productPriceHistory.findFirst({
    where: {
      storeId: user.storeId,
      productId: data.productId,
      effectiveFrom: { lte: data.effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: data.effectiveFrom } }],
    },
  });
  if (overlapping && overlapping.id !== current?.id) {
    return { ok: false as const, error: "This date range overlaps an existing price period for this product." };
  }

  const result = await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.productPriceHistory.update({ where: { id: current.id }, data: { effectiveTo: data.effectiveFrom } });
    }

    const period = await tx.productPriceHistory.create({
      data: {
        storeId: user.storeId,
        productId: data.productId,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: null,
        createdById: user.id,
      },
    });

    await tx.product.update({
      where: { id: data.productId },
      data: { defaultSellingPrice: data.salePrice, defaultBuyingPrice: data.purchasePrice },
    });

    await tx.auditLog.create({
      data: {
        storeId: user.storeId, userId: user.id, action: "price.create_period",
        entityType: "ProductPriceHistory", entityId: period.id,
        metadata: { productId: data.productId, purchasePrice: data.purchasePrice, salePrice: data.salePrice, effectiveFrom: data.effectiveFrom },
      },
    });

    return period;
  });

  revalidatePath("/products");
  revalidatePath(`/products/${data.productId}/pricing`);
  return { ok: true as const, data: result };
}

export async function getCurrentPricing(productId: string) {
  const user = await requireOwner();
  const period = await pricingRepository.getCurrentPeriod(user.storeId, productId);
  return period
    ? { purchasePrice: Number(period.purchasePrice), salePrice: Number(period.salePrice), effectiveFrom: period.effectiveFrom }
    : null;
}

export async function listPriceHistory(productId: string) {
  const user = await requireOwner();
  const rows = await pricingRepository.listHistory(user.storeId, productId);
  return rows.map((r) => ({
    id: r.id,
    purchasePrice: Number(r.purchasePrice),
    salePrice: Number(r.salePrice),
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));
}

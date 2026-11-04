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

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) return { ok: false as const, error: "Product not found." };

  // Product colors are separate catalog rows, but the model price is shared.
  const variants = await prisma.product.findMany({
    where: { model: product.model, deletedAt: null, isActive: true },
    select: { id: true, storeId: true },
  });
  const variantIds = variants.map((variant) => variant.id);
  const currentPeriods = await prisma.productPriceHistory.findMany({
    where: { productId: { in: variantIds }, effectiveTo: null },
  });
  if (currentPeriods.some((period) => data.effectiveFrom <= period.effectiveFrom)) {
    return { ok: false as const, error: "Effective date must be after the current price start date for every variant." };
  }

  const overlapping = await prisma.productPriceHistory.findMany({
    where: {
      productId: { in: variantIds },
      effectiveFrom: { lte: data.effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: data.effectiveFrom } }],
    },
  });
  if (overlapping.some((row) => !currentPeriods.some((period) => period.id === row.id))) {
    return { ok: false as const, error: "This effective date overlaps an existing price period for one of the model variants." };
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const current of currentPeriods) {
      await tx.productPriceHistory.update({ where: { id: current.id }, data: { effectiveTo: data.effectiveFrom } });
    }

    const periods = await Promise.all(variants.map((variant) => tx.productPriceHistory.create({
      data: {
        storeId: variant.storeId,
        productId: variant.id,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: null,
        createdById: user.id,
      },
    })));

    await tx.product.updateMany({
      where: { id: { in: variantIds } },
      data: { defaultSellingPrice: data.salePrice, defaultBuyingPrice: data.purchasePrice },
    });

    await tx.auditLog.create({
      data: {
        storeId: user.storeId, userId: user.id, action: "global_rate_update",
        entityType: "ProductPriceHistory", entityId: periods[0]?.id,
        metadata: {
          type: "Model Rate Update", model: product.model, productIds: variantIds, affectedVariantCount: variants.length,
          oldValues: currentPeriods.length ? { purchasePrice: Number(currentPeriods[0]!.purchasePrice), salePrice: Number(currentPeriods[0]!.salePrice) } : null,
          newValues: { purchasePrice: data.purchasePrice, salePrice: data.salePrice },
          effectiveFrom: data.effectiveFrom,
        },
      },
    });

    return periods[0];
  });

  revalidatePath("/products");
  revalidatePath(`/products/${data.productId}/pricing`);
  for (const variant of variants) revalidatePath(`/products/${variant.id}/pricing`);
  revalidatePath("/purchase"); revalidatePath("/sales/new"); revalidatePath("/inventory"); revalidatePath("/dashboard");
  return { ok: true as const, data: result, affectedVariantCount: variants.length };
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

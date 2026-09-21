"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner, getCurrentUser } from "@/lib/auth";
import { createProductSchema, type CreateProductInput } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";

/**
 * Creating a product opens its first price period in the same transaction,
 * so `product_price_history` is always the source of truth for price —
 * Product.default* fields exist purely as a denormalized cache, never a
 * second place prices get entered independently.
 */
export async function createProduct(input: CreateProductInput) {
  const user = await requireOwner();
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
  if (existing) return { ok: false as const, error: "SKU already exists." };

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...parsed.data, storeId: user.storeId } });
    await tx.productPriceHistory.create({
      data: {
        storeId: user.storeId,
        productId: created.id,
        purchasePrice: parsed.data.defaultBuyingPrice,
        salePrice: parsed.data.defaultSellingPrice,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdById: user.id,
      },
    });
    return created;
  });

  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: "product.create", entityType: "Product", entityId: product.id },
  });

  revalidatePath("/products");
  return { ok: true as const, data: product };
}

// NOTE: direct in-place price mutation has been superseded by
// `createPricePeriod` in pricing.actions.ts, which preserves price history
// instead of silently overwriting the current price with no record of what
// it used to be. Do not reintroduce a raw `product.update({ defaultSellingPrice })`
// path outside of that action.

export async function listProducts() {
  const user = await getCurrentUser();
  return prisma.product.findMany({ where: { storeId: user.storeId, deletedAt: null }, orderBy: { model: "asc" } });
}

/** Soft-archive: hides the product from active pickers without touching
 *  any historical purchase/sale/inventory data that references it. */
export async function deactivateProduct(productId: string) {
  const user = await requireOwner();
  await prisma.product.update({ where: { id: productId, storeId: user.storeId }, data: { isActive: false } });
  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: "product.deactivate", entityType: "Product", entityId: productId },
  });
  revalidatePath("/products");
  return { ok: true as const };
}

export async function reactivateProduct(productId: string) {
  const user = await requireOwner();
  await prisma.product.update({ where: { id: productId, storeId: user.storeId }, data: { isActive: true } });
  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: "product.reactivate", entityType: "Product", entityId: productId },
  });
  revalidatePath("/products");
  return { ok: true as const };
}

/**
 * Hard delete — only permitted when the product has NEVER been referenced
 * by a purchase, a sale, or any inventory unit. The moment any of those
 * exist, this rejects and the Owner must use `deactivateProduct` instead.
 */
export async function deleteProductIfUnused(productId: string) {
  const user = await requireOwner();
  const product = await prisma.product.findFirst({ where: { id: productId, storeId: user.storeId } });
  if (!product) return { ok: false as const, error: "Product not found." };

  const [purchaseCount, inventoryCount, saleCount, promoCount] = await Promise.all([
    prisma.purchaseItem.count({ where: { productId } }),
    prisma.inventory.count({ where: { productId } }),
    prisma.saleItem.count({ where: { productId } }),
    prisma.promotion.count({ where: { productId } }),
  ]);

  if (purchaseCount > 0 || inventoryCount > 0 || saleCount > 0 || promoCount > 0) {
    return {
      ok: false as const,
      error: "This product has purchase, inventory, sale, or promotion history and cannot be deleted — use Archive instead.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.productPriceHistory.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
    await tx.auditLog.create({
      data: { storeId: user.storeId, userId: user.id, action: "product.delete", entityType: "Product", entityId: productId, metadata: { sku: product.sku, model: product.model } },
    });
  });

  revalidatePath("/products");
  return { ok: true as const };
}

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

export async function listProducts(includeArchived = false) {
  const user = await getCurrentUser();
  if (includeArchived && user.role !== "OWNER") throw new Error("Only the Owner can show archived products.");
  return prisma.product.findMany({ where: { deletedAt: null, ...(includeArchived ? {} : { isActive: true }) }, orderBy: { model: "asc" } });
}

/** Store-scoped product master export; never includes stock or transaction rows. */
export async function exportProducts(ids?: string[]) {
  const user = await requireOwner();
  const rows = await prisma.product.findMany({
    where: { deletedAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    orderBy: { model: "asc" },
    include: { priceHistory: { where: { effectiveTo: null }, take: 1 } },
  });
  await prisma.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "product.export", entityType: "Product", metadata: { count: rows.length, selected: Boolean(ids?.length) } } });
  return rows.map((p) => ({
    SKU: p.sku, Brand: p.brand, Model: p.model, RAM: p.ram, Storage: p.storageCapacity,
    Color: p.color, Barcode: p.barcode ?? "", "Purchase Price": p.priceHistory[0]?.purchasePrice.toString() ?? "",
    "Sale Price": p.priceHistory[0]?.salePrice.toString() ?? "", Status: p.isActive ? "Active" : "Archived",
    "Minimum Stock": p.minimumStock,
  }));
}

export type ProductImportRow = { rowNumber: number; brand: string; model: string; ram: string; storageCapacity: string; color: string; sku: string; barcode?: string; defaultBuyingPrice: number; defaultSellingPrice: number };

/** Revalidates every imported value and writes only product master data. */
export async function importProducts(rows: ProductImportRow[], mode: "create" | "update" | "both") {
  const user = await requireOwner();
  if (!["create", "update", "both"].includes(mode)) return { ok: false as const, error: "Invalid import mode." };
  if (!Array.isArray(rows) || rows.length > 5000) return { ok: false as const, error: "Import must contain between 1 and 5,000 rows." };
  if (!rows.length) return { ok: false as const, error: "No valid rows to import." };
  if (rows.some((r) => !r || typeof r !== "object" || Object.values(r).some((v) => typeof v === "string" && v.length > 500))) return { ok: false as const, error: "An imported field is too long." };
  const created: string[] = [], updated: string[] = [];
  const globalRateChanges: Array<{ productId: string; sku: string; oldValues: { purchasePrice: number; salePrice: number } | null; newValues: { purchasePrice: number; salePrice: number }; effectiveFrom: Date }> = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const parsed = createProductSchema.safeParse({ ...row, brand: row.brand || "Samsung" });
        if (!parsed.success) throw new Error(`Row ${row.rowNumber}: ${parsed.error.issues[0]?.message ?? "Invalid product."}`);
        const data = parsed.data;
        const existing = await tx.product.findUnique({ where: { sku: data.sku } });
        if (existing && mode === "create") throw new Error(`Row ${row.rowNumber}: SKU ${data.sku} already exists.`);
        if (!existing && mode === "update") throw new Error(`Row ${row.rowNumber}: SKU ${data.sku} was not found for update.`);
        if (existing) {
          const current = await tx.productPriceHistory.findFirst({ where: { productId: existing.id, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
          await tx.product.update({ where: { id: existing.id }, data: { brand: data.brand, model: data.model, ram: data.ram, storageCapacity: data.storageCapacity, color: data.color, barcode: data.barcode || null } });
          if (!current || Number(current.purchasePrice) !== data.defaultBuyingPrice || Number(current.salePrice) !== data.defaultSellingPrice) {
            const effectiveFrom = new Date();
            if (current && effectiveFrom <= current.effectiveFrom) effectiveFrom.setTime(current.effectiveFrom.getTime() + 1000);
            globalRateChanges.push({ productId: existing.id, sku: data.sku, oldValues: current ? { purchasePrice: Number(current.purchasePrice), salePrice: Number(current.salePrice) } : null, newValues: { purchasePrice: data.defaultBuyingPrice, salePrice: data.defaultSellingPrice }, effectiveFrom });
            if (current) await tx.productPriceHistory.update({ where: { id: current.id }, data: { effectiveTo: effectiveFrom } });
            await tx.productPriceHistory.create({ data: { storeId: existing.storeId, productId: existing.id, purchasePrice: data.defaultBuyingPrice, salePrice: data.defaultSellingPrice, effectiveFrom, createdById: user.id } });
            await tx.product.update({ where: { id: existing.id }, data: { defaultBuyingPrice: data.defaultBuyingPrice, defaultSellingPrice: data.defaultSellingPrice } });
          }
          updated.push(data.sku);
        } else {
          const createdProduct = await tx.product.create({ data: { ...data, storeId: user.storeId } });
          const effectiveFrom = new Date();
          await tx.productPriceHistory.create({ data: { storeId: user.storeId, productId: createdProduct.id, purchasePrice: data.defaultBuyingPrice, salePrice: data.defaultSellingPrice, effectiveFrom, createdById: user.id } });
          globalRateChanges.push({ productId: createdProduct.id, sku: data.sku, oldValues: null, newValues: { purchasePrice: data.defaultBuyingPrice, salePrice: data.defaultSellingPrice }, effectiveFrom });
          created.push(data.sku);
        }
      }
      await tx.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "product.import", entityType: "Product", metadata: { created: created.length, updated: updated.length, globalRateChanges } } });
    }, { timeout: 30_000, maxWait: 10_000 });
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Product import failed." }; }
  revalidatePath("/products");
  return { ok: true as const, created: created.length, updated: updated.length };
}

/** Soft-archive: hides the product from active pickers without touching
 *  any historical purchase/sale/inventory data that references it. */
export async function deactivateProduct(productId: string) {
  const user = await requireOwner();
  await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: "product.deactivate", entityType: "Product", entityId: productId },
  });
  revalidatePath("/products");
  return { ok: true as const };
}

export async function reactivateProduct(productId: string) {
  const user = await requireOwner();
  await prisma.product.update({ where: { id: productId }, data: { isActive: true } });
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
  const product = await prisma.product.findUnique({ where: { id: productId } });
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

"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSaleRateComparison(saleItemId: string) {
  const user = await requireOwner();
  const item = await prisma.saleItem.findFirst({
    where: { id: saleItemId, sale: { storeId: user.storeId, deletedAt: null, status: "COMPLETED" } },
    include: { sale: true, product: true },
  });
  if (!item) return { ok: false as const, error: "Completed sale item not found." };
  const [period, promotion] = await Promise.all([
    prisma.productPriceHistory.findFirst({ where: { productId: item.productId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } }),
    prisma.promotion.findFirst({ where: { productId: item.productId, isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } }, orderBy: { startDate: "desc" } }),
  ]);
  return { ok: true as const, data: {
    saleId: item.saleId, invoiceNumber: item.sale.invoiceNumber, saleTotal: Number(item.sale.total), saleProfit: Number(item.sale.totalProfit), product: `${item.product.model} · ${item.product.ram}/${item.product.storageCapacity} · ${item.product.color}`,
    old: { purchase: Number(item.buyingPrice), sale: Number(item.sellingPrice), promotion: Number(item.promoAmount) },
    current: { purchase: Number(period?.purchasePrice ?? item.product.defaultBuyingPrice ?? item.buyingPrice), sale: Number(period?.salePrice ?? item.product.defaultSellingPrice), promotion: Number(promotion?.promoAmount ?? 0) },
  } };
}

export async function applySaleUpdatedRate(saleItemId: string, fields: { purchase?: boolean; sale?: boolean; promotion?: boolean }) {
  const user = await requireOwner();
  if (!fields.purchase && !fields.sale && !fields.promotion) return { ok: false as const, error: "Select at least one rate to update." };
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.saleItem.findFirst({ where: { id: saleItemId, sale: { storeId: user.storeId, deletedAt: null, status: "COMPLETED" } }, include: { sale: true, product: true, inventory: true } });
    if (!item) throw new Error("Completed sale item not found.");
    const now = new Date();
    const [period, promotion] = await Promise.all([
      tx.productPriceHistory.findFirst({ where: { productId: item.productId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } }),
      tx.promotion.findFirst({ where: { productId: item.productId, isActive: true, startDate: { lte: now }, endDate: { gte: now } }, orderBy: { startDate: "desc" } }),
    ]);
    const old = { purchase: Number(item.buyingPrice), sale: Number(item.sellingPrice), promotion: Number(item.promoAmount) };
    const next = {
      purchase: fields.purchase ? Number(period?.purchasePrice ?? item.product.defaultBuyingPrice ?? item.buyingPrice) : old.purchase,
      sale: fields.sale ? Number(period?.salePrice ?? item.product.defaultSellingPrice) : old.sale,
      promotion: fields.promotion ? Number(promotion?.promoAmount ?? 0) : old.promotion,
    };
    const profit = next.sale - next.purchase + next.promotion - Number(item.discount);
    await tx.saleItem.update({ where: { id: item.id }, data: {
      buyingPrice: next.purchase, sellingPrice: next.sale, promoAmount: next.promotion, profit,
      ...(fields.promotion ? { promotionId: promotion?.id ?? null } : {}),
    } });
    const items = await tx.saleItem.findMany({ where: { saleId: item.saleId } });
    const subtotal = items.reduce((sum, row) => sum + Number(row.sellingPrice), 0);
    const promoAmount = items.reduce((sum, row) => sum + Number(row.promoAmount), 0);
    const discount = items.reduce((sum, row) => sum + Number(row.discount), 0);
    const totalProfit = items.reduce((sum, row) => sum + Number(row.profit), 0);
    await tx.sale.update({ where: { id: item.saleId }, data: { subtotal, promoAmount, discount, total: Math.max(subtotal - promoAmount - discount, 0), totalProfit } });
    const changes = Object.fromEntries((Object.keys(fields) as Array<keyof typeof old>).filter((key) => fields[key]).map((key) => [key, { old: old[key], new: next[key] }]));
    await tx.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "transaction.rate_adjustment", entityType: "SaleItem", entityId: item.id, metadata: { type: "Transaction Rate Adjustment", saleId: item.saleId, saleItemId: item.id, invoiceNumber: item.sale.invoiceNumber, productId: item.productId, storeId: user.storeId, changes } } });
    return { saleId: item.saleId, fields: Object.keys(changes) };
  });
  revalidatePath(`/sales/${result.saleId}`); revalidatePath(`/invoice/${result.saleId}`); revalidatePath("/sales"); revalidatePath("/dashboard"); revalidatePath("/reports"); revalidatePath("/customers");
  return { ok: true as const, data: result };
}

export async function getPurchaseRateComparison(purchaseItemId: string) {
  const user = await requireOwner();
  const item = await prisma.purchaseItem.findFirst({ where: { id: purchaseItemId, purchaseBatch: { storeId: user.storeId, status: "RECEIVED" } }, include: { product: true, purchaseBatch: true } });
  if (!item) return { ok: false as const, error: "Purchase item not found." };
  const period = await prisma.productPriceHistory.findFirst({ where: { productId: item.productId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
  return { ok: true as const, data: { old: Number(item.buyingPrice), current: Number(period?.purchasePrice ?? item.product.defaultBuyingPrice ?? item.buyingPrice), purchaseNumber: item.purchaseBatch.purchaseNumber, product: `${item.product.model} · ${item.product.ram}/${item.product.storageCapacity}`, imei: item.imei } };
}

export async function applyPurchaseUpdatedRate(purchaseItemId: string) {
  const user = await requireOwner();
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.purchaseItem.findFirst({ where: { id: purchaseItemId, purchaseBatch: { storeId: user.storeId, status: "RECEIVED" } }, include: { product: true, inventory: true, purchaseBatch: true } });
    if (!item) throw new Error("Purchase item not found.");
    const period = await tx.productPriceHistory.findFirst({ where: { productId: item.productId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    const oldValue = Number(item.buyingPrice);
    const newValue = Number(period?.purchasePrice ?? item.product.defaultBuyingPrice ?? item.buyingPrice);
    await tx.purchaseItem.update({ where: { id: item.id }, data: { buyingPrice: newValue } });
    // Keep the inventory cost snapshot aligned for unsold stock only. Sold-sale cost remains its own immutable snapshot.
    if (item.inventory?.status === "AVAILABLE") await tx.inventory.update({ where: { id: item.inventory.id }, data: { buyingPrice: newValue } });
    await tx.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "transaction.rate_adjustment", entityType: "PurchaseItem", entityId: item.id, metadata: { type: "Transaction Rate Adjustment", purchaseBatchId: item.purchaseBatchId, purchaseItemId: item.id, purchaseNumber: item.purchaseBatch.purchaseNumber, productId: item.productId, storeId: user.storeId, imei: item.imei, changes: { purchase: { old: oldValue, new: newValue } } } } });
    return { purchaseBatchId: item.purchaseBatchId };
  });
  revalidatePath("/purchase"); revalidatePath("/inventory"); revalidatePath("/reports"); revalidatePath("/dashboard");
  return { ok: true as const, data: result };
}

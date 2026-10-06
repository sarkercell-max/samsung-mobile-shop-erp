"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { InventoryStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function listInventory(status?: InventoryStatus, query?: string) {
  const user = await getCurrentUser();
  return prisma.inventory.findMany({
    where: {
      storeId: user.storeId,
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { imei: { contains: query } },
              { product: { model: { contains: query, mode: "insensitive" } } },
              { product: { sku: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getStockValue() {
  const user = await getCurrentUser();
  const available = await prisma.inventory.findMany({
    where: { storeId: user.storeId, status: "AVAILABLE" },
    select: { buyingPrice: true, product: { select: { defaultSellingPrice: true } } },
  });
  return {
    unitCount: available.length,
    stockValueAtCost: available.reduce((sum, item) => sum + Number(item.buyingPrice), 0),
    stockValueAtSelling: available.reduce((sum, item) => sum + Number(item.product.defaultSellingPrice), 0),
  };
}

export async function getStockOverview() {
  const user = await getCurrentUser();
  const products = await prisma.product.findMany({ where: { deletedAt: null, isActive: true }, include: { inventory: { where: { storeId: user.storeId }, select: { status: true, buyingPrice: true, sellingPrice: true, createdAt: true, saleItem: { select: { sellingPrice: true } } } } }, orderBy: { model: "asc" } });
  return products.map((p) => {
    const units = p.inventory;
    const available = units.filter((i) => i.status === "AVAILABLE");
    return { id: p.id, model: p.model, variant: `${p.ram}/${p.storageCapacity} · ${p.color}`, current: units.filter((i) => ["AVAILABLE", "RESERVED", "RETURNED", "DAMAGED"].includes(i.status)).length, available: available.length, sold: units.filter((i) => i.status === "SOLD").length, purchased: units.filter((i) => i.status !== "CANCELLED").length, returned: units.filter((i) => i.status === "RETURNED").length, damaged: units.filter((i) => i.status === "DAMAGED").length, reserved: units.filter((i) => i.status === "RESERVED").length, value: available.reduce((n, i) => n + Number(i.buyingPrice), 0), purchaseCost: Number(p.defaultBuyingPrice ?? 0), sellingPrice: Number(p.defaultSellingPrice), lastPurchasePrice: units.length ? Number([...units].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0]!.buyingPrice) : 0, lastSalePrice: Number([...units].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).find((i)=>i.saleItem)?.saleItem?.sellingPrice ?? 0), lowAt: p.minimumStock, low: available.length <= p.minimumStock };
  });
}

export async function listStockMovements(query?: { q?: string; type?: string; page?: number }) {
  const user = await getCurrentUser();
  const page = Math.max(1, query?.page ?? 1);
  const where: Prisma.StockMovementWhereInput = { storeId: user.storeId, ...(query?.type ? { movementType: query.type as never } : {}), ...(query?.q ? { OR: [{ product: { model: { contains: query.q, mode: "insensitive" } } }, { inventory: { imei: { contains: query.q } } }, { reason: { contains: query.q, mode: "insensitive" } }] } : {}) };
  const [rows, total] = await Promise.all([prisma.stockMovement.findMany({ where, include: { product: true, inventory: true, createdBy: { select: { name: true } }, batch: { select: { batchNumber: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }), prisma.stockMovement.count({ where })]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / 50)) };
}

export async function adjustStock(input: { inventoryId: string; type: "DAMAGE" | "LOSS"; reason: string }) {
  const user = await requireOwner();
  if (!input.reason?.trim()) return { ok: false as const, error: "A reason is required." };
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.inventory.findFirst({ where: { id: input.inventoryId, storeId: user.storeId, status: "AVAILABLE" } });
    if (!item) throw new Error("This unit is not available for adjustment.");
    const previousStock = await tx.inventory.count({ where: { storeId: user.storeId, productId: item.productId, status: "AVAILABLE" } });
    const nextStatus = input.type === "DAMAGE" ? InventoryStatus.DAMAGED : InventoryStatus.LOST;
    await tx.inventory.update({ where: { id: item.id }, data: { status: nextStatus } });
    await tx.stockMovement.create({ data: { storeId: user.storeId, productId: item.productId, inventoryId: item.id, movementType: input.type, quantity: -1, previousStock, newStock: previousStock - 1, referenceType: "Inventory", referenceId: item.id, reason: input.reason.trim(), createdById: user.id } });
    await tx.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: input.type === "DAMAGE" ? "stock.mark_damaged" : "stock.mark_lost", entityType: "Inventory", entityId: item.id, metadata: { previousStock, newStock: previousStock - 1, reason: input.reason.trim() } } });
  });
  revalidatePath("/inventory"); revalidatePath("/inventory/movements");
  return { ok: true as const, data: result };
}

export async function markInventoryLost(inventoryId: string, remarks?: string) {
  const user = await requireOwner();
  await prisma.inventory.update({ where: { id: inventoryId, storeId: user.storeId }, data: { status: "LOST" } });
  await prisma.auditLog.create({
    data: { storeId: user.storeId, userId: user.id, action: "inventory.mark_lost", entityType: "Inventory", entityId: inventoryId, metadata: { remarks } },
  });
  revalidatePath("/inventory");
  return { ok: true as const };
}

export async function reserveInventory(inventoryId: string) {
  const user = await getCurrentUser();
  await prisma.inventory.update({
    where: { id: inventoryId, storeId: user.storeId, status: "AVAILABLE" },
    data: { status: "RESERVED" },
  });
  revalidatePath("/inventory");
  return { ok: true as const };
}

/** Powers the "Low Stock" notification/report — groups AVAILABLE units by model. */
export async function getLowStockModels(threshold = 5) {
  const user = await getCurrentUser();
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { _count: { select: { inventory: { where: { storeId: user.storeId, status: "AVAILABLE" } } } } },
  });
  return products
    .map((p) => ({ product: p, availableCount: p._count.inventory }))
    .filter((p) => p.availableCount <= threshold)
    .sort((a, b) => a.availableCount - b.availableCount);
}

/** Dead stock: AVAILABLE units older than N days with zero sales velocity. */
export async function getDeadStock(days = 60) {
  const user = await requireOwner();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.inventory.findMany({
    where: { storeId: user.storeId, status: "AVAILABLE", createdAt: { lte: cutoff } },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });
}

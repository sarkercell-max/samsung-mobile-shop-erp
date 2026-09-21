"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { InventoryStatus } from "@prisma/client";
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
  const available = await prisma.inventory.aggregate({
    where: { storeId: user.storeId, status: "AVAILABLE" },
    _sum: { buyingPrice: true, sellingPrice: true },
    _count: { _all: true },
  });
  return {
    unitCount: available._count._all,
    stockValueAtCost: Number(available._sum.buyingPrice ?? 0),
    stockValueAtSelling: Number(available._sum.sellingPrice ?? 0),
  };
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
    where: { storeId: user.storeId, isActive: true },
    include: { _count: { select: { inventory: { where: { status: "AVAILABLE" } } } } },
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

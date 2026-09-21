import { prisma } from "@/lib/prisma";
import { InventoryStatus } from "@prisma/client";

/**
 * All read/write access to the `inventory` table goes through here —
 * this is the single source of truth for "is this IMEI available?".
 */
export const inventoryRepository = {
  /** Core lookup that powers the IMEI auto-fill on the sales screen. */
  async findByImei(storeId: string, imei: string) {
    return prisma.inventory.findFirst({
      where: { storeId, imei },
      include: {
        product: true,
      },
    });
  },

  async findAvailableByImei(storeId: string, imei: string) {
    return prisma.inventory.findFirst({
      where: { storeId, imei, status: InventoryStatus.AVAILABLE },
      include: { product: true },
    });
  },

  async listByStatus(storeId: string, status: InventoryStatus) {
    return prisma.inventory.findMany({
      where: { storeId, status },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async lowStockByModel(storeId: string, threshold: number) {
    const grouped = await prisma.inventory.groupBy({
      by: ["productId"],
      where: { storeId, status: InventoryStatus.AVAILABLE },
      _count: { _all: true },
    });
    return grouped.filter((g) => g._count._all <= threshold);
  },

  async markSold(inventoryId: string) {
    return prisma.inventory.update({
      where: { id: inventoryId },
      data: { status: InventoryStatus.SOLD },
    });
  },

  async markReturned(inventoryId: string) {
    return prisma.inventory.update({
      where: { id: inventoryId },
      data: { status: InventoryStatus.RETURNED },
    });
  },
};

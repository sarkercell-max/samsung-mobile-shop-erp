import { prisma } from "@/lib/prisma";

export const saleRepository = {
  async findById(storeId: string, id: string) {
    return prisma.sale.findFirst({
      where: { storeId, id },
      include: {
        customer: true,
        soldBy: true,
        items: { include: { product: true, inventory: true, promotion: true } },
        payments: true,
      },
    });
  },

  async listForStore(storeId: string, opts?: { soldById?: string; take?: number; skip?: number }) {
    return prisma.sale.findMany({
      where: { storeId, deletedAt: null, ...(opts?.soldById ? { soldById: opts.soldById } : {}) },
      include: { customer: true, soldBy: true, items: true },
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    });
  },

  async todaysSalesTotal(storeId: string, soldById?: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await prisma.sale.aggregate({
      where: {
        storeId,
        deletedAt: null,
        createdAt: { gte: startOfDay },
        ...(soldById ? { soldById } : {}),
      },
      _sum: { total: true, totalProfit: true },
      _count: { _all: true },
    });
    return result;
  },
};

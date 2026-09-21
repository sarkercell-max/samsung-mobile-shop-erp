import { prisma } from "@/lib/prisma";

export const productRepository = {
  async list(storeId: string) {
    return prisma.product.findMany({
      where: { storeId, deletedAt: null },
      orderBy: { model: "asc" },
    });
  },

  async findById(storeId: string, id: string) {
    return prisma.product.findFirst({ where: { storeId, id } });
  },

  async create(storeId: string, data: Omit<Parameters<typeof prisma.product.create>[0]["data"], "storeId" | "store">) {
    return prisma.product.create({ data: { ...data, storeId } as never });
  },
};

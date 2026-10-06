import { prisma } from "@/lib/prisma";

export const productRepository = {
  async list(_storeId: string) {
    return prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { model: "asc" },
    });
  },

  async findById(_storeId: string, id: string) {
    return prisma.product.findUnique({ where: { id } });
  },

  async create(storeId: string, data: Omit<Parameters<typeof prisma.product.create>[0]["data"], "storeId" | "store">) {
    return prisma.product.create({ data: { ...data, storeId } as never });
  },
};

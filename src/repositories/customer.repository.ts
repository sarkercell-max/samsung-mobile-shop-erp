import { prisma } from "@/lib/prisma";

export const customerRepository = {
  /** Powers the "auto fill name/address on phone number entry" logic. */
  async findByPhone(storeId: string, phone: string) {
    return prisma.customer.findUnique({
      where: { storeId_phone: { storeId, phone } },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { items: { include: { product: true } } },
        },
      },
    });
  },

  async create(storeId: string, data: { phone: string; name: string; address?: string; email?: string }) {
    return prisma.customer.create({ data: { storeId, ...data } });
  },

  async findOrCreate(storeId: string, data: { phone: string; name: string; address?: string; email?: string }) {
    const existing = await this.findByPhone(storeId, data.phone);
    if (existing) return existing;
    return this.create(storeId, data);
  },
};

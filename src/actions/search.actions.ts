"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Universal search across IMEI, phone, invoice, customer name, and model —
 *  powers the global search bar available to both roles. */
export async function globalSearch(query: string) {
  const user = await getCurrentUser();
  if (query.trim().length < 2) return { inventory: [], customers: [], sales: [], products: [] };

  const [inventory, customers, sales, products] = await Promise.all([
    prisma.inventory.findMany({
      where: { storeId: user.storeId, imei: { contains: query } },
      include: { product: true },
      take: 10,
    }),
    prisma.customer.findMany({
      where: { storeId: user.storeId, OR: [{ phone: { contains: query } }, { name: { contains: query, mode: "insensitive" } }] },
      take: 10,
    }),
    prisma.sale.findMany({
      where: {
        storeId: user.storeId,
        deletedAt: null,
        invoiceNumber: { contains: query, mode: "insensitive" },
        ...(user.role === "MANAGER" ? { soldById: user.id } : {}),
      },
      include: { customer: true },
      take: 10,
    }),
    prisma.product.findMany({
      where: { storeId: user.storeId, model: { contains: query, mode: "insensitive" } },
      take: 10,
    }),
  ]);

  return { inventory, customers, sales, products };
}

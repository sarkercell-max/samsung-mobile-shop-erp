"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { createCustomerSchema, type CreateCustomerInput } from "@/lib/validations/customer";
import { revalidatePath } from "next/cache";

export async function createCustomer(input: CreateCustomerInput) {
  const user = await getCurrentUser();
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId: user.storeId, phone: parsed.data.phone } },
  });
  if (existing) return { ok: false as const, error: "A customer with this phone number already exists." };

  const customer = await prisma.customer.create({
    data: { storeId: user.storeId, ...parsed.data, email: parsed.data.email || undefined },
  });

  revalidatePath("/customers");
  return { ok: true as const, data: customer };
}

export async function listCustomers(query?: string) {
  const user = await getCurrentUser();
  return prisma.customer.findMany({
    where: {
      storeId: user.storeId,
      deletedAt: null,
      ...(query ? { OR: [{ phone: { contains: query } }, { name: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * Archive (soft-delete) a customer — Owner-only, and only permitted when
 * the customer has zero sales history, since sales.customerId would
 * otherwise point at a vanished/inconsistent record.
 */
export async function archiveCustomer(customerId: string) {
  const user = await requireOwner();
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId: user.storeId } });
  if (!customer) return { ok: false as const, error: "Customer not found." };

  const saleCount = await prisma.sale.count({ where: { customerId } });
  if (saleCount > 0) {
    return { ok: false as const, error: `This customer has ${saleCount} sale(s) on record and cannot be deleted.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: customerId }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({
      data: { storeId: user.storeId, userId: user.id, action: "customer.archive", entityType: "Customer", entityId: customerId, metadata: { phone: customer.phone } },
    });
  });

  revalidatePath("/customers");
  return { ok: true as const };
}

export async function getCustomerDetail(customerId: string) {
  const user = await getCurrentUser();
  return prisma.customer.findFirst({
    where: { id: customerId, storeId: user.storeId },
    include: { sales: { include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" } } },
  });
}

import type { Prisma } from "@prisma/client";

// Re-export enums for convenient client-side imports without pulling in
// the full @prisma/client runtime.
export type { UserRole, InventoryStatus, PaymentMethod, PromoType, ExpenseCategory, SaleStatus } from "@prisma/client";

export type SaleWithDetails = Prisma.SaleGetPayload<{
  include: { customer: true; soldBy: true; items: { include: { product: true; inventory: true; promotion: true } }; payments: true };
}>;

export type InventoryWithProduct = Prisma.InventoryGetPayload<{ include: { product: true } }>;

export type CustomerWithSales = Prisma.CustomerGetPayload<{
  include: { sales: { include: { items: { include: { product: true } } } } };
}>;

/** Server action result convention used across every action in /src/actions. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

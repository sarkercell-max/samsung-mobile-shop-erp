"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const supplierPaymentSchema = z.object({
  supplierId: z.string().uuid(), amount: z.coerce.number().positive(), paymentDate: z.coerce.date(),
  paymentMethod: z.nativeEnum(PaymentMethod), reference: z.string().optional(), note: z.string().optional(),
});

export async function getSuppliers() {
  const user = await requireOwner();
  const suppliers = await prisma.supplier.findMany({ where: { storeId: user.storeId }, orderBy: { name: "asc" } });
  const result = await Promise.all(suppliers.map(async (supplier) => {
    const [purchases, payments, lastPayment] = await Promise.all([
      prisma.purchaseItem.aggregate({ where: { purchaseBatch: { storeId: user.storeId, supplierId: supplier.id, status: "RECEIVED" } }, _sum: { buyingPrice: true } }),
      prisma.supplierPayment.aggregate({ where: { storeId: user.storeId, supplierId: supplier.id }, _sum: { amount: true } }),
      prisma.supplierPayment.findFirst({ where: { storeId: user.storeId, supplierId: supplier.id }, orderBy: { paymentDate: "desc" } }),
    ]);
    const totalPurchase = Number(purchases._sum.buyingPrice ?? 0);
    const totalPaid = Number(payments._sum.amount ?? 0);
    return { ...supplier, totalPurchase, totalPaid, totalDue: totalPurchase - totalPaid, lastPaymentDate: lastPayment?.paymentDate ?? null };
  }));
  return result;
}

export async function getSupplierDetail(supplierId: string) {
  const user = await requireOwner();
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId: user.storeId } });
  if (!supplier) return null;
  const [purchases, payments, paymentHistory] = await Promise.all([
    prisma.purchaseItem.aggregate({ where: { purchaseBatch: { storeId: user.storeId, supplierId, status: "RECEIVED" } }, _sum: { buyingPrice: true } }),
    prisma.supplierPayment.aggregate({ where: { storeId: user.storeId, supplierId }, _sum: { amount: true } }),
    prisma.supplierPayment.findMany({ where: { storeId: user.storeId, supplierId }, include: { createdBy: { select: { name: true } } }, orderBy: { paymentDate: "desc" } }),
  ]);
  const totalPurchase = Number(purchases._sum.buyingPrice ?? 0);
  const totalPaid = Number(payments._sum.amount ?? 0);
  return { supplier, totalPurchase, totalPaid, totalDue: totalPurchase - totalPaid, paymentHistory };
}

export async function recordSupplierPayment(input: unknown) {
  const user = await requireOwner();
  const parsed = supplierPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payment." };
  const data = parsed.data;
  const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, storeId: user.storeId } });
  if (!supplier) return { ok: false as const, error: "Supplier not found in this store." };
  await prisma.supplierPayment.create({ data: {
    storeId: user.storeId, supplierId: supplier.id, amount: new Prisma.Decimal(data.amount), paymentDate: data.paymentDate,
    paymentMethod: data.paymentMethod, reference: data.reference || null, note: data.note || null, createdById: user.id,
  } });
  revalidatePath("/suppliers"); revalidatePath("/reports");
  return { ok: true as const };
}

export async function getSupplierLedger(supplierId: string, from: Date, to: Date) {
  const user = await requireOwner();
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId: user.storeId } });
  if (!supplier) return null;
  const [beforeItems, beforePayments, batches, payments] = await Promise.all([
    prisma.purchaseItem.aggregate({ where: { purchaseBatch: { storeId: user.storeId, supplierId, status: "RECEIVED", purchaseDate: { lt: from } } }, _sum: { buyingPrice: true } }),
    prisma.supplierPayment.aggregate({ where: { storeId: user.storeId, supplierId, paymentDate: { lt: from } }, _sum: { amount: true } }),
    prisma.purchaseBatch.findMany({ where: { storeId: user.storeId, supplierId, status: "RECEIVED", purchaseDate: { gte: from, lte: to } }, include: { items: { select: { buyingPrice: true } } }, orderBy: { purchaseDate: "asc" } }),
    prisma.supplierPayment.findMany({ where: { storeId: user.storeId, supplierId, paymentDate: { gte: from, lte: to } }, orderBy: { paymentDate: "asc" } }),
  ]);
  const openingBalance = Number(beforeItems._sum.buyingPrice ?? 0) - Number(beforePayments._sum.amount ?? 0);
  const rows = [
    ...batches.map((batch) => ({ date: batch.purchaseDate, description: `Purchase — Batch #${batch.purchaseNumber}`, purchaseNumber: batch.purchaseNumber, batchId: batch.id, debit: batch.items.reduce((sum, item) => sum + Number(item.buyingPrice), 0), credit: 0 })),
    ...payments.map((payment) => ({ date: payment.paymentDate, description: `Payment — ${payment.paymentMethod}`, purchaseNumber: null, batchId: null, debit: 0, credit: Number(payment.amount) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = openingBalance;
  const entries = rows.map((row) => { balance += row.debit - row.credit; return { ...row, balance }; });
  return { supplier, openingBalance, entries, totalDebit: entries.reduce((s, r) => s + r.debit, 0), totalCredit: entries.reduce((s, r) => s + r.credit, 0), closingBalance: balance };
}

export async function getLedgerSuppliers() { const user = await requireOwner(); return prisma.supplier.findMany({ where: { storeId: user.storeId }, select: { id: true, name: true }, orderBy: { name: "asc" } }); }

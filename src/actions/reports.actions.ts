"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireOwner } from "@/lib/auth";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ============================================================================
// OWNER DASHBOARD
// ============================================================================
export async function getOwnerDashboardStats() {
  const user = await requireOwner();
  const [todaySales, monthSales, stock, monthExpenses, topModels, topManagers, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: startOfToday() } },
      _sum: { total: true, totalProfit: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: startOfMonth() } },
      _sum: { total: true, totalProfit: true },
      _count: { _all: true },
    }),
    prisma.inventory.aggregate({
      where: { storeId: user.storeId, status: "AVAILABLE" },
      _sum: { buyingPrice: true },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: { storeId: user.storeId, expenseDate: { gte: startOfMonth() } },
      _sum: { amount: true },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { storeId: user.storeId, deletedAt: null, createdAt: { gte: startOfMonth() } } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 5,
    }),
    prisma.sale.groupBy({
      by: ["soldById"],
      where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: startOfMonth() } },
      _sum: { total: true, totalProfit: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.sale.findMany({
      where: { storeId: user.storeId, deletedAt: null },
      include: { customer: true, soldBy: true, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const topModelsWithNames = await Promise.all(
    topModels.map(async (m) => ({
      product: await prisma.product.findUnique({ where: { id: m.productId } }),
      count: m._count._all,
    }))
  );
  const topManagersWithNames = await Promise.all(
    topManagers.map(async (m) => ({
      user: await prisma.user.findUnique({ where: { id: m.soldById } }),
      total: Number(m._sum.total ?? 0),
      profit: Number(m._sum.totalProfit ?? 0),
      count: m._count._all,
    }))
  );

  const monthExpenseTotal = Number(monthExpenses._sum.amount ?? 0);
  const monthProfit = Number(monthSales._sum.totalProfit ?? 0);

  return {
    todaySales: { total: Number(todaySales._sum.total ?? 0), profit: Number(todaySales._sum.totalProfit ?? 0), count: todaySales._count._all },
    monthSales: { total: Number(monthSales._sum.total ?? 0), profit: monthProfit, count: monthSales._count._all },
    currentStock: stock._count._all,
    stockValue: Number(stock._sum.buyingPrice ?? 0),
    monthExpenses: monthExpenseTotal,
    netProfit: monthProfit - monthExpenseTotal,
    topModels: topModelsWithNames,
    topManagers: topManagersWithNames,
    recentSales,
  };
}

// ============================================================================
// MANAGER DASHBOARD
// ============================================================================
export async function getManagerDashboardStats() {
  const user = await getCurrentUser();
  const [todayTotal, mySales, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: startOfToday() } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { storeId: user.storeId, soldById: user.id, deletedAt: null, createdAt: { gte: startOfMonth() } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.findMany({
      where: { storeId: user.storeId, soldById: user.id, deletedAt: null },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Commission is store-configurable; this is a simple 0.5% placeholder —
  // wire up a real commission rate in Settings for production use.
  const commissionRate = 0.005;
  const myMonthTotal = Number(mySales._sum.total ?? 0);

  return {
    todayStoreSales: { total: Number(todayTotal._sum.total ?? 0), count: todayTotal._count._all },
    mySales: { total: myMonthTotal, count: mySales._count._all },
    myCommission: Math.round(myMonthTotal * commissionRate),
    recentSales,
  };
}

// ============================================================================
// REPORTS (Owner only)
// ============================================================================
export async function getDailySalesReport(date: Date) {
  const user = await requireOwner();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return prisma.sale.findMany({
    where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: start, lt: end } },
    include: { customer: true, soldBy: true, items: { include: { product: true } }, payments: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSalesRangeReport(from: Date, to: Date) {
  const user = await requireOwner();
  return prisma.sale.findMany({ where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: from, lte: to } }, include: { customer: true, soldBy: true, items: { include: { product: true } }, payments: true }, orderBy: { createdAt: "desc" } });
}

export async function getProfitReport(from: Date, to: Date) {
  const user = await requireOwner();
  const sales = await prisma.sale.findMany({
    where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, total: true, totalProfit: true, discount: true, promoAmount: true },
  });
  const totals = sales.reduce(
    (acc, s) => ({
      revenue: acc.revenue + Number(s.total),
      profit: acc.profit + Number(s.totalProfit),
      discount: acc.discount + Number(s.discount),
      promo: acc.promo + Number(s.promoAmount),
    }),
    { revenue: 0, profit: 0, discount: 0, promo: 0 }
  );
  return { sales, totals };
}

export async function getManagerPerformanceReport(from: Date, to: Date) {
  const user = await requireOwner();
  const grouped = await prisma.sale.groupBy({
    by: ["soldById"],
    where: { storeId: user.storeId, deletedAt: null, createdAt: { gte: from, lte: to } },
    _sum: { total: true, totalProfit: true },
    _count: { _all: true },
  });
  return Promise.all(
    grouped.map(async (g) => ({
      user: await prisma.user.findUnique({ where: { id: g.soldById } }),
      totalSales: Number(g._sum.total ?? 0),
      totalProfit: Number(g._sum.totalProfit ?? 0),
      saleCount: g._count._all,
    }))
  );
}

export async function getBestSellingProducts(from: Date, to: Date, limit = 10) {
  const user = await requireOwner();
  const grouped = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { storeId: user.storeId, deletedAt: null, createdAt: { gte: from, lte: to } } },
    _count: { _all: true },
    _sum: { sellingPrice: true, profit: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });
  return Promise.all(
    grouped.map(async (g) => ({
      product: await prisma.product.findUnique({ where: { id: g.productId } }),
      unitsSold: g._count._all,
      revenue: Number(g._sum.sellingPrice ?? 0),
      profit: Number(g._sum.profit ?? 0),
    }))
  );
}

export async function getSamsungPromoReport(from: Date, to: Date) {
  const user = await requireOwner();
  return prisma.saleItem.findMany({
    where: { promotionId: { not: null }, sale: { storeId: user.storeId, deletedAt: null, createdAt: { gte: from, lte: to } } },
    include: { product: true, promotion: true, sale: { include: { customer: true } } },
  });
}

export async function getCustomerReport() {
  const user = await requireOwner();
  const customers = await prisma.customer.findMany({
    where: { storeId: user.storeId },
    include: { sales: { where: { deletedAt: null } } },
  });
  return customers
    .map((c) => ({
      customer: c,
      totalSpent: c.sales.reduce((sum, s) => sum + Number(s.total), 0),
      orderCount: c.sales.length,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function getTransactionReports(from: Date, to: Date) {
  const user = await requireOwner();
  const [purchases, expenses, supplierPayments, customerPayments, inventoryMovements] = await Promise.all([
    prisma.purchaseBatch.findMany({ where: { storeId: user.storeId, status: "RECEIVED", purchaseDate: { gte: from, lte: to } }, include: { items: true }, orderBy: { purchaseDate: "desc" } }),
    prisma.expense.findMany({ where: { storeId: user.storeId, expenseDate: { gte: from, lte: to } }, orderBy: { expenseDate: "desc" } }),
    prisma.supplierPayment.findMany({ where: { storeId: user.storeId, paymentDate: { gte: from, lte: to } }, include: { supplier: true }, orderBy: { paymentDate: "desc" } }),
    prisma.payment.findMany({ where: { sale: { storeId: user.storeId, deletedAt: null, createdAt: { gte: from, lte: to } } }, include: { sale: { include: { customer: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.inventory.findMany({ where: { storeId: user.storeId, createdAt: { gte: from, lte: to } }, include: { product: true, purchaseItem: { include: { purchaseBatch: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return { purchases: purchases.map(p => ({ ...p, total: p.items.reduce((s, i) => s + Number(i.buyingPrice), 0) })), expenses, supplierPayments, customerPayments, inventoryMovements };
}

export async function getCustomerLedger(customerId: string, from: Date, to: Date) {
  const user = await requireOwner();
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId: user.storeId } });
  if (!customer) return null;
  const [priorSales, priorPayments, sales, payments] = await Promise.all([
    prisma.sale.aggregate({ where: { storeId: user.storeId, customerId, deletedAt: null, createdAt: { lt: from } }, _sum: { total: true } }),
    prisma.payment.aggregate({ where: { sale: { storeId: user.storeId, customerId, deletedAt: null, createdAt: { lt: from } } }, _sum: { amount: true } }),
    prisma.sale.findMany({ where: { storeId: user.storeId, customerId, deletedAt: null, createdAt: { gte: from, lte: to } }, select: { id: true, createdAt: true, invoiceNumber: true, total: true, payments: true }, orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ where: { sale: { storeId: user.storeId, customerId, deletedAt: null, createdAt: { gte: from, lte: to } } }, include: { sale: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const openingBalance = Number(priorSales._sum.total ?? 0) - Number(priorPayments._sum.amount ?? 0);
  const rows = [...sales.map(s => ({ date: s.createdAt, description: `Sale — ${s.invoiceNumber}`, debit: Number(s.total), credit: 0 })), ...payments.map(p => ({ date: p.createdAt, description: `Payment — ${p.method} — ${p.sale.invoiceNumber}`, debit: 0, credit: Number(p.amount) }))].sort((a,b)=>a.date.getTime()-b.date.getTime());
  let balance = openingBalance;
  const entries = rows.map(row => { balance += row.debit - row.credit; return { ...row, balance }; });
  return { customer, openingBalance, entries, totalDebit: entries.reduce((s,r)=>s+r.debit,0), totalCredit: entries.reduce((s,r)=>s+r.credit,0), closingBalance: balance };
}

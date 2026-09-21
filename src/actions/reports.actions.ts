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

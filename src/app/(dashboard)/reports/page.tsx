import { requireOwner } from "@/lib/auth";
import {
  getProfitReport, getBestSellingProducts,
  getManagerPerformanceReport, getSamsungPromoReport, getCustomerReport,
} from "@/actions/reports.actions";
import { getLowStockModels, getDeadStock } from "@/actions/inventory.actions";
import { getSalesRangeReport, getTransactionReports } from "@/actions/reports.actions";
import { getLedgerSuppliers } from "@/actions/suppliers.actions";
import { prisma } from "@/lib/prisma";
import { ReportDateFilter } from "@/components/shared/report-date-filter";
import { ReportsTabs } from "@/components/shared/reports-tabs";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireOwner();
  const params = await searchParams;
  const from = params.from ? new Date(`${params.from}T00:00:00`) : startOfMonth();
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : new Date();

  const [daily, profit, bestSelling, managerPerf, promoReport, customerReport, lowStock, deadStock, transactions, suppliers, customers] = await Promise.all([
    getSalesRangeReport(from, to),
    getProfitReport(from, to),
    getBestSellingProducts(from, to),
    getManagerPerformanceReport(from, to),
    getSamsungPromoReport(from, to),
    getCustomerReport(),
    getLowStockModels(),
    getDeadStock(),
    getTransactionReports(from, to),
    getLedgerSuppliers(),
    prisma.customer.findMany({ where: { storeId: user.storeId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <ReportDateFilter from={from.toISOString().slice(0,10)} to={to.toISOString().slice(0,10)} />
      <ReportsTabs
        data={{ daily, profit, bestSelling, managerPerf, promoReport, customerReport, lowStock, deadStock, transactions, suppliers, customers }}
      />
    </div>
  );
}

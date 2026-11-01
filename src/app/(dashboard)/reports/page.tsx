import { requireOwner } from "@/lib/auth";
import {
  getProfitReport, getBestSellingProducts,
  getManagerPerformanceReport, getSamsungPromoReport, getCustomerReport,
} from "@/actions/reports.actions";
import { getLowStockModels, getDeadStock } from "@/actions/inventory.actions";
import { getSalesRangeReport, getTransactionReports } from "@/actions/reports.actions";
import { getStockAnalytics } from "@/actions/reports.actions";
import { ReportDateFilter } from "@/components/shared/report-date-filter";
import { ReportsTabs } from "@/components/shared/reports-tabs";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const from = params.from ? new Date(`${params.from}T00:00:00`) : startOfMonth();
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : new Date();

  const [daily, profit, bestSelling, managerPerf, promoReport, customerReport, lowStock, deadStock, transactions, stockAnalytics] = await Promise.all([
    getSalesRangeReport(from, to),
    getProfitReport(from, to),
    getBestSellingProducts(from, to),
    getManagerPerformanceReport(from, to),
    getSamsungPromoReport(from, to),
    getCustomerReport(),
    getLowStockModels(),
    getDeadStock(),
    getTransactionReports(from, to),
    getStockAnalytics({ from: dateKey(from), to: dateKey(to) }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <ReportDateFilter from={dateKey(from)} to={dateKey(to)} />
      <ReportsTabs
        data={{ daily, profit, bestSelling, managerPerf, promoReport, customerReport, lowStock, deadStock, transactions, stockAnalytics, reportFrom: dateKey(from), reportTo: dateKey(to) }}
      />
    </div>
  );
}

import { requireOwner } from "@/lib/auth";
import {
  getDailySalesReport, getProfitReport, getBestSellingProducts,
  getManagerPerformanceReport, getSamsungPromoReport, getCustomerReport,
} from "@/actions/reports.actions";
import { getLowStockModels, getDeadStock } from "@/actions/inventory.actions";
import { ReportsTabs } from "@/components/shared/reports-tabs";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function ReportsPage() {
  await requireOwner();
  const now = new Date();
  const from = startOfMonth();

  const [daily, profit, bestSelling, managerPerf, promoReport, customerReport, lowStock, deadStock] = await Promise.all([
    getDailySalesReport(now),
    getProfitReport(from, now),
    getBestSellingProducts(from, now),
    getManagerPerformanceReport(from, now),
    getSamsungPromoReport(from, now),
    getCustomerReport(),
    getLowStockModels(),
    getDeadStock(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <ReportsTabs
        data={{ daily, profit, bestSelling, managerPerf, promoReport, customerReport, lowStock, deadStock }}
      />
    </div>
  );
}

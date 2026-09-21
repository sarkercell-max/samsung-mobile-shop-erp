import { getManagerDashboardStats } from "@/actions/reports.actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { DollarSign, TrendingUp, Wallet, ReceiptText, Plus } from "lucide-react";
import Link from "next/link";

export default async function ManagerDashboardPage() {
  const stats = await getManagerDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your sales overview</p>
        </div>
        <Button asChild size="lg" className="hidden lg:inline-flex">
          <Link href="/sales/new">
            <Plus className="mr-1 h-4 w-4" /> New Sale
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Today's Store Sales" value={formatCurrency(stats.todayStoreSales.total)} icon={DollarSign} trend={{ value: `${stats.todayStoreSales.count} sales`, positive: true }} />
        <StatCard label="My Sales (Month)" value={formatCurrency(stats.mySales.total)} icon={TrendingUp} accent="success" trend={{ value: `${stats.mySales.count} sales`, positive: true }} />
        <StatCard label="My Commission (est.)" value={formatCurrency(stats.myCommission)} icon={Wallet} accent="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> My Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.recentSales.length === 0 && <p className="text-sm text-muted-foreground">No sales yet — tap "Sell" to start.</p>}
          {stats.recentSales.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{sale.invoiceNumber} · {sale.customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {sale.items.map((i) => i.product.model).join(", ")} · {formatDateTime(sale.createdAt)}
                </p>
              </div>
              <span className="font-semibold">{formatCurrency(Number(sale.total))}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

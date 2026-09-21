import { getOwnerDashboardStats } from "@/actions/reports.actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  DollarSign, TrendingUp, Package, Wallet, Trophy, Users, ReceiptText,
} from "lucide-react";
import Link from "next/link";

export default async function OwnerDashboardPage() {
  const stats = await getOwnerDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Store performance overview</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(stats.todaySales.total)} icon={DollarSign} trend={{ value: `${stats.todaySales.count} sales`, positive: true }} />
        <StatCard label="Monthly Sales" value={formatCurrency(stats.monthSales.total)} icon={TrendingUp} trend={{ value: `${stats.monthSales.count} sales`, positive: true }} />
        <StatCard label="Current Stock" value={String(stats.currentStock)} icon={Package} accent="success" />
        <StatCard label="Stock Value" value={formatCurrency(stats.stockValue)} icon={Wallet} accent="success" />
        <StatCard label="Profit Today" value={formatCurrency(stats.todaySales.profit)} icon={TrendingUp} accent="success" />
        <StatCard label="Profit This Month" value={formatCurrency(stats.monthSales.profit)} icon={TrendingUp} accent="success" />
        <StatCard label="Expenses (Month)" value={formatCurrency(stats.monthExpenses)} icon={Wallet} accent="destructive" />
        <StatCard
          label="Net Profit"
          value={formatCurrency(stats.netProfit)}
          icon={DollarSign}
          accent={stats.netProfit >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Top Models This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topModels.length === 0 && <p className="text-sm text-muted-foreground">No sales yet this month.</p>}
            {stats.topModels.map((m, idx) => (
              <div key={m.product?.id ?? idx} className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="text-sm font-medium">{m.product?.model ?? "Unknown"}</span>
                <Badge variant="secondary">{m.count} sold</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Top Managers This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topManagers.length === 0 && <p className="text-sm text-muted-foreground">No sales yet this month.</p>}
            {stats.topManagers.map((m, idx) => (
              <div key={m.user?.id ?? idx} className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="text-sm font-medium">{m.user?.name ?? "Unknown"}</span>
                <span className="text-sm text-muted-foreground">{formatCurrency(m.total)} · {m.count} sales</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.recentSales.map((sale) => (
            <Link
              key={sale.id}
              href={`/sales/${sale.id}`}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <div>
                <p className="text-sm font-medium">{sale.invoiceNumber} · {sale.customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {sale.items.map((i) => i.product.model).join(", ")} · {formatDateTime(sale.createdAt)}
                </p>
              </div>
              <span className="font-semibold">{formatCurrency(Number(sale.total))}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

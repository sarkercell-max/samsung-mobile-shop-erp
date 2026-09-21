import { getCurrentUser } from "@/lib/auth";
import { getAllSales, getMySales } from "@/actions/sales.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function SalesPage() {
  const user = await getCurrentUser();
  let sales: any[] = [];
  if (user.role === "OWNER") {
    const res = await getAllSales();
    sales = res.ok ? res.data : [];
  } else {
    sales = await getMySales();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{user.role === "OWNER" ? "All Sales" : "My Sales"}</h1>
      <div className="space-y-2">
        {sales.length === 0 && <p className="text-sm text-muted-foreground">No sales recorded yet.</p>}
        {sales.map((sale: any) => (
          <Link key={sale.id} href={`/sales/${sale.id}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <Badge variant={sale.status === "COMPLETED" ? "success" : "destructive"}>{sale.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sale.customer.name} · {sale.items.map((i: any) => i.product?.model ?? "").join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}{sale.soldBy ? ` · ${sale.soldBy.name}` : ""}</p>
                </div>
                <p className="font-semibold">{formatCurrency(Number(sale.total))}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

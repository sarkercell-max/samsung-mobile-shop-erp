import Link from "next/link";
import { getSuppliers } from "@/actions/suppliers.actions";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();
  return <div className="space-y-4"><h1 className="text-xl font-semibold">Suppliers</h1>
    <div className="space-y-2">{suppliers.map((s) => <Link href={`/suppliers/${s.id}`} key={s.id}>
      <Card><CardContent className="grid gap-2 p-4 sm:grid-cols-5 sm:items-center"><strong>{s.name}</strong><span>Total Purchase {formatCurrency(s.totalPurchase)}</span><span>Total Paid {formatCurrency(s.totalPaid)}</span><span>Due {formatCurrency(s.totalDue)}</span><span className="text-sm text-muted-foreground">Last payment {s.lastPaymentDate ? formatDate(s.lastPaymentDate) : "—"}</span></CardContent></Card>
    </Link>)}{!suppliers.length && <p className="text-sm text-muted-foreground">Suppliers appear here when you record purchases.</p>}</div>
  </div>;
}

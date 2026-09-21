import { getCustomerDetail } from "@/actions/customers.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle>{customer.name}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{customer.phone}</p>
          {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Purchase History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {customer.sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{s.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{s.items.map((i) => i.product.model).join(", ")} · {formatDateTime(s.createdAt)}</p>
              </div>
              <p className="font-semibold">{formatCurrency(Number(s.total))}</p>
            </div>
          ))}
          {customer.sales.length === 0 && <p className="text-sm text-muted-foreground">No purchases yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

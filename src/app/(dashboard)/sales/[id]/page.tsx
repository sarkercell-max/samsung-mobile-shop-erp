import { getCurrentUser } from "@/lib/auth";
import { saleRepository } from "@/repositories/sale.repository";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { SaleVoidButton } from "@/components/sales/sale-void-button";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const sale = await saleRepository.findById(user.storeId, id);
  if (!sale) notFound();
  if (user.role !== "OWNER" && sale.soldById !== user.id) notFound();

  const totalPromo = sale.items.reduce((sum, i) => sum + Number(i.promoAmount), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Invoice {sale.invoiceNumber}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/invoice/${sale.id}`} target="_blank">Print Invoice</Link>
          </Button>
          {user.role === "OWNER" && sale.status === "COMPLETED" && <SaleVoidButton saleId={sale.id} invoiceNumber={sale.invoiceNumber} />}
        </div>
      </div>

      {sale.status !== "COMPLETED" && (
        <Badge variant="destructive" className="text-sm">This sale has been {sale.status.toLowerCase()}</Badge>
      )}

      <Card>
        <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
        <CardContent>
          <p className="font-medium">{sale.customer.name}</p>
          <p className="text-sm text-muted-foreground">{sale.customer.phone}</p>
          {sale.customer.address && <p className="text-sm text-muted-foreground">{sale.customer.address}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {sale.items.map((item) => {
            const gross = Number(item.sellingPrice);
            const promo = Number(item.promoAmount);
            const discount = Number(item.discount);
            const finalPrice = Math.max(gross - promo - discount, 0);
            return (
              <div key={item.id} className="border-b pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.product.model} · {item.product.ram}/{item.product.storageCapacity} · {item.product.color}</p>
                    <p className="text-xs text-muted-foreground">IMEI: {item.inventory.imei}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(finalPrice)}</p>
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Regular Price</span><span>{formatCurrency(gross)}</span></div>
                  {promo > 0 && <div className="flex justify-between"><span>Promotional Discount</span><span>-{formatCurrency(promo)}</span></div>}
                  {discount > 0 && <div className="flex justify-between"><span>Additional Discount</span><span>-{formatCurrency(discount)}</span></div>}
                  {user.role === "OWNER" && (
                    <div className="flex justify-between"><span>Cost / Profit</span><span>{formatCurrency(Number(item.buyingPrice))} / {formatCurrency(Number(item.profit))}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 p-4">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(Number(sale.subtotal))}</span></div>
          {totalPromo > 0 && (
            <div className="flex justify-between text-sm"><span>Promotional Discount</span><span>-{formatCurrency(totalPromo)}</span></div>
          )}
          <div className="flex justify-between text-sm"><span>Additional Discount</span><span>-{formatCurrency(Number(sale.discount))}</span></div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total Paid</span><span>{formatCurrency(Number(sale.total))}</span></div>
          {user.role === "OWNER" && (
            <div className="flex justify-between text-xs text-muted-foreground"><span>Total Profit</span><span>{formatCurrency(Number(sale.totalProfit))}</span></div>
          )}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {sale.payments.map((p) => (
              <Badge key={p.id} variant="secondary">{p.method}: {formatCurrency(Number(p.amount))}</Badge>
            ))}
          </div>
          <p className="pt-2 text-xs text-muted-foreground">{formatDateTime(sale.createdAt)} · Sold by {sale.soldBy.name}</p>
        </CardContent>
      </Card>
    </div>
  );
}

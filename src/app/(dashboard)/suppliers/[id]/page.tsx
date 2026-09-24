import { notFound } from "next/navigation";
import { getSupplierDetail } from "@/actions/suppliers.actions";
import { SupplierPaymentForm } from "@/components/shared/supplier-payment-form";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const data = await getSupplierDetail(id); if (!data) notFound();
  return <div className="space-y-4"><h1 className="text-xl font-semibold">{data.supplier.name}</h1>
    <div className="grid gap-2 sm:grid-cols-3">{[["Total Purchase",data.totalPurchase],["Total Paid",data.totalPaid],["Total Due",data.totalDue]].map(([label,value])=><Card key={String(label)}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-lg font-bold">{formatCurrency(Number(value))}</p></CardContent></Card>)}</div>
    <SupplierPaymentForm supplierId={id} />
    <h2 className="font-semibold">Payment History</h2>
    <div className="space-y-2">{data.paymentHistory.map((p)=><Card key={p.id}><CardContent className="grid gap-1 p-3 sm:grid-cols-6"><span><small className="block text-muted-foreground">Payment Date</small>{formatDateTime(p.paymentDate)}</span><strong>{formatCurrency(Number(p.amount))}</strong><span>{p.paymentMethod}</span><span>{p.reference || "—"}</span><span><small className="block text-muted-foreground">Created by</small>{p.createdBy.name}</span><span><small className="block text-muted-foreground">Created at</small>{formatDateTime(p.createdAt)}</span>{p.note&&<p className="text-sm text-muted-foreground sm:col-span-6">{p.note}</p>}</CardContent></Card>)}{!data.paymentHistory.length&&<p className="text-sm text-muted-foreground">No payments recorded.</p>}</div>
  </div>;
}

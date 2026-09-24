import { listPurchaseBatches } from "@/actions/purchase.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { CancelPurchaseButton } from "@/components/shared/cancel-purchase-button";

export default async function PurchasePage() {
  const batches = await listPurchaseBatches();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <Button asChild size="sm"><Link href="/purchase/new"><Plus className="mr-1 h-4 w-4" /> New Purchase</Link></Button>
      </div>
      <div className="space-y-2">
        {batches.map((b) => {
          const total = b.items.reduce((sum, i) => sum + Number(i.buyingPrice), 0);
          const soldCount = b.items.filter((i) => i.inventory?.status === "SOLD").length;
          const canCancel = b.status === "RECEIVED" && b.items.every((i) => i.inventory?.status === "AVAILABLE");
          return (
            <Card key={b.id} id={b.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{b.purchaseNumber}</p>
                    <Badge variant={b.status === "CANCELLED" ? "destructive" : "success"}>{b.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDate(b.purchaseDate)}</p>
                </div>
                <p className="text-sm text-muted-foreground">{b.supplierName} · Batch {b.batchNumber}</p>
                <p className="text-sm">{b.items.length} units · {formatCurrency(total)} {soldCount > 0 && `· ${soldCount} sold`}</p>
                {b.status === "CANCELLED" && b.cancelReason && (
                  <p className="mt-1 text-xs text-muted-foreground">Cancelled by {b.cancelledBy?.name}: {b.cancelReason}</p>
                )}
                {canCancel && (
                  <div className="mt-2">
                    <CancelPurchaseButton purchaseBatchId={b.id} purchaseNumber={b.purchaseNumber} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {batches.length === 0 && <p className="text-sm text-muted-foreground">No purchases recorded yet.</p>}
      </div>
    </div>
  );
}

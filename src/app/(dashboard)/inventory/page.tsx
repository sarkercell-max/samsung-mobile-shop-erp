import { listInventory, getStockValue } from "@/actions/inventory.actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Package, Wallet, Tag } from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  AVAILABLE: "success",
  RESERVED: "secondary",
  SOLD: "outline",
  RETURNED: "destructive",
  LOST: "destructive",
  CANCELLED: "destructive",
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const [items, stockValue] = await Promise.all([
    listInventory(status as any, q),
    getStockValue(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventory</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Available Units" value={String(stockValue.unitCount)} icon={Package} />
        <StatCard label="Stock at Cost" value={formatCurrency(stockValue.stockValueAtCost)} icon={Wallet} accent="success" />
        <StatCard label="Stock at Selling" value={formatCurrency(stockValue.stockValueAtSelling)} icon={Tag} accent="success" />
      </div>

      <div className="space-y-2">
        {items.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{inv.product.model} · {inv.product.ram}/{inv.product.storageCapacity} · {inv.product.color}</p>
                <p className="text-xs text-muted-foreground">IMEI: {inv.imei}</p>
              </div>
              <div className="text-right">
                <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                <p className="mt-1 text-sm font-semibold">{formatCurrency(Number(inv.sellingPrice))}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No inventory matches your filters.</p>}
      </div>
    </div>
  );
}

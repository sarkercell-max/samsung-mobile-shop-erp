import { listInventory, getStockValue, getStockOverview } from "@/actions/inventory.actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Package, Wallet, Tag, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { InventoryAdjustment } from "@/components/inventory/inventory-adjustment";
import { getCurrentUser } from "@/lib/auth";

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
  const [items, stockValue, overview, user] = await Promise.all([
    listInventory(status as any, q),
    getStockValue(),
    getStockOverview(),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <Link href="/inventory/movements" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeftRight className="h-4 w-4"/>Stock movement history</Link>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Available Units" value={String(stockValue.unitCount)} icon={Package} />
        <StatCard label="Stock at Cost" value={formatCurrency(stockValue.stockValueAtCost)} icon={Wallet} accent="success" />
        <StatCard label="Stock at Selling" value={formatCurrency(stockValue.stockValueAtSelling)} icon={Tag} accent="success" />
      </div>

      <Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[1500px] text-sm"><thead><tr className="border-b text-left text-muted-foreground">{["Product / Variant","Current","Available","Sold","Purchased","Returned","Damaged","Reserved","Stock value","Purchase cost","Selling price","Last purchase","Last sale","Min. stock","Status"].map((h)=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{overview.map((row)=><tr key={row.id} className="border-b last:border-0"><td className="p-3"><div className="font-medium">{row.model}</div><div className="text-xs text-muted-foreground">{row.variant}</div></td><td className="p-3">{row.current}</td><td className="p-3">{row.available}</td><td className="p-3">{row.sold}</td><td className="p-3">{row.purchased}</td><td className="p-3">{row.returned}</td><td className="p-3">{row.damaged}</td><td className="p-3">{row.reserved}</td><td className="p-3">{formatCurrency(row.value)}</td><td className="p-3">{formatCurrency(row.purchaseCost)}</td><td className="p-3">{formatCurrency(row.sellingPrice)}</td><td className="p-3">{formatCurrency(row.lastPurchasePrice)}</td><td className="p-3">{formatCurrency(row.lastSalePrice)}</td><td className="p-3">{row.lowAt}</td><td className="p-3"><Badge variant={row.available === 0 ? "destructive" : row.low ? "secondary" : "success"}>{row.available === 0 ? "OUT OF STOCK" : row.low ? "LOW STOCK" : "IN STOCK"}</Badge></td></tr>)}</tbody></table>{overview.length===0&&<p className="p-6 text-sm text-muted-foreground">No active products.</p>}</CardContent></Card>

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
                <p className="mt-1 text-sm font-semibold">{formatCurrency(inv.status === "AVAILABLE" ? Number(inv.product.defaultSellingPrice) : Number(inv.sellingPrice))}</p>
                {user.role === "OWNER" && <InventoryAdjustment inventoryId={inv.id} status={inv.status} />}
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No inventory matches your filters.</p>}
      </div>
    </div>
  );
}

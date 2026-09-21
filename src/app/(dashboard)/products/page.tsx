import { listProducts } from "@/actions/products.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Plus, Tag } from "lucide-react";
import Link from "next/link";
import { ProductActions } from "@/components/shared/product-actions";

export default async function ProductsPage() {
  const products = await listProducts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Button asChild size="sm"><Link href="/products/new"><Plus className="mr-1 h-4 w-4" /> Add Product</Link></Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.model}</p>
                  <p className="text-sm text-muted-foreground">{p.ram} / {p.storageCapacity} · {p.color}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                </div>
                {!p.isActive && <Badge variant="secondary">Archived</Badge>}
              </div>
              <p className="mt-2 font-semibold">{formatCurrency(Number(p.defaultSellingPrice))}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/products/${p.id}/pricing`}><Tag className="mr-1 h-3.5 w-3.5" /> Pricing</Link>
                </Button>
                <ProductActions productId={p.id} model={p.model} isActive={p.isActive} />
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && <p className="text-sm text-muted-foreground">No products yet — add your first Samsung model.</p>}
      </div>
    </div>
  );
}

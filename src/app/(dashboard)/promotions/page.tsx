import { listPromotions } from "@/actions/promotions.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PromotionActions } from "@/components/shared/promotion-actions";

export default async function PromotionsPage() {
  const promotions = await listPromotions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Samsung Promotions</h1>
        <Button asChild size="sm"><Link href="/promotions/new"><Plus className="mr-1 h-4 w-4" /> New Promotion</Link></Button>
      </div>
      <div className="space-y-2">
        {promotions.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.product.model}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(p.startDate)} – {formatDate(p.endDate)}</p>
                  <Badge variant={p.isActive ? "success" : "secondary"} className="mt-1">{p.promoType}</Badge>
                </div>
                <p className="font-semibold">{formatCurrency(Number(p.promoAmount))}</p>
              </div>
              <div className="mt-3">
                <PromotionActions promotionId={p.id} model={p.product.model} isActive={p.isActive} />
              </div>
            </CardContent>
          </Card>
        ))}
        {promotions.length === 0 && <p className="text-sm text-muted-foreground">No promotions created yet.</p>}
      </div>
    </div>
  );
}

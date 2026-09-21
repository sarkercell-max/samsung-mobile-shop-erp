"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createPricePeriod } from "@/actions/pricing.actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

interface PriceRow {
  id: string;
  purchasePrice: number;
  salePrice: number;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
}

export function PricingManager({ productId, history }: { productId: string; history: PriceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    purchasePrice: "",
    salePrice: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const current = history.find((h) => h.effectiveTo === null);
  const past = history.filter((h) => h.effectiveTo !== null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPricePeriod({
        productId,
        purchasePrice: Number(form.purchasePrice),
        salePrice: Number(form.salePrice),
        effectiveFrom: new Date(form.effectiveFrom),
      });
      if (!res.ok) {
  toast.error(res.error);
  return;
}
      toast.success("New price period is now active.");
      setShowForm(false);
      setForm({ purchasePrice: "", salePrice: "", effectiveFrom: new Date().toISOString().slice(0, 10) });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Current Price</CardTitle></CardHeader>
        <CardContent>
          {current ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Purchase</span><span className="font-medium">{formatCurrency(current.purchasePrice)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sale</span><span className="font-medium">{formatCurrency(current.salePrice)}</span></div>
              <p className="pt-1 text-xs text-muted-foreground">Effective since {formatDate(current.effectiveFrom)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No price set yet — add the first price period below.</p>
          )}
        </CardContent>
      </Card>

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full" size="lg">
          <Plus className="mr-1 h-4 w-4" /> Add New Effective Price
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Price Period</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Effective From</Label>
                <Input className="mt-1.5" type="date" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} required />
                <p className="mt-1 text-xs text-muted-foreground">The current price period automatically closes the day before this date. Past purchases/sales are never affected.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Purchase Price</Label><Input className="mt-1.5" type="number" value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))} required /></div>
                <div><Label>Sale Price</Label><Input className="mt-1.5" type="number" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))} required /></div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Price History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {past.length === 0 && <p className="text-sm text-muted-foreground">No past price periods yet.</p>}
          {past.map((h) => (
            <div key={h.id} className="rounded-lg border p-2.5 text-sm">
              <Badge variant="outline">{formatDate(h.effectiveFrom)} – {h.effectiveTo ? formatDate(h.effectiveTo) : "—"}</Badge>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Purchase {formatCurrency(h.purchasePrice)}</span>
                <span>Sale {formatCurrency(h.salePrice)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { applyPurchaseUpdatedRate, applySaleUpdatedRate, getPurchaseRateComparison, getSaleRateComparison } from "@/actions/rate-adjustment.actions";

type SaleComparison = Extract<Awaited<ReturnType<typeof getSaleRateComparison>>, { ok: true }> ["data"];
type PurchaseComparison = Extract<Awaited<ReturnType<typeof getPurchaseRateComparison>>, { ok: true }> ["data"];

export function TransactionRateAdjustment({ type, itemId }: { type: "sale" | "purchase"; itemId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comparison, setComparison] = useState<SaleComparison | PurchaseComparison | null>(null);
  const [selected, setSelected] = useState({ purchase: false, sale: false, promotion: false });

  async function show() {
    setOpen(true); setLoading(true); setComparison(null);
    try {
      const result = type === "sale" ? await getSaleRateComparison(itemId) : await getPurchaseRateComparison(itemId);
      if (!result.ok) { toast.error(result.error); setOpen(false); return; }
      setComparison(result.data as SaleComparison | PurchaseComparison);
      setSelected(type === "sale" ? { purchase: false, sale: false, promotion: false } : { purchase: true, sale: false, promotion: false });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load current rate."); setOpen(false); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!comparison) return;
    setSaving(true);
    try {
      const result = type === "sale"
        ? await applySaleUpdatedRate(itemId, selected)
        : await applyPurchaseUpdatedRate(itemId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Rate updated successfully."); setOpen(false); window.location.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rate update failed."); }
    finally { setSaving(false); }
  }

  const isSale = type === "sale" && comparison && "saleId" in comparison;
  const saleComparison = isSale ? comparison as SaleComparison : null;
  const purchaseComparison = type === "purchase" && comparison ? comparison as PurchaseComparison : null;
  const rows = saleComparison ? [
    { key: "purchase" as const, label: "Purchase Rate", old: saleComparison.old.purchase, current: saleComparison.current.purchase },
    { key: "sale" as const, label: "Sale Rate", old: saleComparison.old.sale, current: saleComparison.current.sale },
    { key: "promotion" as const, label: "Promotion / Discount", old: saleComparison.old.promotion, current: saleComparison.current.promotion },
  ] : purchaseComparison ? [{ key: "purchase" as const, label: "Purchase Rate", old: purchaseComparison.old, current: purchaseComparison.current }] : [];
  const changed = rows.filter((row) => selected[row.key] && row.old !== row.current);
  const saleDelta = changed.reduce((sum, row) => sum + (row.key === "sale" ? row.current - row.old : 0) - (row.key === "promotion" ? row.current - row.old : 0), 0);
  const profitDelta = changed.reduce((sum, row) => sum + (row.key === "sale" ? row.current - row.old : row.key === "purchase" ? row.old - row.current : row.current - row.old), 0);

  return <>
    <Button size="sm" variant="outline" onClick={show}>Apply Updated Rate</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Apply Updated Rate</DialogTitle></DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Loading current master rates…</p> : comparison && <div className="space-y-4">
          <div><p className="font-medium">{saleComparison?.product ?? purchaseComparison?.product}</p><p className="text-xs text-muted-foreground">{saleComparison?.invoiceNumber ?? purchaseComparison?.purchaseNumber}{purchaseComparison ? ` · IMEI ${purchaseComparison.imei}` : ""}</p></div>
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/40 p-3 text-xs font-semibold"><span>Transaction Rate</span><span>Existing</span><span>Current</span></div>
            {rows.map((row) => <label key={row.key} className="grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-3 border-b p-3 last:border-0">
              <span className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected[row.key]} disabled={row.old === row.current} onChange={(event) => setSelected((value) => ({ ...value, [row.key]: event.target.checked }))} />{row.label}</span>
              <span className="text-sm">{formatCurrency(row.old)}</span><span className="text-right text-sm font-medium">{formatCurrency(row.current)}<span className="block text-xs text-muted-foreground">{row.current - row.old > 0 ? "+" : ""}{formatCurrency(row.current - row.old)}</span></span>
            </label>)}
          </div>
          {saleComparison && <div className="rounded-lg bg-muted/40 p-3 text-sm"><p>Estimated total: <strong>{formatCurrency(saleComparison.saleTotal)} → {formatCurrency(Math.max(saleComparison.saleTotal + saleDelta, 0))}</strong></p><p>Estimated profit: <strong>{formatCurrency(saleComparison.saleProfit)} → {formatCurrency(saleComparison.saleProfit + profitDelta)}</strong></p><p className="mt-1 text-xs text-muted-foreground">Paid amounts and payment history remain unchanged; due is recalculated from the new total.</p></div>}
          <p className="text-xs text-muted-foreground">Confirm rate update? This changes the selected financial rates only. Transaction date, item identity, IMEI, and stock status remain unchanged.</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving || changed.length === 0} onClick={confirm}>{saving ? "Updating…" : "Confirm Update"}</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

"use client";
import { useState } from "react";
import { getBusinessLedger } from "@/actions/reports.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

type LedgerDay = { date: string; sale: number; promo: number; purchase: number };
const totalFor = (day: LedgerDay) => day.sale + day.promo + day.purchase;

export function LedgerReport({ initialFrom, initialTo }: { initialFrom?: string; initialTo?: string }) {
  const [from, setFrom] = useState(initialFrom ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(initialTo ?? new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState<LedgerDay[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      setDays(await getBusinessLedger(new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`)));
    } finally {
      setBusy(false);
    }
  }

  const totals = days?.reduce((sum, day) => ({
    sale: sum.sale + day.sale,
    promo: sum.promo + day.promo,
    purchase: sum.purchase + day.purchase,
  }), { sale: 0, promo: 0, purchase: 0 });

  function exportLedger(format: "csv" | "xlsx") {
    if (!days || !totals) return;
    const rows = [
      ...days.map((day) => ({ Date: formatDate(`${day.date}T12:00:00`), Sale: day.sale, Promo: day.promo, Purchase: day.purchase, Total: totalFor(day) })),
      { Date: "Total", Sale: totals.sale, Promo: totals.promo, Purchase: totals.purchase, Total: totals.sale + totals.promo + totals.purchase },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ledger");
      XLSX.writeFile(wb, "ledger.xlsx");
    } else {
      const blob = new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ledger.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <Button onClick={load} disabled={busy}>{busy ? "Loading…" : "Apply"}</Button>
      <Button variant="outline" onClick={() => window.print()} disabled={!days}>Print</Button>
      <Button variant="outline" onClick={() => exportLedger("csv")} disabled={!days}>CSV</Button>
      <Button variant="outline" onClick={() => exportLedger("xlsx")} disabled={!days}>Excel</Button>
    </div>
    {days && totals && <div id="ledger-print" className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50 text-left"><th className="p-2">Date</th><th className="p-2 text-right">Sale</th><th className="p-2 text-right">Promo</th><th className="p-2 text-right">Purchase</th><th className="p-2 text-right">Total</th></tr></thead>
        <tbody>
          {days.map((day) => <tr key={day.date} className="border-b"><td className="whitespace-nowrap p-2">{formatDate(`${day.date}T12:00:00`)}</td><td className="p-2 text-right">{formatCurrency(day.sale)}</td><td className="p-2 text-right">{formatCurrency(day.promo)}</td><td className="p-2 text-right">{formatCurrency(day.purchase)}</td><td className="p-2 text-right font-medium">{formatCurrency(totalFor(day))}</td></tr>)}
          {days.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={5}>No sales, promos, or purchases for this date range.</td></tr>}
        </tbody>
        <tfoot><tr className="border-t-2 bg-muted/50 font-semibold"><td className="p-2">Total</td><td className="p-2 text-right">{formatCurrency(totals.sale)}</td><td className="p-2 text-right">{formatCurrency(totals.promo)}</td><td className="p-2 text-right">{formatCurrency(totals.purchase)}</td><td className="p-2 text-right">{formatCurrency(totals.sale + totals.promo + totals.purchase)}</td></tr></tfoot>
      </table>
    </div>}
  </div>;
}

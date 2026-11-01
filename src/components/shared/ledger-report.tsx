"use client";
import { useState } from "react";
import { getBusinessLedger } from "@/actions/reports.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

export function LedgerReport({ initialFrom, initialTo }: { initialFrom?: string; initialTo?: string }) {
  const [from, setFrom] = useState(initialFrom ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(initialTo ?? new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      setEntries(await getBusinessLedger(new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`)));
    } finally {
      setBusy(false);
    }
  }

  function exportLedger(format: "csv" | "xlsx") {
    if (!entries) return;
    const rows = entries.map((entry) => ({ Date: formatDate(entry.date), Type: entry.type, Details: entry.details, Amount: entry.amount }));
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

  const totalAmount = entries?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <Button onClick={load} disabled={busy}>{busy ? "Loading…" : "Apply"}</Button>
      <Button variant="outline" onClick={() => window.print()} disabled={!entries}>Print</Button>
      <Button variant="outline" onClick={() => exportLedger("csv")} disabled={!entries}>CSV</Button>
      <Button variant="outline" onClick={() => exportLedger("xlsx")} disabled={!entries}>Excel</Button>
    </div>
    {entries && <div id="ledger-print" className="space-y-3">
      <Card><CardContent className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span>Transactions: <b>{entries.length}</b></span><span>Total activity: <b>{formatCurrency(totalAmount)}</b></span></CardContent></Card>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50 text-left"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Details</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id} className="border-b"><td className="whitespace-nowrap p-2">{formatDate(entry.date)}</td><td className="whitespace-nowrap p-2">{entry.type}</td><td className="p-2">{entry.details}</td><td className="whitespace-nowrap p-2 text-right">{formatCurrency(entry.amount)}</td></tr>)}
            {entries.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={4}>No transactions for this date range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
}

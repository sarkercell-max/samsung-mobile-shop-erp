"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportsTabsProps {
  data: {
    daily: any[];
    profit: { sales: any[]; totals: { revenue: number; profit: number; discount: number; promo: number } };
    bestSelling: any[];
    managerPerf: any[];
    promoReport: any[];
    customerReport: any[];
    lowStock: any[];
    deadStock: any[];
  };
}

function exportToExcel(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPdf(title: string, head: string[][], body: (string | number)[][], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, { head, body, startY: 20 });
  doc.save(`${filename}.pdf`);
}

function ExportBar({ rows, pdf, filename }: { rows: Record<string, unknown>[]; pdf: { title: string; head: string[][]; body: (string | number)[][] }; filename: string }) {
  return (
    <div className="mb-3 flex gap-2">
      <Button variant="outline" size="sm" onClick={() => exportToExcel(rows, filename)}>
        <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportToCsv(rows, filename)}>
        <Download className="mr-1 h-4 w-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportToPdf(pdf.title, pdf.head, pdf.body, filename)}>
        <FileText className="mr-1 h-4 w-4" /> PDF
      </Button>
    </div>
  );
}

export function ReportsTabs({ data }: ReportsTabsProps) {
  return (
    <Tabs defaultValue="daily">
      <TabsList className="flex-wrap">
        <TabsTrigger value="daily">Daily Sales</TabsTrigger>
        <TabsTrigger value="profit">Profit</TabsTrigger>
        <TabsTrigger value="best">Best Selling</TabsTrigger>
        <TabsTrigger value="managers">Managers</TabsTrigger>
        <TabsTrigger value="promo">Promo</TabsTrigger>
        <TabsTrigger value="customers">Customers</TabsTrigger>
        <TabsTrigger value="stock">Low / Dead Stock</TabsTrigger>
      </TabsList>

      <TabsContent value="daily">
        <ExportBar
          rows={data.daily.map((s) => ({ Invoice: s.invoiceNumber, Customer: s.customer.name, Total: Number(s.total), Time: formatDateTime(s.createdAt) }))}
          pdf={{ title: "Daily Sales Report", head: [["Invoice", "Customer", "Total", "Time"]], body: data.daily.map((s) => [s.invoiceNumber, s.customer.name, formatCurrency(Number(s.total)), formatDateTime(s.createdAt)]) }}
          filename="daily-sales"
        />
        <div className="space-y-2">
          {data.daily.map((s) => (
            <Card key={s.id}><CardContent className="flex items-center justify-between p-3">
              <div><p className="text-sm font-medium">{s.invoiceNumber} · {s.customer.name}</p><p className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</p></div>
              <p className="font-semibold">{formatCurrency(Number(s.total))}</p>
            </CardContent></Card>
          ))}
          {data.daily.length === 0 && <p className="text-sm text-muted-foreground">No sales today.</p>}
        </div>
      </TabsContent>

      <TabsContent value="profit">
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="font-bold">{formatCurrency(data.profit.totals.revenue)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Profit</p><p className="font-bold text-success">{formatCurrency(data.profit.totals.profit)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Discounts</p><p className="font-bold">{formatCurrency(data.profit.totals.discount)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Promo Given</p><p className="font-bold">{formatCurrency(data.profit.totals.promo)}</p></CardContent></Card>
        </div>
        <ExportBar
          rows={data.profit.sales.map((s) => ({ Date: formatDate(s.createdAt), Revenue: Number(s.total), Profit: Number(s.totalProfit) }))}
          pdf={{ title: "Profit Report (This Month)", head: [["Date", "Revenue", "Profit"]], body: data.profit.sales.map((s) => [formatDate(s.createdAt), formatCurrency(Number(s.total)), formatCurrency(Number(s.totalProfit))]) }}
          filename="profit-report"
        />
      </TabsContent>

      <TabsContent value="best">
        <ExportBar
          rows={data.bestSelling.map((b) => ({ Model: b.product?.model, Units: b.unitsSold, Revenue: b.revenue, Profit: b.profit }))}
          pdf={{ title: "Best Selling Products", head: [["Model", "Units", "Revenue", "Profit"]], body: data.bestSelling.map((b) => [b.product?.model ?? "", b.unitsSold, formatCurrency(b.revenue), formatCurrency(b.profit)]) }}
          filename="best-selling"
        />
        <div className="space-y-2">
          {data.bestSelling.map((b, i) => (
            <Card key={i}><CardContent className="flex items-center justify-between p-3">
              <p className="font-medium">{b.product?.model}</p>
              <div className="text-right"><p className="text-sm">{b.unitsSold} units</p><p className="text-xs text-muted-foreground">{formatCurrency(b.revenue)}</p></div>
            </CardContent></Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="managers">
        <ExportBar
          rows={data.managerPerf.map((m) => ({ Manager: m.user?.name, Sales: m.saleCount, Revenue: m.totalSales, Profit: m.totalProfit }))}
          pdf={{ title: "Manager Performance", head: [["Manager", "Sales", "Revenue", "Profit"]], body: data.managerPerf.map((m) => [m.user?.name ?? "", m.saleCount, formatCurrency(m.totalSales), formatCurrency(m.totalProfit)]) }}
          filename="manager-performance"
        />
        <div className="space-y-2">
          {data.managerPerf.map((m, i) => (
            <Card key={i}><CardContent className="flex items-center justify-between p-3">
              <p className="font-medium">{m.user?.name}</p>
              <div className="text-right"><p className="text-sm">{m.saleCount} sales</p><p className="text-xs text-muted-foreground">{formatCurrency(m.totalSales)}</p></div>
            </CardContent></Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="promo">
        <ExportBar
          rows={data.promoReport.map((p) => ({ Model: p.product.model, Type: p.promotion?.promoType, Amount: Number(p.promoAmount), Invoice: p.sale.invoiceNumber }))}
          pdf={{ title: "Samsung Promo Report", head: [["Model", "Type", "Amount", "Invoice"]], body: data.promoReport.map((p) => [p.product.model, p.promotion?.promoType ?? "", formatCurrency(Number(p.promoAmount)), p.sale.invoiceNumber]) }}
          filename="promo-report"
        />
        <div className="space-y-2">
          {data.promoReport.map((p) => (
            <Card key={p.id}><CardContent className="flex items-center justify-between p-3">
              <div><p className="font-medium">{p.product.model}</p><Badge variant="secondary">{p.promotion?.promoType}</Badge></div>
              <p className="font-semibold">{formatCurrency(Number(p.promoAmount))}</p>
            </CardContent></Card>
          ))}
          {data.promoReport.length === 0 && <p className="text-sm text-muted-foreground">No promo-linked sales this month.</p>}
        </div>
      </TabsContent>

      <TabsContent value="customers">
        <ExportBar
          rows={data.customerReport.map((c) => ({ Name: c.customer.name, Phone: c.customer.phone, Orders: c.orderCount, TotalSpent: c.totalSpent }))}
          pdf={{ title: "Customer Report", head: [["Name", "Phone", "Orders", "Total Spent"]], body: data.customerReport.map((c) => [c.customer.name, c.customer.phone, c.orderCount, formatCurrency(c.totalSpent)]) }}
          filename="customer-report"
        />
        <div className="space-y-2">
          {data.customerReport.slice(0, 20).map((c) => (
            <Card key={c.customer.id}><CardContent className="flex items-center justify-between p-3">
              <div><p className="font-medium">{c.customer.name}</p><p className="text-xs text-muted-foreground">{c.orderCount} orders</p></div>
              <p className="font-semibold">{formatCurrency(c.totalSpent)}</p>
            </CardContent></Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="stock">
        <h3 className="mb-2 text-sm font-semibold">Low Stock</h3>
        <div className="mb-4 space-y-2">
          {data.lowStock.map((s: any) => (
            <Card key={s.product.id}><CardContent className="flex items-center justify-between p-3">
              <p className="font-medium">{s.product.model}</p>
              <Badge variant="destructive">{s.availableCount} left</Badge>
            </CardContent></Card>
          ))}
          {data.lowStock.length === 0 && <p className="text-sm text-muted-foreground">All models sufficiently stocked.</p>}
        </div>
        <h3 className="mb-2 text-sm font-semibold">Dead Stock (60+ days)</h3>
        <div className="space-y-2">
          {data.deadStock.map((d: any) => (
            <Card key={d.id}><CardContent className="flex items-center justify-between p-3">
              <p className="font-medium">{d.product.model} · IMEI {d.imei}</p>
              <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
            </CardContent></Card>
          ))}
          {data.deadStock.length === 0 && <p className="text-sm text-muted-foreground">No dead stock detected.</p>}
        </div>
      </TabsContent>
    </Tabs>
  );
}

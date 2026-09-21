"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface InvoicePrintViewProps {
  sale: any;
  store: { name: string; address?: string | null; phone?: string | null };
  format: "a4" | "58mm" | "80mm";
  canSeeCost?: boolean;
}

const PAGE_CSS: Record<InvoicePrintViewProps["format"], string> = {
  a4: `@page { size: A4; margin: 14mm; }`,
  "58mm": `@page { size: 58mm auto; margin: 2mm; }`,
  "80mm": `@page { size: 80mm auto; margin: 3mm; }`,
};

/**
 * Renders a printable invoice. This component is the ENTIRE content of the
 * standalone /invoice/[id] route, so @media print here only ever has to
 * hide this component's own screen-only controls (the Print button) — no
 * sidebar/topbar/navbar can leak into the printout because none renders on
 * this route in the first place.
 */
export function InvoicePrintView({ sale, store, format, canSeeCost = false }: InvoicePrintViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(sale.invoiceNumber, { width: 120, margin: 0 }).then(setQrDataUrl);
  }, [sale.invoiceNumber]);

  const isThermal = format !== "a4";
  const width = format === "58mm" ? "58mm" : format === "80mm" ? "80mm" : "210mm";
  const totalPromo = sale.items.reduce((sum: number, i: any) => sum + Number(i.promoAmount), 0);

  return (
    <div className="mx-auto min-h-screen bg-white p-4 text-black print:min-h-0 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS[format] }} />

      <div className="mb-4 flex justify-center gap-2 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div
        style={{ width, maxWidth: "100%" }}
        className={isThermal ? "mx-auto font-mono text-xs" : "mx-auto border p-8 text-sm"}
      >
        <div className="text-center">
          <p className={isThermal ? "text-sm font-bold" : "text-2xl font-bold"}>{store.name}</p>
          {store.address && <p>{store.address}</p>}
          {store.phone && <p>{store.phone}</p>}
        </div>

        <div className="my-2 border-t border-dashed" />

        <div className="flex justify-between"><span>Invoice</span><span>{sale.invoiceNumber}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{formatDateTime(sale.createdAt)}</span></div>
        <div className="flex justify-between"><span>Customer</span><span>{sale.customer.name}</span></div>
        <div className="flex justify-between"><span>Phone</span><span>{sale.customer.phone}</span></div>

        <div className="my-2 border-t border-dashed" />

        {sale.items.map((item: any) => {
          const gross = Number(item.sellingPrice);
          const promo = Number(item.promoAmount);
          const discount = Number(item.discount);
          const finalPrice = Math.max(gross - promo - discount, 0);
          return (
            <div key={item.id} className="mb-2">
              <p className="font-medium">
                {item.product.model} {item.product.ram}/{item.product.storageCapacity} {item.product.color}
              </p>
              <p className="text-[10px]">IMEI: {item.inventory.imei}</p>
              <div className="flex justify-between"><span>Regular Price</span><span>{formatCurrency(gross)}</span></div>
              {promo > 0 && <div className="flex justify-between"><span>Promotional Discount</span><span>-{formatCurrency(promo)}</span></div>}
              {discount > 0 && <div className="flex justify-between"><span>Additional Discount</span><span>-{formatCurrency(discount)}</span></div>}
              <div className="flex justify-between font-medium"><span>Item Total</span><span>{formatCurrency(finalPrice)}</span></div>
              {canSeeCost && (
                <div className="flex justify-between text-muted-foreground"><span>Profit</span><span>{formatCurrency(Number(item.profit))}</span></div>
              )}
            </div>
          );
        })}

        <div className="my-2 border-t border-dashed" />

        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(sale.subtotal))}</span></div>
        {totalPromo > 0 && <div className="flex justify-between"><span>Promotional Discount</span><span>-{formatCurrency(totalPromo)}</span></div>}
        <div className="flex justify-between"><span>Additional Discount</span><span>-{formatCurrency(Number(sale.discount))}</span></div>
        <div className={isThermal ? "flex justify-between text-sm font-bold" : "flex justify-between text-xl font-bold"}>
          <span>Total Paid</span><span>{formatCurrency(Number(sale.total))}</span>
        </div>

        <div className="my-2 border-t border-dashed" />

        {sale.payments.map((p: any) => (
          <div key={p.id} className="flex justify-between"><span>{p.method}</span><span>{formatCurrency(Number(p.amount))}</span></div>
        ))}

        {qrDataUrl && (
          <div className="mt-3 flex justify-center">
            <img src={qrDataUrl} alt="Invoice QR code" width={100} height={100} />
          </div>
        )}

        <p className="mt-3 text-center text-[10px]">Thank you for shopping with {store.name}!</p>
      </div>
    </div>
  );
}

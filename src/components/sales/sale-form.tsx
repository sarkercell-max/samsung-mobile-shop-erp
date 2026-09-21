"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImeiScanner } from "./imei-scanner";
import { CustomerLookup, type CustomerInfo } from "./customer-lookup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lookupImei, createSale } from "@/actions/sales.actions";
import { formatCurrency, cn } from "@/lib/utils";
import { Smartphone, Tag, ShieldCheck, Gift, Trash2, Loader2, CheckCircle2 } from "lucide-react";

type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "ROCKET" | "CARD" | "BANK" | "SPLIT";

interface ScannedItem {
  inventoryId: string;
  imei: string;
  product: { model: string; ram: string; storageCapacity: string; color: string; sku: string };
  sellingPrice: number;
  warrantyMonths: number;
  promo: { amount: number; type: string } | null;
  // buyingPrice is intentionally NOT part of this client-facing type —
  // the server never sends it to a Manager's browser (see sales.actions.ts).
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BKASH", label: "bKash" },
  { value: "NAGAD", label: "Nagad" },
  { value: "ROCKET", label: "Rocket" },
  { value: "CARD", label: "Card" },
  { value: "BANK", label: "Bank Transfer" },
  { value: "SPLIT", label: "Split Payment" },
];

export function SaleForm({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [success, setSuccess] = useState<{ saleId: string; invoiceNumber: string; total: number } | null>(null);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.sellingPrice, 0), [items]);
  const totalPromo = useMemo(() => items.reduce((sum, i) => sum + (i.promo?.amount ?? 0), 0), [items]);
  const total = Math.max(subtotal - discount, 0);

  async function handleScan(imei: string) {
    if (items.some((i) => i.imei === imei)) {
      setScanError("This IMEI is already added to the current sale.");
      return;
    }
    setScanning(true);
    setScanError(null);
    const res = await lookupImei(imei);
    setScanning(false);

    if (!res.ok) {
      setScanError(res.error);
      toast.error(res.error);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        inventoryId: res.data.inventoryId,
        imei: res.data.imei,
        product: res.data.product,
        sellingPrice: res.data.sellingPrice,
        warrantyMonths: res.data.warrantyMonths,
        promo: res.data.promo,
      },
    ]);
  }

  function removeItem(imei: string) {
    setItems((prev) => prev.filter((i) => i.imei !== imei));
  }

  const canSubmit = items.length > 0 && customer !== null && !submitting;

  function handleSubmit() {
    if (!customer) {
      toast.error("Enter a customer phone number first.");
      return;
    }
    if (items.length === 0) {
      toast.error("Scan at least one IMEI.");
      return;
    }

    startSubmit(async () => {
      const res = await createSale({
        customerPhone: customer.phone,
        customerName: customer.isNew ? customer.name : undefined,
        customerAddress: customer.isNew ? customer.address ?? undefined : undefined,
        imeis: items.map((i) => i.imei),
        discount,
        paymentMethod,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setSuccess({ saleId: res.data.saleId, invoiceNumber: res.data.invoiceNumber, total: res.data.total });
      toast.success(`Sale completed — ${res.data.invoiceNumber}`);
    });
  }

  function startNewSale() {
    setItems([]);
    setCustomer(null);
    setDiscount(0);
    setPaymentMethod("CASH");
    setSuccess(null);
    router.refresh();
  }

  if (success) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8">
          <CheckCircle2 className="h-16 w-16 text-success" />
          <div>
            <h2 className="text-xl font-semibold">Sale Completed</h2>
            <p className="text-muted-foreground">Invoice {success.invoiceNumber}</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(success.total)}</p>
          </div>
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={() => window.open(`/invoice/${success.saleId}`, "_blank")}>
              Print Invoice
            </Button>
            <Button className="flex-1" onClick={startNewSale}>
              New Sale
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 pb-32 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>1. Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerLookup onCustomerResolved={setCustomer} disabled={submitting} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Scan IMEI</CardTitle>
        </CardHeader>
        <CardContent>
          <ImeiScanner onScan={handleScan} disabled={submitting || scanning} />
          {scanError && <p className="mt-2 text-sm font-medium text-destructive">{scanError}</p>}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Scan an IMEI above to add a phone to this sale.</p>}
          {items.map((item) => (
            <div key={item.imei} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-8 w-8 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">
                    {item.product.model} · {item.product.ram}/{item.product.storageCapacity} · {item.product.color}
                  </p>
                  <p className="text-xs text-muted-foreground">IMEI: {item.imei}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="gap-1">
                      <Tag className="h-3 w-3" /> {formatCurrency(item.sellingPrice)}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> {item.warrantyMonths}mo warranty
                    </Badge>
                    {item.promo && (
                      <Badge variant="success" className="gap-1">
                        <Gift className="h-3 w-3" /> {item.promo.type} +{formatCurrency(item.promo.amount)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeItem(item.imei)} disabled={submitting} aria-label="Remove item">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            min={0}
            value={discount || ""}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            placeholder="0"
            disabled={submitting}
          />
          {/* Buying price is never shown or editable here — Manager cannot see cost. */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} disabled={submitting}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sticky mobile-first summary + complete-sale bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 backdrop-blur lg:sticky lg:bottom-4 lg:col-span-2 lg:rounded-2xl lg:border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Subtotal {formatCurrency(subtotal)} {discount > 0 && `− ${formatCurrency(discount)} discount`}
              {totalPromo > 0 && ` · Promo ${formatCurrency(totalPromo)}`}
            </p>
            <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          </div>
          <Button size="lg" onClick={handleSubmit} disabled={!canSubmit} className={cn("min-w-[160px]")}>
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete Sale"}
          </Button>
        </div>
      </div>
    </div>
  );
}

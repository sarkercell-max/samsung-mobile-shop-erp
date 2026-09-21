"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { lookupCustomer } from "@/actions/sales.actions";
import { User, History, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface CustomerInfo {
  id?: string;
  phone: string;
  name: string;
  address?: string | null;
  email?: string | null;
  isNew: boolean;
  purchaseHistory?: { invoiceNumber: string; total: number; date: Date; items: string[] }[];
}

interface CustomerLookupProps {
  onCustomerResolved: (customer: CustomerInfo | null) => void;
  disabled?: boolean;
}

/**
 * The FIRST of the two mandatory sale fields. Debounced phone lookup:
 * existing customers auto-fill name/address/history; unknown numbers reveal
 * a "new customer" mini-form inline.
 */
export function CustomerLookup({ onCustomerResolved, disabled }: CustomerLookupProps) {
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CustomerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePhoneBlur() {
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      if (phone.length > 0) setError("Enter a valid Bangladeshi mobile number (e.g. 01712345678)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await lookupCustomer(phone);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.exists) {
        const info: CustomerInfo = {
          id: res.data.id,
          phone,
          name: res.data.name,
          address: res.data.address,
          email: res.data.email,
          isNew: false,
          purchaseHistory: res.data.purchaseHistory,
        };
        setResult(info);
        onCustomerResolved(info);
      } else {
        const info: CustomerInfo = { phone, name: "", isNew: true };
        setResult(info);
        onCustomerResolved(null); // not resolved until name is filled in
      }
    });
  }

  function updateNewCustomerField(field: "name" | "address" | "email", value: string) {
    if (!result) return;
    const updated = { ...result, [field]: value };
    setResult(updated);
    onCustomerResolved(updated.name.trim() ? updated : null);
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="customerPhone">Customer Phone Number *</Label>
        <div className="relative mt-1.5">
          <Input
            id="customerPhone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            onBlur={handlePhoneBlur}
            placeholder="01XXXXXXXXX"
            inputMode="numeric"
            maxLength={11}
            disabled={disabled}
            className="text-lg"
          />
          {pending && <Loader2 className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>

      {result && !result.isNew && (
        <div className="rounded-xl border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{result.name}</span>
            <Badge variant="secondary">Returning customer</Badge>
          </div>
          {result.address && <p className="mt-1 text-sm text-muted-foreground">{result.address}</p>}
          {!!result.purchaseHistory?.length && (
            <div className="mt-2 border-t pt-2">
              <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <History className="h-3 w-3" /> Purchase history
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.purchaseHistory.slice(0, 3).map((h) => (
                  <li key={h.invoiceNumber}>
                    {formatDate(h.date)} — {h.items.join(", ")} ({formatCurrency(h.total)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result?.isNew && (
        <div className="space-y-3 rounded-xl border border-dashed p-3">
          <Badge variant="outline">New customer — quick add</Badge>
          <div>
            <Label htmlFor="newCustomerName">Name *</Label>
            <Input
              id="newCustomerName"
              className="mt-1.5"
              value={result.name}
              onChange={(e) => updateNewCustomerField("name", e.target.value)}
              placeholder="Customer full name"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="newCustomerAddress">Address (optional)</Label>
            <Input
              id="newCustomerAddress"
              className="mt-1.5"
              value={result.address ?? ""}
              onChange={(e) => updateNewCustomerField("address", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

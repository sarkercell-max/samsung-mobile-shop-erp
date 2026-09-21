"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSettings } from "@/actions/settings.actions";

export function SettingsForm({ settings }: { settings: any }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    invoicePrefix: settings.invoicePrefix,
    purchasePrefix: settings.purchasePrefix,
    lowStockThreshold: String(settings.lowStockThreshold),
    thermalWidth: settings.thermalWidth,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSettings({ ...form, lowStockThreshold: Number(form.lowStockThreshold) } as any);
      if (!res.ok) {
  toast.error(res.error);
  return;
}
      toast.success("Settings saved");
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><Label>Invoice Prefix</Label><Input className="mt-1.5" value={form.invoicePrefix} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))} /></div>
          <div><Label>Purchase Prefix</Label><Input className="mt-1.5" value={form.purchasePrefix} onChange={(e) => setForm((f) => ({ ...f, purchasePrefix: e.target.value }))} /></div>
          <div><Label>Low Stock Threshold</Label><Input className="mt-1.5" type="number" value={form.lowStockThreshold} onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} /></div>
          <div>
            <Label>Default Invoice Print Format</Label>
            <Select value={form.thermalWidth} onValueChange={(v) => setForm((f) => ({ ...f, thermalWidth: v }))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">Thermal 58mm</SelectItem>
                <SelectItem value="80mm">Thermal 80mm</SelectItem>
                <SelectItem value="A4">A4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Saving..." : "Save Settings"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

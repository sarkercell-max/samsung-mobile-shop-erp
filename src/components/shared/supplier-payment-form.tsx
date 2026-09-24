"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordSupplierPayment } from "@/actions/suppliers.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function SupplierPaymentForm({ supplierId }: { supplierId: string }) {
  const [pending, start] = useTransition(); const router = useRouter();
  const [method, setMethod] = useState("CASH");
  return <Card><CardHeader><CardTitle>Record Supplier Payment</CardTitle></CardHeader><CardContent>
    <form className="grid gap-3 sm:grid-cols-2" action={(form) => start(async () => {
      const result = await recordSupplierPayment({ supplierId, amount: form.get("amount"), paymentDate: form.get("paymentDate"), paymentMethod: method, reference: form.get("reference"), note: form.get("note") });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Supplier payment recorded."); router.refresh();
    })}>
      <div><Label>Payment Date</Label><Input className="mt-1" name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0,10)} required /></div>
      <div><Label>Amount</Label><Input className="mt-1" name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div><Label>Payment Method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["CASH","BKASH","NAGAD","ROCKET","CARD","BANK"].map((m)=><SelectItem value={m} key={m}>{m}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Reference / Transaction No.</Label><Input className="mt-1" name="reference" /></div>
      <div className="sm:col-span-2"><Label>Note</Label><Input className="mt-1" name="note" /></div>
      <Button className="sm:col-span-2" disabled={pending}>{pending ? "Saving…" : "Record Payment"}</Button>
    </form>
  </CardContent></Card>;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpense } from "@/actions/expenses.actions";

const CATEGORIES = ["RENT", "SALARY", "ELECTRICITY", "INTERNET", "MARKETING", "TRANSPORT", "MISCELLANEOUS"] as const;

export default function NewExpensePage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ category: "RENT" as (typeof CATEGORIES)[number], amount: "", description: "", expenseDate: new Date().toISOString().slice(0, 10) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
  const res = await createExpense({
    category: form.category,
    amount: Number(form.amount),
    description: form.description || undefined,
    expenseDate: new Date(form.expenseDate),
  });

  if (!res.ok) {
    toast.error(res.error);
    return;
  }

  toast.success("Expense recorded");
});
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader><CardTitle>Add Expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as any }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (BDT)</Label><Input className="mt-1.5" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required /></div>
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} required /></div>
            <div><Label>Description (optional)</Label><Input className="mt-1.5" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Saving..." : "Save Expense"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStore } from "@/actions/stores.actions";
import { Button } from "@/components/ui/button";

export function CreateStoreForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  return <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={async (event) => {
    event.preventDefault(); setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const result = await createStore({ name: String(form.get("name") ?? ""), address: String(form.get("address") ?? ""), phone: String(form.get("phone") ?? "") });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Shop created."); formElement.reset(); router.refresh();
    } catch { toast.error("Could not create shop."); }
    finally { setSaving(false); }
  }}>
    <input name="name" required minLength={2} maxLength={120} placeholder="Shop name" className="rounded-lg border bg-background px-3 py-2 text-sm" />
    <input name="address" maxLength={250} placeholder="Address (optional)" className="rounded-lg border bg-background px-3 py-2 text-sm" />
    <input name="phone" maxLength={30} placeholder="Phone (optional)" className="rounded-lg border bg-background px-3 py-2 text-sm" />
    <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Add Shop"}</Button>
  </form>;
}

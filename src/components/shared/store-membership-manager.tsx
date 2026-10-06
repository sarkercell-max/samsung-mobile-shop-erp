"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { assignUserToStore, removeUserFromStore, updateStoreDetails } from "@/actions/stores.actions";
import { Button } from "@/components/ui/button";

type UserOption = { id: string; name: string; email: string; role: "OWNER" | "MANAGER"; isActive: boolean };
type StoreOption = { id: string; name: string; address: string | null; phone: string | null; memberships: { user: UserOption }[]; _count: { inventory: number } };

export function StoreMembershipManager({ stores, users }: { stores: StoreOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return <div className="space-y-3">
    {stores.map((store) => {
      const assignedIds = new Set(store.memberships.map((membership) => membership.user.id));
      const availableUsers = users.filter((user) => user.role !== "OWNER" && !assignedIds.has(user.id));
      return <section key={store.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{store.name}</h2><p className="text-xs text-muted-foreground">{store.memberships.length} assigned staff · {store._count.inventory} inventory units</p></div>
          <div className="flex gap-2"><select className="max-w-56 rounded-lg border bg-background px-3 py-2 text-sm" value={selected[store.id] ?? ""} onChange={(event) => setSelected((value) => ({ ...value, [store.id]: event.target.value }))}><option value="">Assign existing staff…</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select><Button size="sm" disabled={busy || !selected[store.id]} onClick={async () => { setBusy(true); try { const result = await assignUserToStore(selected[store.id]!, store.id); if (!result.ok) toast.error(result.error); else { toast.success("Shop access assigned."); setSelected((value) => ({ ...value, [store.id]: "" })); router.refresh(); } } finally { setBusy(false); } }}>Assign</Button></div>
        </div>
        <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { const result = await updateStoreDetails(store.id, { name: String(form.get("name") ?? ""), address: String(form.get("address") ?? ""), phone: String(form.get("phone") ?? "") }); if (!result.ok) toast.error(result.error); else { toast.success("Shop details updated."); router.refresh(); } } finally { setBusy(false); } }}>
          <input name="name" required minLength={2} maxLength={120} defaultValue={store.name} className="rounded-lg border bg-background px-3 py-2 text-sm" aria-label="Shop name" />
          <input name="address" maxLength={250} defaultValue={store.address ?? ""} placeholder="Address" className="rounded-lg border bg-background px-3 py-2 text-sm" aria-label="Shop address" />
          <input name="phone" maxLength={30} defaultValue={store.phone ?? ""} placeholder="Phone" className="rounded-lg border bg-background px-3 py-2 text-sm" aria-label="Shop phone" />
          <Button size="sm" variant="outline" disabled={busy}>Save details</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">{store.memberships.map(({ user }) => <div key={user.id} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"><span>{user.name} · {user.role}{user.isActive ? "" : " · inactive"}</span>{user.role === "MANAGER" && <button type="button" className="font-semibold text-destructive" disabled={busy} onClick={async () => { setBusy(true); try { const result = await removeUserFromStore(user.id, store.id); if (!result.ok) toast.error(result.error); else { toast.success("Shop access removed."); router.refresh(); } } finally { setBusy(false); } }}>Remove</button>}</div>)}</div>
      </section>;
    })}
  </div>;
}

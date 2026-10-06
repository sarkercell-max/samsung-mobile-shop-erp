"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "@prisma/client";
import { switchActiveStore } from "@/actions/stores.actions";
import { toast } from "sonner";

export function StoreSelector({ stores, currentStoreId }: { stores: Pick<Store, "id" | "name">[]; currentStoreId: string }) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  if (stores.length < 2) return <span className="hidden text-sm text-muted-foreground sm:inline">{stores[0]?.name}</span>;
  return <label className="flex items-center gap-2 text-sm">
    <span className="hidden text-muted-foreground sm:inline">Current shop</span>
    <select aria-label="Current shop" className="max-w-44 rounded-lg border bg-background px-3 py-2 font-medium" value={currentStoreId} disabled={switching} onChange={async (event) => {
      setSwitching(true);
      try {
        const result = await switchActiveStore(event.target.value);
        if (!result.ok) { toast.error(result.error); return; }
        router.refresh();
      } catch { toast.error("Could not switch shops."); }
      finally { setSwitching(false); }
    }}>
      {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
    </select>
  </label>;
}

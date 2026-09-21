"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { deactivateProduct, reactivateProduct, deleteProductIfUnused } from "@/actions/products.actions";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

export function ProductActions({ productId, model, isActive }: { productId: string; model: string; isActive: boolean }) {
  const router = useRouter();

  if (isActive) {
    return (
      <div className="flex gap-1.5">
        <ConfirmActionDialog
          trigger={<Button variant="outline" size="sm"><Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>}
          title={`Archive ${model}?`}
          description="Removes this product from purchase/sale pickers without touching any historical data. You can restore it any time."
          destructive={false}
          confirmLabel="Archive"
          successMessage="Product archived."
          onConfirm={async () => {
            const res = await deactivateProduct(productId);
            if (res.ok) router.refresh();
            return res;
          }}
        />
        <ConfirmActionDialog
          trigger={<Button variant="destructive" size="sm"><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>}
          title={`Delete ${model}?`}
          description="Only possible if this product has never been used in any purchase, sale, inventory, or promotion. This cannot be undone."
          confirmLabel="Delete"
          successMessage="Product deleted."
          onConfirm={() => deleteProductIfUnused(productId).then((res) => { if (res.ok) router.refresh(); return res; })}
        />
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const res = await reactivateProduct(productId);
        if (res.ok) router.refresh();
      }}
    >
      <ArchiveRestore className="mr-1 h-3.5 w-3.5" /> Restore
    </Button>
  );
}

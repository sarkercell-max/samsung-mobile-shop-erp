"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { cancelPurchaseBatch } from "@/actions/purchase.actions";
import { Ban } from "lucide-react";

export function CancelPurchaseButton({ purchaseBatchId, purchaseNumber }: { purchaseBatchId: string; purchaseNumber: string }) {
  const router = useRouter();

  return (
    <ConfirmActionDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Ban className="mr-1 h-3.5 w-3.5" /> Cancel
        </Button>
      }
      title={`Cancel purchase ${purchaseNumber}?`}
      description="Only allowed while every unit from this purchase is still AVAILABLE (nothing sold, returned, or reserved). Cancelled units are removed from sellable inventory but the purchase record itself is kept for audit history — it is never deleted."
      requireReason
      reasonLabel="Cancellation reason"
      confirmLabel="Cancel Purchase"
      successMessage="Purchase cancelled."
      onConfirm={async (reason) => {
        const res = await cancelPurchaseBatch({ purchaseBatchId, reason: reason! });
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}

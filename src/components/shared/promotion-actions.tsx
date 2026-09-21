"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { togglePromotion, deletePromotionIfUnused } from "@/actions/promotions.actions";
import { Trash2, Power, PowerOff } from "lucide-react";

export function PromotionActions({ promotionId, model, isActive }: { promotionId: string; model: string; isActive: boolean }) {
  const router = useRouter();

  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          const res = await togglePromotion(promotionId, !isActive);
          if (res.ok) router.refresh();
        }}
      >
        {isActive ? <PowerOff className="mr-1 h-3.5 w-3.5" /> : <Power className="mr-1 h-3.5 w-3.5" />}
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      <ConfirmActionDialog
        trigger={<Button variant="destructive" size="sm"><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>}
        title={`Delete promotion for ${model}?`}
        description="Only possible if this promotion was never applied to a sale. If it's already been used, deactivate it instead — its historical sales keep their original promotion amount either way."
        confirmLabel="Delete"
        successMessage="Promotion deleted."
        onConfirm={() => deletePromotionIfUnused(promotionId).then((res) => { if (res.ok) router.refresh(); return res; })}
      />
    </div>
  );
}

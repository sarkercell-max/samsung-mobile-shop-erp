"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { voidSale } from "@/actions/sales.actions";
import { Ban } from "lucide-react";

export function SaleVoidButton({ saleId, invoiceNumber }: { saleId: string; invoiceNumber: string }) {
  const router = useRouter();

  return (
    <ConfirmActionDialog
      trigger={
        <Button variant="destructive">
          <Ban className="mr-1 h-4 w-4" /> Void Sale
        </Button>
      }
      title={`Void invoice ${invoiceNumber}?`}
      description="This permanently cancels the sale for accounting purposes (it is never hard-deleted — the record stays visible in reports as CANCELLED) and returns every IMEI in this sale to AVAILABLE inventory so it can be sold again. This cannot be undone from this screen."
      confirmLabel="Void Sale"
      successMessage="Sale voided — inventory restored."
      onConfirm={async () => {
        const res = await voidSale(saleId);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { archiveCustomer } from "@/actions/customers.actions";
import { Archive } from "lucide-react";

export function CustomerArchiveButton({ customerId, name }: { customerId: string; name: string }) {
  const router = useRouter();

  return (
    <ConfirmActionDialog
      trigger={
        <Button variant="outline" size="sm">
          <Archive className="mr-1 h-3.5 w-3.5" /> Archive
        </Button>
      }
      title={`Archive ${name}?`}
      description="Only possible if this customer has zero sales on record. This removes them from the active customer list."
      confirmLabel="Archive"
      successMessage="Customer archived."
      onConfirm={() => archiveCustomer(customerId).then((res) => { if (res.ok) router.refresh(); return res; })}
    />
  );
}

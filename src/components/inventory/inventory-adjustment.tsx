"use client";

import { useRouter } from "next/navigation";
import { adjustStock } from "@/actions/inventory.actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InventoryAdjustment({ inventoryId, status }: { inventoryId: string; status: string }) {
  const router = useRouter();
  if (status !== "AVAILABLE") return null;
  return <div className="mt-2 flex justify-end gap-1"><Button size="sm" variant="outline" onClick={async()=>{const reason=window.prompt("Reason for marking this phone damaged:");if(!reason?.trim())return;const result=await adjustStock({inventoryId,type:"DAMAGE",reason});if(!result.ok){toast.error(result.error);return;}toast.success("Stock marked damaged.");router.refresh();}}>Mark damaged</Button><Button size="sm" variant="outline" onClick={async()=>{const reason=window.prompt("Reason for marking this phone lost:");if(!reason?.trim())return;const result=await adjustStock({inventoryId,type:"LOSS",reason});if(!result.ok){toast.error(result.error);return;}toast.success("Stock marked lost.");router.refresh();}}>Mark lost</Button></div>;
}

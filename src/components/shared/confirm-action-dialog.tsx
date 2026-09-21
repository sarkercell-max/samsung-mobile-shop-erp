"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConfirmActionDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  requireReason?: boolean;
  reasonLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (reason?: string) => Promise<{ ok: boolean; error?: string }>;
  successMessage?: string;
}

/**
 * Shared confirmation dialog for every void/cancel/archive/delete action in
 * the app — so every destructive action gets the same "are you sure" UX,
 * loading state, and toast handling instead of each page reinventing it.
 */
export function ConfirmActionDialog({
  trigger, title, description, requireReason, reasonLabel = "Reason", confirmLabel = "Confirm", destructive = true, onConfirm, successMessage = "Done",
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (requireReason && reason.trim().length === 0) {
      toast.error(`${reasonLabel} is required.`);
      return;
    }
    startTransition(async () => {
      const res = await onConfirm(requireReason ? reason.trim() : undefined);
      if (!res.ok) {
        toast.error(res.error ?? "Action failed.");
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        {requireReason && (
          <div>
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Input id="confirm-reason" className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

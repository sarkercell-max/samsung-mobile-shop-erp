"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupplier } from "@/actions/suppliers.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SupplierCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createSupplier({ name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      toast.success("Supplier added.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add Supplier</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Supplier name"
            maxLength={120}
            required
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !name.trim()} className="sm:shrink-0">
            {pending ? "Adding…" : "Add Supplier"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

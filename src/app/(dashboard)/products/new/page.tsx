"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createProduct } from "@/actions/products.actions";

export default function NewProductPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    model: "",
    ram: "",
    storageCapacity: "",
    color: "",
    sku: "",
    barcode: "",
    defaultBuyingPrice: "",
    defaultSellingPrice: "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({
      ...f,
      [field]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      const res = await createProduct({
        brand: "Samsung",
        model: form.model,
        ram: form.ram,
        storageCapacity: form.storageCapacity,
        color: form.color,
        sku: form.sku,
        barcode: form.barcode || undefined,
        defaultBuyingPrice: Number(form.defaultBuyingPrice),
        defaultSellingPrice: Number(form.defaultSellingPrice),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Product created");
      router.push("/products");
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Add Product</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Model</Label>
              <Input
                className="mt-1.5"
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder="Galaxy S24 Ultra"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RAM</Label>
                <Input
                  className="mt-1.5"
                  value={form.ram}
                  onChange={(e) => update("ram", e.target.value)}
                  placeholder="12GB"
                  required
                />
              </div>

              <div>
                <Label>Storage</Label>
                <Input
                  className="mt-1.5"
                  value={form.storageCapacity}
                  onChange={(e) =>
                    update("storageCapacity", e.target.value)
                  }
                  placeholder="256GB"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <Input
                className="mt-1.5"
                value={form.color}
                onChange={(e) => update("color", e.target.value)}
                required
              />
            </div>

            <div>
              <Label>SKU</Label>
              <Input
                className="mt-1.5"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
                required
              />
            </div>

            <div>
              <Label>Barcode (optional)</Label>
              <Input
                className="mt-1.5"
                value={form.barcode}
                onChange={(e) => update("barcode", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase Price (BDT)</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultBuyingPrice}
                  onChange={(e) =>
                    update("defaultBuyingPrice", e.target.value)
                  }
                  required
                />
              </div>

              <div>
                <Label>Sale Price (BDT)</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultSellingPrice}
                  onChange={(e) =>
                    update("defaultSellingPrice", e.target.value)
                  }
                  required
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              These become the product&apos;s first price period — you can
              open a new one any time from the product&apos;s Pricing page
              without losing this history.
            </p>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending ? "Saving..." : "Save Product"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

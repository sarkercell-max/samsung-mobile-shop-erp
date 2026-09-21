"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPromotion } from "@/actions/promotions.actions";
import { listProducts } from "@/actions/products.actions";

export default function NewPromotionPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [products, setProducts] = useState<
    { id: string; model: string }[]
  >([]);

  const [form, setForm] = useState({
    productId: "",
    startDate: "",
    endDate: "",
    promoAmount: "",
    promoType: "CASHBACK" as const,
  });

  useEffect(() => {
    listProducts().then((result) => {
      setProducts(result as { id: string; model: string }[]);
    });
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const month = form.startDate.slice(0, 7);

    startTransition(async () => {
      const res = await createPromotion({
        month,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        productId: form.productId,
        promoAmount: Number(form.promoAmount),
        promoType: form.promoType,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Promotion created");
      router.push("/promotions");
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>New Promotion</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Model</Label>

              <Select
                value={form.productId}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    productId: value,
                  }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>

                <SelectContent>
                  {products.map((product) => (
                    <SelectItem
                      key={product.id}
                      value={product.id}
                    >
                      {product.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>

                <Input
                  className="mt-1.5"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div>
                <Label>End Date</Label>

                <Input
                  className="mt-1.5"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      endDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label>Promo Type</Label>

              <Select
                value={form.promoType}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    promoType: value as typeof f.promoType,
                  }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="CASHBACK">
                    Cashback
                  </SelectItem>

                  <SelectItem value="GIFT">
                    Gift
                  </SelectItem>

                  <SelectItem value="DEALER_INCENTIVE">
                    Dealer Incentive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Promo Amount (BDT)</Label>

              <Input
                className="mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={form.promoAmount}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    promoAmount: e.target.value,
                  }))
                }
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending ? "Saving..." : "Create Promotion"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

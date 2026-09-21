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
import { createPurchaseBatch } from "@/actions/purchase.actions";
import { listProducts } from "@/actions/products.actions";
import { getCurrentPricing } from "@/actions/pricing.actions";
import { Plus, Trash2 } from "lucide-react";

interface Row {
  productId: string;
  imei: string;
  buyingPrice: string;
}

interface Product {
  id: string;
  model: string;
  ram: string;
  storageCapacity: string;
  color: string;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [products, setProducts] = useState<Product[]>([]);

  const [supplierName, setSupplierName] = useState(
    "Samsung Bangladesh Distribution Ltd."
  );

  const [batchNumber, setBatchNumber] = useState("");

  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [remarks, setRemarks] = useState("");

  const [rows, setRows] = useState<Row[]>([
    {
      productId: "",
      imei: "",
      buyingPrice: "",
    },
  ]);

  useEffect(() => {
    listProducts().then((result) => {
      setProducts(result as Product[]);
    });
  }, []);

  function updateRow(
    idx: number,
    field: keyof Row,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  // Prefill today's purchase price from the product's current price period.
  // The Owner can still override the price before submitting.
  async function handleProductSelect(
    idx: number,
    productId: string
  ) {
    updateRow(idx, "productId", productId);

    const current = await getCurrentPricing(productId);

    if (current && !rows[idx]?.buyingPrice) {
      updateRow(
        idx,
        "buyingPrice",
        String(current.purchasePrice)
      );
    }
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        productId: "",
        imei: "",
        buyingPrice: "",
      },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) =>
      prev.filter((_, i) => i !== idx)
    );
  }

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    startTransition(async () => {
      const res = await createPurchaseBatch({
        supplierName,
        batchNumber,
        purchaseDate: new Date(purchaseDate),
        remarks: remarks || undefined,
        items: rows.map((row) => ({
          productId: row.productId,
          imei: row.imei,
          buyingPrice: Number(row.buyingPrice),
          warrantyMonths: 12,
        })),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        `Purchase ${res.data.purchaseNumber} received — ${rows.length} units added to inventory.`
      );

      router.push("/purchase");
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">
        New Purchase
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Supplier</Label>

              <Input
                className="mt-1.5"
                value={supplierName}
                onChange={(e) =>
                  setSupplierName(e.target.value)
                }
                required
              />
            </div>

            <div>
              <Label>Batch Number</Label>

              <Input
                className="mt-1.5"
                value={batchNumber}
                onChange={(e) =>
                  setBatchNumber(e.target.value)
                }
                required
              />
            </div>

            <div>
              <Label>Purchase Date</Label>

              <Input
                className="mt-1.5"
                type="date"
                value={purchaseDate}
                onChange={(e) =>
                  setPurchaseDate(e.target.value)
                }
                required
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Remarks</Label>

              <Input
                className="mt-1.5"
                value={remarks}
                onChange={(e) =>
                  setRemarks(e.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              IMEI Items ({rows.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 rounded-xl border p-2"
              >
                <div>
                  <Label className="text-xs">
                    Product
                  </Label>

                  <Select
                    value={row.productId}
                    onValueChange={(value) =>
                      handleProductSelect(idx, value)
                    }
                  >
                    <SelectTrigger className="mt-1 h-10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>

                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem
                          key={product.id}
                          value={product.id}
                        >
                          {product.model}{" "}
                          {product.ram}/
                          {product.storageCapacity}{" "}
                          {product.color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">
                    IMEI
                  </Label>

                  <Input
                    className="mt-1 h-10"
                    value={row.imei}
                    onChange={(e) =>
                      updateRow(
                        idx,
                        "imei",
                        e.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    maxLength={17}
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs">
                    Buying Price
                  </Label>

                  <Input
                    className="mt-1 h-10"
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.buyingPrice}
                    onChange={(e) =>
                      updateRow(
                        idx,
                        "buyingPrice",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    removeRow(idx)
                  }
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addRow}
              className="w-full"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add another IMEI
            </Button>
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending}
        >
          {pending
            ? "Receiving..."
            : `Receive ${rows.length} Units`}
        </Button>
      </form>
    </div>
  );
}


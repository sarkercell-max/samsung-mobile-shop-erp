import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPriceHistory } from "@/actions/pricing.actions";
import { notFound } from "next/navigation";
import { PricingManager } from "@/components/shared/pricing-manager";

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOwner();
  const { id } = await params;

  const product = await prisma.product.findFirst({ where: { id, storeId: user.storeId } });
  if (!product) notFound();

  const history = await listPriceHistory(id);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{product.model}</h1>
        <p className="text-sm text-muted-foreground">{product.ram} / {product.storageCapacity} · {product.color}</p>
      </div>
      <PricingManager productId={product.id} history={history} />
    </div>
  );
}

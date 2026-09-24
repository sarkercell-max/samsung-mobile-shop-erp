"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import {
  createPurchaseBatchSchema, cancelPurchaseBatchSchema,
  type CreatePurchaseBatchInput, type CancelPurchaseBatchInput,
} from "@/lib/validations/purchase";
import { revalidatePath } from "next/cache";
import { Prisma, InventoryStatus } from "@prisma/client";

/**
 * Receives a new purchase batch from the Samsung distributor and imports
 * every IMEI directly into Inventory as AVAILABLE stock.
 *
 * ATOMICITY: PurchaseBatch + every PurchaseItem + every Inventory row are
 * all created inside ONE Prisma interactive transaction. If any single
 * insert fails, Prisma rolls back the entire transaction — no partial
 * purchase batch, no orphaned purchase items, no missing inventory rows can
 * ever be persisted. We additionally verify the inserted inventory count
 * matches the submitted item count, and raise the interactive-transaction
 * timeout for large batches (Prisma's default is 5s).
 */
export async function createPurchaseBatch(input: CreatePurchaseBatchInput) {
  const user = await requireOwner();
  const parsed = createPurchaseBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const imeis = data.items.map((i) => i.imei);
  const dupes = await prisma.inventory.findMany({ where: { storeId: user.storeId, imei: { in: imeis } } });
  if (dupes.length > 0) {
    return { ok: false as const, error: `IMEI ${dupes[0]!.imei} already exists in inventory (status: ${dupes[0]!.status}).` };
  }

  const productIds = [...new Set(data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, storeId: user.storeId } });
  const productById = new Map(products.map((p) => [p.id, p]));
  const missingProduct = data.items.find((i) => !productById.has(i.productId));
  if (missingProduct) {
    return { ok: false as const, error: "One or more selected products could not be found in this store." };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const numberResult = await tx.$queryRaw<{ next_purchase_number: string }[]>`
          select next_purchase_number('PB') as next_purchase_number
        `;
        const purchaseNumber = numberResult[0]!.next_purchase_number;

        const supplier = await tx.supplier.upsert({
          where: { storeId_name: { storeId: user.storeId, name: data.supplierName.trim() } },
          create: { storeId: user.storeId, name: data.supplierName.trim() },
          update: {},
        });

        const batch = await tx.purchaseBatch.create({
          data: {
            storeId: user.storeId,
            purchaseNumber,
            supplierName: supplier.name,
            supplierId: supplier.id,
            batchNumber: data.batchNumber,
            purchaseDate: data.purchaseDate,
            remarks: data.remarks,
            createdById: user.id,
          },
        });

        const createdInventoryIds: string[] = [];
        for (const item of data.items) {
          const product = productById.get(item.productId)!;
          const purchaseItem = await tx.purchaseItem.create({
            data: { purchaseBatchId: batch.id, productId: item.productId, imei: item.imei, buyingPrice: item.buyingPrice },
          });
          const inventoryRow = await tx.inventory.create({
            data: {
              storeId: user.storeId,
              productId: item.productId,
              purchaseItemId: purchaseItem.id,
              imei: item.imei,
              buyingPrice: item.buyingPrice,
              sellingPrice: item.sellingPrice ?? product.defaultSellingPrice,
              warrantyMonths: item.warrantyMonths,
              status: "AVAILABLE",
            },
          });
          createdInventoryIds.push(inventoryRow.id);
        }

        if (createdInventoryIds.length !== data.items.length) {
          throw new Error(
            `Inventory creation mismatch: expected ${data.items.length} units, created ${createdInventoryIds.length}. Rolling back.`
          );
        }

        await tx.auditLog.create({
          data: {
            storeId: user.storeId, userId: user.id, action: "purchase.create",
            entityType: "PurchaseBatch", entityId: batch.id,
            metadata: { purchaseNumber, itemCount: data.items.length, imeis },
          },
        });

        return { batch, inventoryCount: createdInventoryIds.length };
      },
      { timeout: 20_000, maxWait: 10_000 }
    );

    revalidatePath("/purchase");
    revalidatePath("/suppliers");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true as const, data: result.batch, inventoryCreated: result.inventoryCount };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false as const, error: "One of these IMEIs was just added by another purchase — please remove the duplicate and try again." };
    }
    const message = err instanceof Error ? err.message : "Failed to create purchase batch.";
    return { ok: false as const, error: message };
  }
}

/**
 * Cancels/voids a purchase batch. A batch with zero SOLD/RETURNED/RESERVED
 * units can be safely voided (its units flip to CANCELLED and are removed
 * from sellable stock); a batch with ANY unit already sold or reserved is
 * rejected outright. The batch row is NEVER hard-deleted.
 */
export async function cancelPurchaseBatch(input: CancelPurchaseBatchInput) {
  const user = await requireOwner();
  const parsed = cancelPurchaseBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { purchaseBatchId, reason } = parsed.data;

  const batch = await prisma.purchaseBatch.findFirst({
    where: { id: purchaseBatchId, storeId: user.storeId },
    include: { items: { include: { inventory: true } } },
  });
  if (!batch) return { ok: false as const, error: "Purchase batch not found." };
  if (batch.status === "CANCELLED") return { ok: false as const, error: "This purchase batch is already cancelled." };

  const inventoryUnits = batch.items.map((i) => i.inventory).filter((i): i is NonNullable<typeof i> => i !== null);
  const committed = inventoryUnits.filter((u) => u.status === "SOLD" || u.status === "RETURNED" || u.status === "RESERVED");

  if (committed.length > 0) {
    return {
      ok: false as const,
      error: `Cannot cancel — ${committed.length} of ${inventoryUnits.length} unit(s) from this purchase are already sold, returned, or reserved. Void the individual sale(s) first if this was a mistake.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseBatch.update({
      where: { id: batch.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.id, cancelReason: reason },
    });
    await tx.inventory.updateMany({
      where: { id: { in: inventoryUnits.map((u) => u.id) } },
      data: { status: InventoryStatus.CANCELLED },
    });
    await tx.auditLog.create({
      data: {
        storeId: user.storeId, userId: user.id, action: "purchase.cancel",
        entityType: "PurchaseBatch", entityId: batch.id,
        metadata: { reason, unitsCancelled: inventoryUnits.length },
      },
    });
  });

  revalidatePath("/purchase");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function listPurchaseBatches() {
  const user = await requireOwner();
  return prisma.purchaseBatch.findMany({
    where: { storeId: user.storeId },
    include: { items: { include: { product: true, inventory: true } }, createdBy: true, cancelledBy: true },
    orderBy: { createdAt: "desc" },
  });
}

"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { imeiLookupSchema, customerLookupSchema, createSaleSchema, type CreateSaleInput } from "@/lib/validations/sale";
import { revalidatePath } from "next/cache";
import { InventoryStatus } from "@prisma/client";

// ============================================================================
// IMEI LOOKUP — the auto-fill engine for the sales screen.
// Fetches product, price, promo, warranty, and inventory status from a
// single scanned/typed IMEI.
// ============================================================================
export async function lookupImei(rawImei: string) {
  const user = await getCurrentUser();
  const parsed = imeiLookupSchema.safeParse({ imei: rawImei });

  if (!parsed.success) {
    return { ok: false as const, error: "Invalid IMEI format." };
  }

  const record = await inventoryRepository.findByImei(user.storeId, parsed.data.imei);

  if (!record) {
    return { ok: false as const, error: "No phone found with this IMEI." };
  }

  if (record.status === InventoryStatus.SOLD) {
    return { ok: false as const, error: "This IMEI has already been sold." };
  }
  if (record.status === InventoryStatus.RETURNED) {
    return { ok: false as const, error: "This IMEI was returned and is not available for sale." };
  }
  if (record.status === InventoryStatus.LOST) {
    return { ok: false as const, error: "This IMEI is marked as lost/missing in inventory." };
  }
  if (record.status === InventoryStatus.RESERVED) {
    return { ok: false as const, error: "This unit is currently reserved for another customer." };
  }

  // Find an active promotion for this product, if any.
  const now = new Date();
  const promo = await prisma.promotion.findFirst({
    where: {
      storeId: user.storeId,
      productId: record.productId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  return {
    ok: true as const,
    data: {
      inventoryId: record.id,
      imei: record.imei,
      product: {
        id: record.product.id,
        model: record.product.model,
        ram: record.product.ram,
        storageCapacity: record.product.storageCapacity,
        color: record.product.color,
        sku: record.product.sku,
      },
      // Buying price is fetched for profit calculation but MUST NEVER be
      // rendered to a Manager on the client — filter it out at the UI layer.
      buyingPrice: Number(record.buyingPrice),
      sellingPrice: Number(record.sellingPrice),
      warrantyMonths: record.warrantyMonths,
      promo: promo
        ? { id: promo.id, amount: Number(promo.promoAmount), type: promo.promoType }
        : null,
      status: record.status,
    },
  };
}

// ============================================================================
// CUSTOMER LOOKUP — auto-fill on phone number entry.
// ============================================================================
export async function lookupCustomer(rawPhone: string) {
  const user = await getCurrentUser();
  const parsed = customerLookupSchema.safeParse({ phone: rawPhone });

  if (!parsed.success) {
    return { ok: false as const, error: "Invalid phone number." };
  }

  const customer = await customerRepository.findByPhone(user.storeId, parsed.data.phone);

  if (!customer) {
    return { ok: true as const, exists: false as const };
  }

  return {
    ok: true as const,
    exists: true as const,
    data: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
      email: customer.email,
      purchaseHistory: customer.sales.map((s) => ({
        invoiceNumber: s.invoiceNumber,
        total: Number(s.total),
        date: s.createdAt,
        items: s.items.map((i) => i.product.model),
      })),
    },
  };
}

// ============================================================================
// CREATE SALE
// Managers can only sell — they can never see or submit a buying price.
// Profit = sellingPrice - buyingPrice + promoAmount - discount, computed
// server-side from trusted inventory data (never trusts client-sent prices).
// ============================================================================
export async function createSale(input: CreateSaleInput) {
  const user = await getCurrentUser();
  const parsed = createSaleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const data = parsed.data;

  return prisma.$transaction(async (tx) => {
    // 1. Resolve / create the customer
    let customer = await tx.customer.findUnique({
      where: { storeId_phone: { storeId: user.storeId, phone: data.customerPhone } },
    });

    if (!customer) {
      if (!data.customerName) {
        throw new Error("Customer not found — name is required to create a new customer.");
      }
      customer = await tx.customer.create({
        data: {
          storeId: user.storeId,
          phone: data.customerPhone,
          name: data.customerName,
          address: data.customerAddress,
          email: data.customerEmail || undefined,
        },
      });
    }

    // 2. Resolve every scanned IMEI against trusted inventory rows (server-side truth)
    const inventoryRows = await tx.inventory.findMany({
      where: { storeId: user.storeId, imei: { in: data.imeis } },
      include: { product: true },
    });

    if (inventoryRows.length !== data.imeis.length) {
      throw new Error("One or more IMEIs could not be found in inventory.");
    }

    const alreadySold = inventoryRows.filter((r) => r.status !== InventoryStatus.AVAILABLE);
    if (alreadySold.length > 0) {
      throw new Error(`IMEI ${alreadySold[0]!.imei} is not available (${alreadySold[0]!.status}).`);
    }

    // 3. Look up active promos per product
    const now = new Date();
    const promos = await tx.promotion.findMany({
      where: {
        storeId: user.storeId,
        productId: { in: inventoryRows.map((r) => r.productId) },
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    const promoByProduct = new Map(promos.map((p) => [p.productId, p]));

    // 4. Compute totals.
    //
    // PRICING RULE:
    //   grossSellingPrice   = the catalog/list price captured on this unit's
    //                         inventory row at receive time
    //   promotionalDiscount = the Samsung promotion active for this product on
    //                         the sale date — a REAL price reduction passed on
    //                         to the customer, not merely an internal rebate
    //   manualDiscount      = the additional discount applied on top,
    //                         absorbed entirely by the shop
    //   finalSellingPrice   = grossSellingPrice - promotionalDiscount - manualDiscount
    //   this is what the customer actually pays, and what `total`/invoice/
    //   payments must equal — promotion must NEVER increase what's charged.
    //
    // PROFIT RULE — still keyed off the catalog price so it does not
    // double-count the promo reduction already applied to `total`:
    //   profit = grossSellingPrice - buyingPrice + promotionalDiscount - manualDiscount
    // (the promo line adds back into profit because a Samsung dealer
    // promotion/cashback is a benefit *to the shop*, not a cost to it — the
    // shop is compensated for the price cut it passed on to the customer.)
    //
    // Discount is split evenly across items for simplicity; for a per-item
    // discount UI, pass discounts keyed by IMEI instead.
    const perItemDiscount = data.discount / inventoryRows.length;

    let subtotal = 0; // sum of gross/catalog prices, BEFORE promo or discount
    let totalPromo = 0;
    let totalProfit = 0;

    const itemsData = inventoryRows.map((inv) => {
      const promo = promoByProduct.get(inv.productId);
      const promoAmount = promo ? Number(promo.promoAmount) : 0;
      const grossSellingPrice = Number(inv.sellingPrice);
      const buyingPrice = Number(inv.buyingPrice);
      const profit = grossSellingPrice - buyingPrice + promoAmount - perItemDiscount;

      subtotal += grossSellingPrice;
      totalPromo += promoAmount;
      totalProfit += profit;

      return {
        inventoryId: inv.id,
        productId: inv.productId,
        buyingPrice: inv.buyingPrice,
        sellingPrice: inv.sellingPrice, // gross/catalog price — kept as-is for historical reporting
        discount: perItemDiscount,
        promoAmount,
        profit,
        promotionId: promo?.id,
        // finalSellingPrice is derivable (sellingPrice - promoAmount - discount)
        // and intentionally not persisted as its own column — every reader
        // (invoice, reports, dashboard) computes it the same way from these
        // three stored fields, avoiding a second source of truth.
      };
    });

    // total = what the customer actually pays. Promotion reduces this exactly
    // like discount does — this was the root-cause bug: promo was previously
    // only reflected in profit and never subtracted from the invoiced total.
    const total = Math.max(subtotal - totalPromo - data.discount, 0);

    const invoiceNumberResult = await tx.$queryRaw<{ next_invoice_number: string }[]>`
      select next_invoice_number('INV') as next_invoice_number
    `;
    const invoiceNumber = invoiceNumberResult[0]!.next_invoice_number;

    const sale = await tx.sale.create({
      data: {
        storeId: user.storeId,
        invoiceNumber,
        customerId: customer.id,
        soldById: user.id,
        subtotal,
        discount: data.discount,
        promoAmount: totalPromo,
        total,
        totalProfit,
        note: data.note,
        items: { create: itemsData },
        payments: {
          create:
            data.paymentMethod === "SPLIT" && data.splitPayments
              ? data.splitPayments.map((p) => ({ method: p.method, amount: p.amount }))
              : [{ method: data.paymentMethod, amount: total }],
        },
      },
      include: { items: true, payments: true, customer: true },
    });

    // 5. Flip inventory status (also enforced by DB trigger as a safety net)
    await tx.inventory.updateMany({
      where: { id: { in: inventoryRows.map((r) => r.id) } },
      data: { status: InventoryStatus.SOLD },
    });

    // 6. Audit log
    await tx.auditLog.create({
      data: {
        storeId: user.storeId,
        userId: user.id,
        action: "sale.create",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { invoiceNumber: sale.invoiceNumber, total, imeis: data.imeis },
      },
    });

    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath("/inventory");

    return { ok: true as const, data: { saleId: sale.id, invoiceNumber: sale.invoiceNumber, total } };
  });
}

// ============================================================================
// DELETE / VOID SALE — Owner only. Managers cannot delete sales (per spec).
// Implemented as a soft delete + inventory rollback to AVAILABLE.
// ============================================================================
export async function voidSale(saleId: string) {
  const user = await getCurrentUser();
  if (user.role !== "OWNER") {
    return { ok: false as const, error: "Only the Owner can void a sale." };
  }

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirstOrThrow({ where: { id: saleId, storeId: user.storeId }, include: { items: true } });

    await tx.sale.update({ where: { id: sale.id }, data: { deletedAt: new Date(), status: "CANCELLED" } });
    await tx.inventory.updateMany({
      where: { id: { in: sale.items.map((i) => i.inventoryId) } },
      data: { status: InventoryStatus.AVAILABLE },
    });
    await tx.auditLog.create({
      data: { storeId: user.storeId, userId: user.id, action: "sale.void", entityType: "Sale", entityId: sale.id },
    });
  });

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function getMySales(take = 50) {
  const user = await getCurrentUser();
  return prisma.sale.findMany({
    where: { storeId: user.storeId, soldById: user.id, deletedAt: null },
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getAllSales(take = 100) {
  const user = await getCurrentUser();
  if (user.role !== "OWNER") return { ok: false as const, error: "Forbidden" };
  const sales = await prisma.sale.findMany({
    where: { storeId: user.storeId, deletedAt: null },
    include: { customer: true, soldBy: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return { ok: true as const, data: sales };
}

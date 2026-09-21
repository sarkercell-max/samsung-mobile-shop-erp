/**
 * Seed script — creates a demo store, an Owner + Manager user, a handful of
 * Samsung products, purchase batches, and IMEI-level inventory so the app
 * is usable immediately after deploy.
 *
 * Run with: npx tsx scripts/seed.ts
 *
 * NOTE: this script creates the Supabase Auth users via the Admin API
 * (service role key required) AND the matching Prisma `User` rows.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("Seeding Samsung Mobile Shop ERP demo data...");

  const store = await prisma.store.create({
    data: {
      name: "Samsung Smart Cafe - Saidpur",
      address: "Station Road, Saidpur, Rangpur",
      phone: "01700000000",
    },
  });

  await prisma.settings.create({
    data: { storeId: store.id },
  });

  // --- Demo auth users -------------------------------------------------
  const demoUsers = [
    { email: "owner@demo.samsungerp.com", password: "Owner@12345", name: "Rafiq Islam", role: "OWNER" as const },
    { email: "manager@demo.samsungerp.com", password: "Manager@12345", name: "Nasrin Akter", role: "MANAGER" as const },
  ];

  for (const u of demoUsers) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw error;

    await prisma.user.create({
      data: {
        authId: data.user!.id,
        storeId: store.id,
        name: u.name,
        email: u.email,
        role: u.role,
      },
    });
    console.log(`Created ${u.role} -> ${u.email} / ${u.password}`);
  }

  const owner = await prisma.user.findFirstOrThrow({ where: { storeId: store.id, role: "OWNER" } });

  // --- Products ----------------------------------------------------------
  const productDefs = [
    { model: "Galaxy S24 Ultra", ram: "12GB", storageCapacity: "256GB", color: "Titanium Black", price: 169999 },
    { model: "Galaxy S24 Ultra", ram: "12GB", storageCapacity: "512GB", color: "Titanium Gray", price: 189999 },
    { model: "Galaxy Z Flip6", ram: "12GB", storageCapacity: "256GB", color: "Mint", price: 139999 },
    { model: "Galaxy A55", ram: "8GB", storageCapacity: "128GB", color: "Awesome Navy", price: 44999 },
    { model: "Galaxy A15", ram: "4GB", storageCapacity: "128GB", color: "Blue Black", price: 18999 },
  ];

  const products = [];
  for (const p of productDefs) {
    const sku = `SAM-${p.model.replace(/\s+/g, "").toUpperCase()}-${p.storageCapacity}-${p.color.replace(/\s+/g, "").toUpperCase()}`;
    const buyingPrice = Math.round(p.price * 0.88);
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        model: p.model,
        ram: p.ram,
        storageCapacity: p.storageCapacity,
        color: p.color,
        sku,
        barcode: sku,
        defaultSellingPrice: p.price,
        defaultBuyingPrice: buyingPrice,
      },
    });
    // Open the first price period for this product so the pricing UI has
    // data immediately and new purchases can prefill a buying price.
    await prisma.productPriceHistory.create({
      data: {
        storeId: store.id,
        productId: product.id,
        purchasePrice: buyingPrice,
        salePrice: p.price,
        effectiveFrom: new Date(),
        effectiveTo: null,
        createdById: owner.id,
      },
    });
    products.push({ product, buyingPrice });
  }

  // --- Purchase batch + IMEI-level inventory -----------------------------
  const batch = await prisma.purchaseBatch.create({
    data: {
      storeId: store.id,
      purchaseNumber: "PB-2026-0001",
      supplierName: "Samsung Bangladesh Distribution Ltd.",
      batchNumber: "BATCH-AUG-2026",
      purchaseDate: new Date(),
      createdById: owner.id,
      remarks: "Initial demo stock",
    },
  });

  let imeiCounter = 350123456789000;
  for (const { product, buyingPrice } of products) {
    for (let i = 0; i < 4; i++) {
      const imei = String(imeiCounter++);
      const item = await prisma.purchaseItem.create({
        data: {
          purchaseBatchId: batch.id,
          productId: product.id,
          imei,
          buyingPrice,
        },
      });
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          productId: product.id,
          purchaseItemId: item.id,
          imei,
          buyingPrice,
          sellingPrice: product.defaultSellingPrice,
          status: "AVAILABLE",
        },
      });
    }
  }

  // --- A sample promotion --------------------------------------------------
  const s24 = products[0]!.product;
  await prisma.promotion.create({
    data: {
      storeId: store.id,
      month: "2026-08",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-31"),
      productId: s24.id,
      promoAmount: 3000,
      promoType: "CASHBACK",
    },
  });

  console.log("Seed complete.");
  console.log("Login: owner@demo.samsungerp.com / Owner@12345");
  console.log("Login: manager@demo.samsungerp.com / Manager@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

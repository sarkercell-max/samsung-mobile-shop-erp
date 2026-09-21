"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const settingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(10),
  purchasePrefix: z.string().min(1).max(10),
  lowStockThreshold: z.coerce.number().int().min(0),
  thermalWidth: z.enum(["58mm", "80mm", "A4"]),
});

export async function getSettings() {
  const user = await requireOwner();
  return prisma.settings.findUniqueOrThrow({ where: { storeId: user.storeId } });
}

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const user = await requireOwner();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.settings.update({ where: { storeId: user.storeId }, data: parsed.data });
  revalidatePath("/settings");
  return { ok: true as const };
}

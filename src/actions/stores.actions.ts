"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { z } from "zod";

export async function switchActiveStore(storeId: string) {
  const user = await getCurrentUser();
  const allowed = user.accessibleStores.some((store) => store.id === storeId);
  if (!allowed) return { ok: false as const, error: "You are not authorized to access that shop." };
  const cookieStore = await cookies();
  cookieStore.set("active_store_id", storeId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const createStoreSchema = z.object({ name: z.string().trim().min(2).max(120), address: z.string().trim().max(250).optional(), phone: z.string().trim().max(30).optional() });
export async function createStore(input: z.infer<typeof createStoreSchema>) {
  const user = await requireOwner();
  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid shop details." };
  const store = await prisma.$transaction(async (tx) => {
    const created = await tx.store.create({ data: parsed.data });
    await tx.settings.create({ data: { storeId: created.id } });
    await tx.auditLog.create({ data: { storeId: created.id, userId: user.id, action: "store.create", entityType: "Store", entityId: created.id, metadata: { name: created.name } } });
    return created;
  });
  revalidatePath("/stores");
  return { ok: true as const, data: store };
}

export async function updateStoreDetails(storeId: string, input: z.infer<typeof createStoreSchema>) {
  const owner = await requireOwner();
  if (!owner.accessibleStores.some((store) => store.id === storeId)) return { ok: false as const, error: "Shop not found." };
  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid shop details." };
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.store.findUnique({ where: { id: storeId } });
    if (!before) throw new Error("Shop not found.");
    const store = await tx.store.update({ where: { id: storeId }, data: parsed.data });
    await tx.auditLog.create({ data: { storeId, userId: owner.id, action: "store.update", entityType: "Store", entityId: storeId, metadata: { old: { name: before.name, address: before.address, phone: before.phone }, new: parsed.data } } });
    return store;
  });
  revalidatePath("/stores"); revalidatePath("/", "layout");
  return { ok: true as const, data: updated };
}

export async function listStores() {
  const user = await requireOwner();
  return prisma.store.findMany({ include: { memberships: { include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } } }, _count: { select: { inventory: true } } }, orderBy: { createdAt: "asc" } });
}

export async function listAssignableUsers() {
  await requireOwner();
  return prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: { name: "asc" } });
}

export async function assignUserToStore(userId: string, storeId: string) {
  const owner = await requireOwner();
  const [user, store] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.store.findUnique({ where: { id: storeId }, select: { id: true } }),
  ]);
  if (!user || !store) return { ok: false as const, error: "User or shop not found." };
  await prisma.$transaction(async (tx) => {
    const membership = await tx.storeMembership.upsert({ where: { userId_storeId: { userId, storeId } }, create: { userId, storeId }, update: {} });
    await tx.auditLog.create({ data: { storeId, userId: owner.id, action: "store.member_assign", entityType: "User", entityId: userId, metadata: { userId, storeId, membershipId: membership.id } } });
  });
  revalidatePath("/stores"); revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeUserFromStore(userId: string, storeId: string) {
  const owner = await requireOwner();
  const member = await prisma.storeMembership.findUnique({ where: { userId_storeId: { userId, storeId } }, include: { user: { select: { role: true, storeId: true } } } });
  if (!member) return { ok: false as const, error: "Shop assignment not found." };
  if (member.user.role === "OWNER") return { ok: false as const, error: "Owner access is global and cannot be removed here." };
  await prisma.storeMembership.delete({ where: { id: member.id } });
  await prisma.auditLog.create({ data: { storeId, userId: owner.id, action: "store.member_remove", entityType: "User", entityId: userId, metadata: { userId, storeId } } });
  revalidatePath("/stores"); revalidatePath("/", "layout");
  return { ok: true as const };
}

"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["OWNER", "MANAGER"]),
  phone: z.string().optional(),
});

/** Owner-only: provisions a new Manager (or co-Owner) account — creates the
 *  Supabase Auth user via the Admin API and the linked business User row. */
export async function createStaffUser(input: z.infer<typeof createUserSchema>) {
  const owner = await requireOwner();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: authUser, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });
  if (error) return { ok: false as const, error: error.message };

  const user = await prisma.user.create({
    data: {
      authId: authUser.user.id,
      storeId: owner.storeId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
    },
  });

  revalidatePath("/users");
  return { ok: true as const, data: user };
}

export async function listStaff() {
  const owner = await requireOwner();
  return prisma.user.findMany({ where: { storeId: owner.storeId, deletedAt: null }, orderBy: { createdAt: "asc" } });
}

export async function deactivateStaff(userId: string) {
  const owner = await requireOwner();
  await prisma.user.update({ where: { id: userId, storeId: owner.storeId }, data: { isActive: false } });
  revalidatePath("/users");
  return { ok: true as const };
}

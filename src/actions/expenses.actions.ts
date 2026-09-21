"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createExpenseSchema, type CreateExpenseInput } from "@/lib/validations/expense";
import { revalidatePath } from "next/cache";

export async function createExpense(input: CreateExpenseInput) {
  const user = await requireOwner();
  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const expense = await prisma.expense.create({
    data: { ...parsed.data, storeId: user.storeId, recordedById: user.id },
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true as const, data: expense };
}

export async function listExpenses(month?: string) {
  const user = await requireOwner();
  const where: Record<string, unknown> = { storeId: user.storeId };
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.expenseDate = { gte: new Date(y!, m! - 1, 1), lt: new Date(y!, m!, 1) };
  }
  return prisma.expense.findMany({ where, orderBy: { expenseDate: "desc" } });
}

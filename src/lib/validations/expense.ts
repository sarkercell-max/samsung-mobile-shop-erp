import { z } from "zod";

export const createExpenseSchema = z.object({
  category: z.enum(["RENT", "SALARY", "ELECTRICITY", "INTERNET", "MARKETING", "TRANSPORT", "MISCELLANEOUS"]),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  expenseDate: z.coerce.date(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

import { z } from "zod";

export const createCustomerSchema = z.object({
  phone: z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

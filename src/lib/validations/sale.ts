import { z } from "zod";

export const createSaleSchema = z.object({
  // The ONLY two fields the manager must fill in by hand.
  customerPhone: z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
  imeis: z.array(z.string().regex(/^\d{14,17}$/, "Invalid IMEI")).min(1, "Scan at least one IMEI"),

  // Auto-filled but editable within limits (never buying price):
  customerName: z.string().min(1).optional(), // required only if new customer
  customerAddress: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),

  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK", "SPLIT"]),
  splitPayments: z
    .array(z.object({ method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK"]), amount: z.coerce.number().positive() }))
    .optional(),
  note: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const imeiLookupSchema = z.object({
  imei: z.string().regex(/^\d{14,17}$/, "Invalid IMEI"),
});

export const customerLookupSchema = z.object({
  phone: z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
});

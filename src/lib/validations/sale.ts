import { z } from "zod";

function hasValidImeiCheckDigit(value: string) {
  if (value.length !== 15) return true; // 14 digit IMEISV and legacy 16/17 digit inventory codes are matched exactly.
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 14).reduce((total, digit, index) => {
    if (index % 2 === 1) {
      const doubled = digit * 2;
      return total + Math.floor(doubled / 10) + (doubled % 10);
    }
    return total + digit;
  }, 0);
  return (10 - (sum % 10)) % 10 === digits[14];
}

const imeiSchema = z.string().regex(/^\d{14,17}$/, "Enter a 14–17 digit IMEI").refine(hasValidImeiCheckDigit, "IMEI check digit is invalid");

export const createSaleSchema = z.object({
  // The ONLY two fields the manager must fill in by hand.
  customerPhone: z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
  imeis: z.array(imeiSchema).min(1, "Scan at least one IMEI").refine((values) => new Set(values).size === values.length, "The same IMEI cannot be added twice."),

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
  imei: imeiSchema,
});

export const customerLookupSchema = z.object({
  phone: z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
});

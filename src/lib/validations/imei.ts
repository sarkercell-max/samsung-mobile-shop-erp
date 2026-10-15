import { z } from "zod";

export const IMEI_VALIDATION_MESSAGE = "IMEI must be exactly 15 digits.";
export const imeiSchema = z.string().regex(/^[0-9]{15}$/, IMEI_VALIDATION_MESSAGE);

export function isValidImei(imei: unknown): imei is string {
  return typeof imei === "string" && /^[0-9]{15}$/.test(imei);
}

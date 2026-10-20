import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export const customerContactSchema = z
  .object({
    full_name: z.string().trim().min(1).max(200),
    email: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.string().email().max(254)])),
    phone: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^\+?[\d\s().-]{7,30}$/)
        .refine(
          (value) => value.replace(/\D/g, "").length >= 7,
          "Enter at least seven phone digits.",
        ),
    ]),
    company_name: z.string().trim().max(200),
    notes: z.string().trim().max(4000),
  })
  .strict();
export const configurationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000),
    is_active: z.boolean(),
  })
  .strict();

// Suggestions only: never merge customers or match across business units.
export function possibleDuplicates(customer: Customer, rows: Customer[]) {
  const name = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const phone = (value: string | null) => (value ?? "").replace(/\D/g, "");
  const email = (value: string | null) => (value ?? "").trim().toLowerCase();
  return rows.filter(
    (other) =>
      other.id !== customer.id &&
      other.business_unit_id === customer.business_unit_id &&
      ((!!name(customer.full_name) && name(customer.full_name) === name(other.full_name)) ||
        (!!email(customer.email) && email(customer.email) === email(other.email)) ||
        (!!phone(customer.phone) && phone(customer.phone) === phone(other.phone))),
  );
}

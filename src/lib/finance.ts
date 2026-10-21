import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
export type DocumentProfile = Database["public"]["Tables"]["document_profiles"]["Row"];
export type InvoiceDraft = Database["public"]["Tables"]["invoice_drafts"]["Row"];
export const PROFILE_LABELS = {
  legal_name: "Business legal name",
  address: "Business address",
  phone: "Business phone",
  email: "Business email",
  website: "Business website",
  footer: "Document footer",
  payment_terms: "Approved payment terms",
} as const;
export const blankProfile = {
  legal_name: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  footer: "",
  payment_terms: "",
};
export const profileSchema = z
  .object({
    legal_name: z.string().trim().max(200),
    address: z.string().trim().max(1000),
    phone: z.string().trim().max(40),
    email: z.union([z.literal(""), z.string().email().max(200)]),
    website: z.union([
      z.literal(""),
      z
        .string()
        .url()
        .max(300)
        .refine((v) => v.startsWith("https://"), "Use HTTPS"),
    ]),
    footer: z.string().trim().max(2000),
    payment_terms: z.string().trim().max(1000),
  })
  .strict();
export const draftDescription = z.string().trim().min(1).max(2000);
export async function saveFinance(
  kind: "profile" | "draft",
  id: string,
  payload: Json,
  version: string | null,
  operation: string,
) {
  const result = await supabase.rpc("phase7_save", {
    _kind: kind,
    _entity_id: id,
    _payload: payload,
    _expected_updated_at: version,
    _operation_id: operation,
  });
  if (result.error || typeof result.data !== "string")
    throw new Error(
      "Could not save. Your entries are preserved. Check management permission and the Phase 7 migration, or refresh if another user edited this record.",
    );
  return result.data;
}
export function evidenceEligible(
  receipt: {
    verified_at: string | null;
    verified_by: string | null;
    currency: string;
    business_unit_id: string;
    booking_id: string;
  },
  booking: { id: string; currency: string; business_unit_id: string },
  reversed: boolean,
) {
  return Boolean(
    receipt.verified_at &&
    receipt.verified_by &&
    !reversed &&
    receipt.currency === booking.currency &&
    receipt.business_unit_id === booking.business_unit_id &&
    receipt.booking_id === booking.id,
  );
}
export function snapshotText(value: Json, key: string) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value[key] === "string"
    ? (value[key] as string)
    : "";
}

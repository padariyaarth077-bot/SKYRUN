import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
export type Receipt = Database["public"]["Tables"]["booking_deposit_receipts"]["Row"];
export type Reversal = Database["public"]["Tables"]["booking_deposit_reversals"]["Row"];
export const depositAmount = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an exact amount with at most two decimals.");
export function depositTotals(
  requirement: number | null,
  currency: string,
  receipts: Receipt[],
  reversals: Reversal[],
) {
  const reversed = new Set(reversals.map((r) => r.receipt_id));
  const cents = receipts
    .filter((r) => r.verified_at && r.currency === currency && !reversed.has(r.id))
    .reduce((sum, r) => sum + Math.round(r.amount * 100), 0);
  return {
    eligible: cents / 100,
    shortfall:
      requirement === null ? null : Math.max(0, Math.round(requirement * 100) - cents) / 100,
  };
}

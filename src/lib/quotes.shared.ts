import { z } from "zod";

// numeric(10,2): validate decimal text before any number conversion or rounding.
export const quoteDraftSchema = z.object({
  quoteId: z.string().uuid(),
  rideRequestId: z.string().uuid(),
  amount: z
    .string()
    .regex(
      /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,
      "Enter a nonnegative amount with at most two decimal places.",
    ),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Enter a three-letter uppercase currency code."),
  validUntil: z
    .string()
    .datetime({ offset: true })
    .refine((value) => Date.parse(value) > Date.now(), "Expiry must be in the future."),
  notes: z.string().trim().max(4000),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
});
export type QuoteDraftInput = z.infer<typeof quoteDraftSchema>;
export const quoteIsEditable = (quote: { status: string; valid_until: string }) =>
  quote.status === "DRAFT" &&
  Number.isFinite(Date.parse(quote.valid_until)) &&
  Date.parse(quote.valid_until) > Date.now();

import { z } from "zod";
export const deliveryStatusSchema = z.object({
  deliveryId: z.string().uuid().nullable(),
  state: z.enum([
    "NOT_PREPARED",
    "PREPARED",
    "IN_FLIGHT",
    "UNCERTAIN",
    "PROVIDER_ACCEPTED",
    "DELIVERED",
    "FAILED",
    "REVOKED",
  ]),
  frozen: z.boolean(),
  recipient: z.string().nullable(),
  retryAllowed: z.boolean().default(true),
});
export const sendQuoteSchema = z.object({
  quoteId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
  deliveryId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  expectedRideUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  reviewedRecipient: z.string().email().max(254),
});
export const deliveryFailure =
  "Could not confirm quote delivery. Refresh its saved delivery status before retrying.";

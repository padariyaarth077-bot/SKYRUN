import { z } from "zod";

export const acceptanceTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const customerQuoteSchema = z
  .object({
    quoteId: z.string().uuid(),
    amount: z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    pickup: z.string(),
    dropoff: z.string(),
    travelDate: z.string(),
    pickupTime: z.string().nullable(),
    passengers: z.number().int().positive(),
    tripType: z.string(),
    returnDate: z.string().nullable(),
    returnTime: z.string().nullable(),
    hourlyDuration: z.number().int().nullable(),
    flightNumber: z.string().nullable(),
    expiresAt: z.string().datetime({ offset: true }),
    accepted: z.boolean(),
    bookingReference: z.string().nullable(),
    bookingStatus: z
      .enum([
        "PENDING",
        "CONFIRMED",
        "ASSIGNED",
        "DRIVER_ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
      ])
      .nullable(),
  })
  .refine((value) => !value.accepted || Boolean(value.bookingReference && value.bookingStatus));
export type CustomerQuote = z.infer<typeof customerQuoteSchema>;
export const acceptanceFailure =
  "This quote link is unavailable or expired. Contact support@skyrunlimo.com for help.";

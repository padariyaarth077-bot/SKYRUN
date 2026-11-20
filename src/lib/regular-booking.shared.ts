import { z } from "zod";
import { rideEnquirySchema } from "@/lib/ride-enquiry.shared";

export const regularCategoryCodes = {
  "Regular Sedan": "regular-sedan",
  "Luxury Sedan": "luxury-sedan",
  "Regular SUV": "regular-suv",
  "Luxury SUV": "luxury-suv",
} as const;
export function regularCode(name: string) {
  return Object.hasOwn(regularCategoryCodes, name)
    ? regularCategoryCodes[name as keyof typeof regularCategoryCodes]
    : undefined;
}
export const regularRideSchema = rideEnquirySchema
  .omit({ vehiclePreference: true })
  .extend({
    categoryCode: z.enum(["regular-sedan", "luxury-sedan", "regular-suv", "luxury-suv"]),
    luggageDetails: z.string().trim().min(1).max(500),
  })
  .strict();

export const regularReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5).max(1000) }).strict(),
  z
    .object({
      action: z.literal("price"),
      amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
      basis: z.string().trim().min(10).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
      basis: z.string().trim().min(10).max(1000),
      availability: z.string().trim().min(10).max(1000),
      attested: z.literal(true),
    })
    .strict(),
]);

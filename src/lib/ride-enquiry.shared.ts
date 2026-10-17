import { z } from "zod";

const service = z.enum([
  "Airport transfer",
  "Corporate transportation",
  "Hourly chauffeur",
  "Point-to-point",
  "Special occasion",
  "Event transportation",
  "Other",
]);

export const rideEnquirySchema = z.object({
  submissionKey: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(40),
  service,
  pickupLocation: z.string().trim().min(1).max(300),
  dropoffLocation: z.string().trim().min(1).max(300),
  travelDate: z.string().date(),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passengerCount: z.union([z.string(), z.number()]).pipe(z.coerce.number().int().min(1).max(99)),
  vehiclePreference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  website: z.string().max(0).optional(),
});

export type RideEnquiry = z.infer<typeof rideEnquirySchema>;

export function rideEnquirySubject(enquiry: RideEnquiry) {
  return `Ride request — ${enquiry.name}`;
}

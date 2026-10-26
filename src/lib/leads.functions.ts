import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rideEnquirySchema, rideEnquirySubject } from "@/lib/ride-enquiry.shared";

const schema = z.object({
  source: z.enum(["CONTACT_FORM", "CHATBOT"]),
  submissionKey: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(40),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(4000).optional(),
  website: z.string().max(0).optional(), // honeypot
});

const SKYRUN_LIMO_BUSINESS_UNIT_ID = "00000000-0000-0000-0000-000000000002";

export const submitLead = createServerFn({ method: "POST" })
  .validator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { enforcePublicBudget } = await import("@/lib/public-budget.server");
    await enforcePublicBudget("lead");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("phase9_contact", {
      _key: data.submissionKey ?? crypto.randomUUID(),
      _source: data.source,
      _name: data.name,
      _email: data.email.toLowerCase(),
      _phone: data.phone,
      _subject:
        data.subject || (data.source === "CHATBOT" ? "Chatbot enquiry" : "Contact form request"),
      _message: data.message || data.subject || data.name,
    });
    const response = z.object({ reference: z.string().min(1) }).safeParse(result.data);
    if (result.error || !response.success) throw new Error("Could not save your request");
    return { ok: true, reference: response.data.reference };
  });

export const submitRideEnquiry = createServerFn({ method: "POST" })
  .validator((d: unknown) => rideEnquirySchema.parse(d))
  .handler(async ({ data }) => {
    // Honeypot submissions receive a neutral response without touching the database.
    if (data.website) return { ok: true, reference: "" };
    const { enforcePublicBudget } = await import("@/lib/public-budget.server");
    await enforcePublicBudget("ride");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("create_ride_enquiry", {
      _business_unit_id: SKYRUN_LIMO_BUSINESS_UNIT_ID,
      _submission_key: data.submissionKey,
      _name: data.name,
      _email: data.email.toLowerCase(),
      _phone: data.phone,
      _subject: rideEnquirySubject(data),
      _service: data.service,
      _pickup_location: data.pickupLocation,
      _dropoff_location: data.dropoffLocation,
      _travel_date: data.travelDate,
      _pickup_time: data.pickupTime,
      _passenger_count: data.passengerCount,
      _vehicle_preference: data.vehiclePreference ?? "",
      _notes: data.notes ?? "",
    });
    const response = z.object({ reference: z.string().min(1) }).safeParse(result);
    if (error || !response.success) throw new Error("Could not save your ride request");
    return { ok: true, reference: response.data.reference };
  });

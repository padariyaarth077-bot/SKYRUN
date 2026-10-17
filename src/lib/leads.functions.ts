import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rideEnquirySchema, rideEnquirySubject } from "@/lib/ride-enquiry.shared";

const schema = z.object({
  source: z.enum(["CONTACT_FORM", "CHATBOT"]),
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    let { data: cust } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("business_unit_id", SKYRUN_LIMO_BUSINESS_UNIT_ID)
      .eq("email", email)
      .maybeSingle();
    if (!cust) {
      const ins = await supabaseAdmin
        .from("customers")
        .insert({
          business_unit_id: SKYRUN_LIMO_BUSINESS_UNIT_ID,
          full_name: data.name,
          email,
          phone: data.phone,
        })
        .select("id")
        .single();
      if (ins.error) throw new Error("Could not save your request");
      cust = ins.data;
    }
    const lead_number = `SR-${Date.now().toString(36).toUpperCase()}`;
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({
        business_unit_id: SKYRUN_LIMO_BUSINESS_UNIT_ID,
        lead_number,
        customer_id: cust.id,
        source: data.source,
        status: "NEW",
        priority: "NORMAL",
        subject:
          data.subject || (data.source === "CHATBOT" ? "Chatbot enquiry" : "Contact form request"),
        message: data.message || data.subject || data.name,
      })
      .select("id,business_unit_id")
      .single();
    if (error) throw new Error("Could not save your request");
    await supabaseAdmin.from("activities").insert({
      business_unit_id: lead.business_unit_id,
      entity_type: "lead",
      entity_id: lead.id,
      activity_type: "CREATED",
      description: `Lead created from ${data.source}`,
    });
    return { ok: true, reference: lead_number };
  });

export const submitRideEnquiry = createServerFn({ method: "POST" })
  .validator((d: unknown) => rideEnquirySchema.parse(d))
  .handler(async ({ data }) => {
    // Honeypot submissions receive a neutral response without touching the database.
    if (data.website) return { ok: true, reference: "" };
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

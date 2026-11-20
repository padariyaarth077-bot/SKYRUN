import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { regularRideSchema } from "@/lib/regular-booking.shared";

export const submitRegularRide = createServerFn({ method: "POST" })
  .validator((input: unknown) => regularRideSchema.parse(input))
  .handler(async ({ data }) => {
    const { enforcePublicBudget } = await import("@/lib/public-budget.server");
    await enforcePublicBudget("ride");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("submit_regular_ride", {
      _key: data.submissionKey,
      _category: data.categoryCode,
      _name: data.name,
      _email: data.email.toLowerCase(),
      _phone: data.phone,
      _service: data.service,
      _pickup: data.pickupLocation,
      _dropoff: data.dropoffLocation,
      _date: data.travelDate,
      _time: data.pickupTime,
      _passengers: data.passengerCount,
      _luggage: data.luggageDetails,
      _notes: data.notes ?? "",
    });
    const response = z.object({ reference: z.string().min(1) }).safeParse(result.data);
    if (result.error || !response.success)
      throw new Error("Regular request unavailable. Please check your details or contact Skyrun.");
    return { ok: true, reference: response.data.reference };
  });

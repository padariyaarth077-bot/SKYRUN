import { createServerFn } from "@tanstack/react-start";
import { quoteDraftSchema } from "@/lib/quotes.shared";

export const saveQuoteDraft = createServerFn({ method: "POST" })
  .validator((input: unknown) => quoteDraftSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const { createClient } = await import("@supabase/supabase-js");
      const authorization = getRequestHeader("authorization");
      if (!authorization?.startsWith("Bearer ")) throw new Error("Please sign in again.");
      const url = process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) throw new Error("Quote saving is unavailable.");
      const client = createClient(url, key, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: identity, error: authError } = await client.auth.getUser(
        authorization.slice(7),
      );
      if (authError || !identity.user) throw new Error("Please sign in again.");
      const { data: roles, error: roleError } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", identity.user.id)
        .in("role", ["SUPER_ADMIN", "ADMIN", "MANAGER", "DISPATCHER", "SUPPORT", "CONTENT_MANAGER"])
        .limit(1);
      if (roleError || !roles?.length) throw new Error("Staff access is required.");
      const { data: id, error } = await client.rpc("save_quote_draft", {
        _quote_id: data.quoteId,
        _ride_request_id: data.rideRequestId,
        _amount: data.amount,
        _currency: data.currency,
        _valid_until: data.validUntil,
        _notes: data.notes,
        _expected_updated_at: data.expectedUpdatedAt,
      });
      if (error?.code === "PGRST202")
        throw new Error("Draft saving requires the approved Phase 3 database update.");
      if (error || typeof id !== "string" || id !== data.quoteId)
        throw new Error(
          "Could not save the draft. Refresh and check eligibility, expiry and whether another staff member edited it.",
        );
      return { id };
    } catch (error) {
      const messages = [
        "Please sign in again.",
        "Staff access is required.",
        "Quote saving is unavailable.",
        "Draft saving requires the approved Phase 3 database update.",
        "Could not save the draft. Refresh and check eligibility, expiry and whether another staff member edited it.",
      ];
      if (error instanceof Error && messages.includes(error.message)) throw error;
      throw new Error("Quote saving is unavailable.");
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  acceptanceFailure,
  acceptanceTokenSchema,
  customerQuoteSchema,
} from "@/lib/quote-acceptance.shared";

const inputSchema = z.object({ token: acceptanceTokenSchema, accept: z.boolean() });
export const customerQuoteAcceptance = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const result = inputSchema.safeParse(input);
    if (!result.success) throw new Error(acceptanceFailure);
    return result.data;
  })
  .handler(async ({ data }) => {
    try {
      const { setResponseHeader } = await import("@tanstack/react-start/server");
      setResponseHeader("Cache-Control", "no-store, private");
      setResponseHeader("Referrer-Policy", "no-referrer");
      const { hashAcceptanceToken } = await import("@/lib/quote-acceptance.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: result, error } = await supabaseAdmin.rpc("customer_quote_acceptance", {
        _token_hash: await hashAcceptanceToken(data.token),
        _accept: data.accept,
      });
      if (error) return { ok: false as const, message: acceptanceFailure };
      const parsed = customerQuoteSchema.safeParse(result);
      if (!parsed.success || (data.accept && !parsed.data.accepted))
        return { ok: false as const, message: acceptanceFailure };
      return { ok: true as const, quote: parsed.data };
    } catch {
      // Never expose a DB/provider error or bearer link through the root error logger.
      return { ok: false as const, message: acceptanceFailure };
    }
  });

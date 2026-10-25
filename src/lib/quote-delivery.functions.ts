import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  deliveryFailure,
  deliveryStatusSchema,
  sendQuoteSchema,
} from "@/lib/quote-delivery.shared";
import type { Database } from "@/integrations/supabase/types";

const staffClient = createServerOnlyFn(async () => {
  const { getRequestHeader, setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "no-store, private");
  const { createClient } = await import("@supabase/supabase-js");
  const authorization = getRequestHeader("authorization");
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!authorization?.startsWith("Bearer ") || !url || !key)
    throw new Error("Staff access required");
  const client = createClient<Database>(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const identity = await client.auth.getUser(authorization.slice(7));
  if (identity.error || !identity.data.user) throw new Error("Staff access required");
  const roles = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", identity.data.user.id)
    .in("role", ["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPPORT", "DISPATCHER", "CONTENT_MANAGER"])
    .limit(1);
  if (roles.error || !roles.data?.length) throw new Error("Staff access required");
  return client;
});
const configuration = createServerOnlyFn(() => {
  const mode = process.env["QUOTE_EMAIL_MODE"],
    origin = process.env["QUOTE_PUBLIC_ORIGIN"];
  let validWebhookKey = false;
  try {
    validWebhookKey =
      Boolean(process.env["RESEND_WEBHOOK_SECRET"]?.startsWith("whsec_")) &&
      atob(process.env["RESEND_WEBHOOK_SECRET"]!.slice(6)).length >= 16;
  } catch {
    /* invalid provider signing secret */
  }
  const enabled =
    (mode === "test" || mode === "live") &&
    Boolean(process.env["RESEND_API_KEY"]) &&
    validWebhookKey &&
    /^[a-f0-9]{64}$/i.test(process.env["QUOTE_LINK_SECRET"] ?? "") &&
    [
      "https://skyrun.padariyaarth077.workers.dev",
      "https://skyrunlimo.com",
      "https://www.skyrunlimo.com",
      "http://127.0.0.1:56500",
    ].includes(origin ?? "") &&
    (origin !== "http://127.0.0.1:56500" ||
      (mode === "test" && process.env["SUPABASE_URL"] === "http://127.0.0.1:56341"));
  return { enabled, origin: origin ?? "", isTest: mode === "test" };
});
export const getQuoteDeliveryStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ quoteId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    try {
      const client = await staffClient();
      const result = await client.rpc("quote_delivery_status", { _quote_id: data.quoteId });
      const parsed = deliveryStatusSchema.safeParse(result.data);
      if (result.error || !parsed.success)
        return {
          ok: false as const,
          message: "Quote delivery requires the approved database update or staff access.",
        };
      const config = configuration();
      return { ok: true as const, ...parsed.data, enabled: config.enabled, isTest: config.isTest };
    } catch {
      return { ok: false as const, message: "Could not load quote delivery. Sign in and retry." };
    }
  });

export const sendQuoteEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) => sendQuoteSchema.parse(input))
  .handler(async ({ data }) => {
    let stage = "staff_access";
    try {
      const client = await staffClient(),
        config = configuration();
      if (!config.enabled)
        return {
          ok: false as const,
          message: "Quote email sending is not enabled. No email was sent.",
        };
      if (config.isTest && data.reviewedRecipient.toLowerCase() !== "padariyaarth077@gmail.com")
        return {
          ok: false as const,
          message: "Test mode permits only the approved test recipient.",
        };
      stage = "capability";
      const { deriveDeliveryCapability } = await import("@/lib/quote-acceptance.server");
      const capability = await deriveDeliveryCapability(data.deliveryId),
        attemptId = crypto.randomUUID();
      stage = "begin_delivery";
      const begun = await client.rpc("begin_quote_delivery", {
        _quote_id: data.quoteId,
        _delivery_id: data.deliveryId,
        _token_hash: capability.tokenHash,
        _expected_updated_at: data.expectedUpdatedAt,
        _expected_ride_updated_at: data.expectedRideUpdatedAt,
        _reviewed_recipient: data.reviewedRecipient,
        _public_origin: config.origin,
        _is_test: config.isTest,
        _attempt_id: attemptId,
      });
      if (begun.error) {
        const messages: Record<string, string> = {
          "delivery reconciliation required":
            "This delivery is too old to retry safely. Check its existing Resend record before preparing a replacement quote.",
          "review recipient again":
            "The customer email changed. Refresh and review the recipient again.",
          "review trip again":
            "Trip details changed. Refresh and review the saved trip before sending.",
          "delivery configuration changed":
            "This delivery's configuration changed. Reconcile it before retrying.",
        };
        return { ok: false as const, message: messages[begun.error.message] ?? deliveryFailure };
      }
      const claim = z
        .object({ proceed: z.boolean(), state: deliveryStatusSchema.shape.state })
        .parse(begun.data);
      if (!claim.proceed) return { ok: true as const, state: claim.state };
      stage = "saved_snapshot";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [saved, link] = await Promise.all([
        supabaseAdmin.from("quote_deliveries").select("*").eq("id", data.deliveryId).single(),
        supabaseAdmin
          .from("quote_acceptance_links")
          .select("token_hash,recipient_email,quote_id")
          .eq("id", data.deliveryId)
          .single(),
      ]);
      if (
        saved.error ||
        link.error ||
        saved.data.public_origin !== config.origin ||
        saved.data.is_test !== config.isTest ||
        link.data.token_hash !== capability.tokenHash ||
        link.data.quote_id !== data.quoteId ||
        link.data.recipient_email.toLowerCase() !== data.reviewedRecipient.toLowerCase()
      ) {
        console.info('{"event":"quote_delivery_failure","stage":"saved_snapshot"}');
        return { ok: false as const, message: deliveryFailure };
      }
      let providerId: string;
      stage = "email_transport";
      try {
        const { submitQuoteEmail } = await import("@/lib/quote-email.server");
        const result = await submitQuoteEmail({
          deliveryId: data.deliveryId,
          quoteId: data.quoteId,
          to: link.data.recipient_email,
          isTest: saved.data.is_test,
          text: `${saved.data.message_text}\n\nReview and accept your quote:\n${saved.data.public_origin}/quote/accept#token=${capability.token}`,
        });
        providerId = result.providerEmailId;
      } catch {
        console.info('{"event":"quote_delivery_failure","stage":"email_transport"}');
        await supabaseAdmin.rpc("finish_quote_delivery", {
          _delivery_id: data.deliveryId,
          _attempt_id: attemptId,
          _provider_email_id: null,
        });
        return { ok: false as const, message: deliveryFailure };
      }
      stage = "finish_delivery";
      const finish = await supabaseAdmin.rpc("finish_quote_delivery", {
        _delivery_id: data.deliveryId,
        _attempt_id: attemptId,
        _provider_email_id: providerId,
      });
      if (finish.error) {
        console.info('{"event":"quote_delivery_failure","stage":"finish_delivery"}');
        return { ok: false as const, message: deliveryFailure };
      }
      stage = "delivery_events";
      const processed = await supabaseAdmin.rpc("process_quote_delivery_events", {
        _provider_email_id: providerId,
      });
      if (processed.error) {
        console.info('{"event":"quote_delivery_failure","stage":"delivery_events"}');
        return { ok: false as const, message: deliveryFailure };
      }
      stage = "delivery_status";
      const final = await client.rpc("quote_delivery_status", { _quote_id: data.quoteId });
      const persisted = deliveryStatusSchema.safeParse(final.data);
      if (final.error || !persisted.success) {
        console.info('{"event":"quote_delivery_failure","stage":"delivery_status"}');
        return { ok: false as const, message: deliveryFailure };
      }
      return { ok: true as const, state: persisted.data.state };
    } catch {
      console.info(JSON.stringify({ event: "quote_delivery_failure", stage }));
      return { ok: false as const, message: deliveryFailure };
    }
  });

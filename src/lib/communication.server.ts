import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
const payloadSchema = z.object({
  reference: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  travelDate: z.string().max(30).optional(),
  pickupTime: z.string().max(30).nullable().optional(),
  pickup: z.string().max(1000).optional(),
  dropoff: z.string().max(1000).optional(),
  title: z.string().max(160).optional(),
  eventKind: z.string().max(60).optional(),
});
const envelopeSchema = z.object({
  id: z.string().uuid(),
  recipient: z
    .string()
    .email()
    .max(254)
    .refine((v) => !/[\r\n]/.test(v)),
  kind: z.enum(["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "STAFF_URGENT"]),
  payload: payloadSchema,
});
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export function communicationTemplate(input: unknown) {
  const row = envelopeSchema.parse(input),
    p = row.payload;
  if (row.kind !== "STAFF_URGENT" && p.status !== row.kind.replace("BOOKING_", ""))
    throw Error("Ineligible booking event");
  const heading =
    row.kind === "STAFF_URGENT"
      ? (p.title ?? "Staff attention required")
      : `Booking ${p.status!.toLowerCase()}`;
  const lines =
    row.kind === "STAFF_URGENT"
      ? [
          heading,
          `Related record: ${p.reference}`,
          "Sign in to the Skyrun Operations Center to review.",
        ]
      : [
          `Hello ${p.name ?? ""},`,
          heading + ` — ${p.reference}`,
          `Trip date: ${p.travelDate ?? "Not provided"}`,
          `Pickup time: ${p.pickupTime ?? "Not provided"}`,
          `Pickup: ${p.pickup ?? "Not provided"}`,
          `Drop-off: ${p.dropoff ?? "Not provided"}`,
          "For assistance contact support@skyrunlimo.com.",
        ];
  return {
    id: row.id,
    to: row.recipient,
    subject: `Skyrun Limo — ${heading.replace(/[\r\n]/g, " ")}`,
    text: ["SKYRUN LIMO", ...lines].join("\n\n"),
    html: `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:Arial,sans-serif;color:#172033"><main style="max-width:600px;margin:24px auto;background:white;padding:28px;border-radius:12px"><h1 style="font-size:24px">SKYRUN LIMO</h1><h2 style="font-size:20px">${escape(heading)}</h2>${lines.map((line) => `<p style="line-height:1.6;overflow-wrap:anywhere">${escape(line)}</p>`).join("")}</main></body></html>`,
  };
}
export const processCommunication = createServerOnlyFn(async () => {
  let webhookConfigured = false;
  try {
    const secret = process.env["RESEND_WEBHOOK_SECRET"] ?? "";
    webhookConfigured = secret.startsWith("whsec_") && atob(secret.slice(6)).length >= 16;
  } catch {
    /* Invalid signing configuration keeps delivery disabled. */
  }
  // No provider call, claim or state change unless activation has been separately approved.
  if (
    process.env["COMMUNICATION_EMAIL_MODE"] !== "live" ||
    !process.env["RESEND_API_KEY"] ||
    !webhookConfigured
  )
    return { enabled: false, processed: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const attempt = crypto.randomUUID(),
    claim = await supabaseAdmin.rpc("phase8_claim", { _attempt: attempt });
  if (claim.error) throw Error("Communication queue unavailable");
  if (!claim.data) return { enabled: true, processed: false };
  const prepared = communicationTemplate(claim.data);
  const frozen = await supabaseAdmin.rpc("phase8_freeze", {
    _id: prepared.id,
    _attempt: attempt,
    _subject: prepared.subject,
    _text: prepared.text,
    _html: prepared.html,
  });
  if (frozen.error) throw Error("Communication snapshot unavailable");
  const message = z
    .object({
      id: z.string().uuid(),
      to: z.string().email(),
      subject: z.string(),
      text: z.string(),
      html: z.string(),
    })
    .parse(frozen.data);
  let provider: string | null = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `communication/${message.id}`,
      },
      body: JSON.stringify({
        from: "Skyrun Limo <support@skyrunlimo.com>",
        reply_to: "support@skyrunlimo.com",
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (response.ok) provider = z.object({ id: z.string().uuid() }).parse(await response.json()).id;
  } catch {
    /* Ambiguous provider result retains the same durable idempotency key/body. */
  }
  const finished = await supabaseAdmin.rpc("phase8_finish", {
    _id: message.id,
    _attempt: attempt,
    _provider: provider,
  });
  if (finished.error) throw Error("Communication result requires reconciliation");
  return { enabled: true, processed: true, providerAccepted: provider !== null };
});
export const handleCommunicationDispatch = createServerOnlyFn(async (request: Request) => {
  const secret = process.env["COMMUNICATION_DISPATCH_SECRET"],
    provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || secret.length < 32) return new Response(null, { status: 503 });
  if (!provided || provided.length > 512) return new Response(null, { status: 401 });
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(secret), digest(provided)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  if (diff) return new Response(null, { status: 401 });
  try {
    return Response.json(await processCommunication(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
});

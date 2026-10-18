import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

const bytes = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
export const verifyResendWebhook = createServerOnlyFn(
  async (payload: string, headers: Headers, secret: string, now = Date.now()) => {
    const id = headers.get("svix-id") ?? "",
      timestamp = headers.get("svix-timestamp") ?? "",
      signatures = headers.get("svix-signature") ?? "";
    if (
      !/^[\w-]{1,200}$/.test(id) ||
      !/^\d{10,12}$/.test(timestamp) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300 ||
      signatures.length > 4096 ||
      !secret.startsWith("whsec_")
    )
      throw new Error("Invalid webhook");
    const raw = bytes(secret.slice(6));
    if (raw.length < 16) throw new Error("Invalid webhook");
    const key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const content = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
    let valid = false;
    for (const signature of signatures.split(" ")) {
      if (!signature.startsWith("v1,")) continue;
      try {
        if (await crypto.subtle.verify("HMAC", key, bytes(signature.slice(3)), content))
          valid = true;
      } catch {
        /* malformed alternative signature */
      }
    }
    if (!valid) throw new Error("Invalid webhook");
    return { id, event: JSON.parse(payload) as unknown };
  },
);

const terminalTypes = [
  "email.delivered",
  "email.bounced",
  "email.failed",
  "email.complained",
  "email.suppressed",
];
const eventSchema = z.object({ type: z.string(), data: z.unknown() });
const emailSchema = z.object({
  email_id: z.string().uuid(),
  to: z.array(z.string().email()).length(1),
  from: z.string().max(254),
});
export const handleResendWebhook = createServerOnlyFn(async (request: Request) => {
  const reply = (status: number) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  const secret = process.env["RESEND_WEBHOOK_SECRET"];
  if (!secret) return reply(503);
  let payload = "";
  try {
    if (Number(request.headers.get("Content-Length") ?? 0) > 65536) return reply(413);
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    let size = 0;
    const decoder = new TextDecoder("utf-8", { fatal: true });
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return reply(413);
      }
      payload += decoder.decode(chunk.value, { stream: true });
    }
    payload += decoder.decode();
    const verified = await verifyResendWebhook(payload, request.headers, secret);
    const event = eventSchema.parse(verified.event);
    if (!terminalTypes.includes(event.type)) return reply(204);
    const email = emailSchema.parse(event.data);
    const sender = (email.from.match(/<([^<>]+)>$/)?.[1] ?? email.from).trim().toLowerCase();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const payloadHash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const stored = await supabaseAdmin.rpc("store_quote_delivery_event", {
        _event_id: verified.id,
        _provider_email_id: email.email_id,
        _event_type: event.type,
        _recipient: email.to[0]!,
        _sender: sender,
        _payload_hash: payloadHash,
      });
      if (stored.error) return reply(503);
      const processed = await supabaseAdmin.rpc("process_quote_delivery_events", {
        _provider_email_id: email.email_id,
      });
      return reply(processed.error ? 503 : 204);
    } catch {
      return reply(503);
    }
  } catch {
    return reply(400);
  }
});

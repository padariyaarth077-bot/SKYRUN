import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
import { verifyResendWebhook, handleResendWebhook } from "@/lib/resend-webhook.server";
const secret = "whsec_" + btoa("a".repeat(32)); // Synthetic fixture, never a configured provider secret.
const event = {
  type: "email.delivered",
  data: {
    email_id: "ee2471c9-44b0-4f38-9b58-0fd84686e867",
    to: ["padariyaarth077@gmail.com"],
    from: "Skyrun Limo <support@skyrunlimo.com>",
  },
};
async function signed(
  body = JSON.stringify(event),
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const id = "msg_testFixture",
    key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("a".repeat(32)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return {
    body,
    headers: new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": "v1," + btoa(String.fromCharCode(...new Uint8Array(signature))),
    }),
  };
}
const request = (s: { body: string; headers: Headers }) =>
  new Request("http://127.0.0.1/api/webhooks/resend", {
    method: "POST",
    body: s.body,
    headers: s.headers,
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubEnv("RESEND_WEBHOOK_SECRET", secret);
  rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("matches the published Svix manual-verification reference vector", async () => {
  // Public, non-production example from docs.svix.com/receiving/verifying-payloads/how-manual.
  const headers = new Headers({
    "svix-id": "msg_loFOjxBNrRLzqYUf",
    "svix-timestamp": "1731705121",
    "svix-signature": "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
  });
  const result = await verifyResendWebhook(
    '{"event_type":"ping","data":{"success":true}}',
    headers,
    "whsec_plJ3nmyCDGBKInavdOK15jsl",
    1731705121000,
  );
  expect(result.id).toBe("msg_loFOjxBNrRLzqYUf");
});
it("accepts a signed raw body and commits the inbox before processing, without exposing payloads", async () => {
  const result = await handleResendWebhook(request(await signed()));
  expect(result.status).toBe(204);
  expect(rpc).toHaveBeenNthCalledWith(
    1,
    "store_quote_delivery_event",
    expect.objectContaining({
      _event_id: "msg_testFixture",
      _provider_email_id: event.data.email_id,
      _recipient: "padariyaarth077@gmail.com",
      _sender: "support@skyrunlimo.com",
    }),
  );
  expect(rpc).toHaveBeenNthCalledWith(2, "process_quote_delivery_events", {
    _provider_email_id: event.data.email_id,
  });
  expect(await result.text()).toBe("");
});
it("tracks signed communication delivery only when the new email mode is enabled", async () => {
  vi.stubEnv("COMMUNICATION_EMAIL_MODE", "live");
  expect((await handleResendWebhook(request(await signed()))).status).toBe(204);
  expect(rpc).toHaveBeenNthCalledWith(
    3,
    "phase8_delivery_event",
    expect.objectContaining({
      _event: "msg_testFixture",
      _provider: event.data.email_id,
      _kind: "email.delivered",
      _sender: "support@skyrunlimo.com",
    }),
  );
});
it("asks the provider to retry when communication event persistence fails", async () => {
  vi.stubEnv("COMMUNICATION_EMAIL_MODE", "live");
  rpc.mockImplementation((name) =>
    Promise.resolve({
      data: null,
      error: name === "phase8_delivery_event" ? { message: "private" } : null,
    }),
  );
  const result = await handleResendWebhook(request(await signed()));
  expect(result.status).toBe(503);
  expect(await result.text()).toBe("");
});
it.each(["tampered body", "wrong signature", "expired timestamp", "future timestamp"])(
  "rejects %s before database access",
  async (kind) => {
    const s = await signed(
      JSON.stringify(event),
      String(
        Math.floor(Date.now() / 1000) +
          (kind === "expired timestamp" ? -301 : kind === "future timestamp" ? 301 : 0),
      ),
    );
    if (kind === "tampered body") s.body += " ";
    if (kind === "wrong signature") s.headers.set("svix-signature", "v1,AAAA");
    expect((await handleResendWebhook(request(s))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("supports signature rotation lists but never accepts unknown signature versions", async () => {
  const s = await signed();
  s.headers.set("svix-signature", `v2,AAAA v1,AAAA ${s.headers.get("svix-signature")}`);
  expect((await handleResendWebhook(request(s))).status).toBe(204);
});
it("does not treat email.sent/provider acceptance as verified delivery", async () => {
  expect(
    (
      await handleResendWebhook(
        request(await signed(JSON.stringify({ ...event, type: "email.sent" }))),
      )
    ).status,
  ).toBe(204);
  expect(rpc).not.toHaveBeenCalled();
});
it("fails closed without a signing secret", async () => {
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
  expect((await handleResendWebhook(request(await signed()))).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
});
it("requests provider retry if durable storage fails", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private" } });
  expect((await handleResendWebhook(request(await signed()))).status).toBe(503);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("bounds streamed request size even without Content-Length", async () => {
  expect(
    (
      await handleResendWebhook(
        new Request("http://127.0.0.1/api/webhooks/resend", {
          method: "POST",
          body: "x".repeat(65537),
        }),
      )
    ).status,
  ).toBe(413);
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects multi-recipient payloads rather than linking them to a quote", async () => {
  const body = JSON.stringify({
    ...event,
    data: { ...event.data, to: ["a@example.test", "b@example.test"] },
  });
  expect((await handleResendWebhook(request(await signed(body)))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

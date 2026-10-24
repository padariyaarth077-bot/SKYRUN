import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultPreferences,
  notificationRoute,
  preferencesSchema,
  retryEligible,
  shouldAlert,
  soundAllowed,
  type StaffNotification,
} from "@/lib/notifications";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
import {
  communicationTemplate,
  handleCommunicationDispatch,
  processCommunication,
} from "@/lib/communication.server";
const id = "11111111-1111-4111-8111-111111111111",
  unit = "22222222-2222-4222-8222-222222222222";
const n: StaffNotification = {
  id,
  seq: "1",
  business_unit_id: unit,
  kind: "CHAT_MESSAGE",
  severity: "NORMAL",
  title: "Message",
  entity_type: "conversation",
  entity_id: id,
  created_at: "2026-10-21T10:00:00Z",
  read_at: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("COMMUNICATION_EMAIL_MODE", "disabled");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("COMMUNICATION_DISPATCH_SECRET", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("validates preferences, refuses extra fields and unknown categories", () => {
  expect(preferencesSchema.parse(defaultPreferences)).toEqual(defaultPreferences);
  for (const value of [
    { ...defaultPreferences, volume: 1.1 },
    { ...defaultPreferences, categories: { LEAK: true } },
    { ...defaultPreferences, user_id: id },
  ])
    expect(preferencesSchema.safeParse(value).success).toBe(false);
});
it("suppresses exact active chats while preserving handoff and visual alerts when muted", () => {
  expect(shouldAlert(n, defaultPreferences, id)).toBe(false);
  expect(shouldAlert({ ...n, kind: "CHAT_HANDOFF" }, defaultPreferences, id)).toBe(true);
  expect(shouldAlert(n, { ...defaultPreferences, sound: false }, null)).toBe(true);
  expect(soundAllowed(n, { ...defaultPreferences, sound: false })).toBe(false);
  expect(soundAllowed({ ...n, severity: "URGENT" }, { ...defaultPreferences, urgent: false })).toBe(
    false,
  );
  expect(shouldAlert(n, { ...defaultPreferences, categories: { CHAT_MESSAGE: false } }, null)).toBe(
    false,
  );
});
it("creates only allowlisted record routes and rejects malformed IDs", () => {
  expect(notificationRoute(n)).toBe(`/admin/chat-conversations?conversation=${id}`);
  expect(notificationRoute({ ...n, entity_type: "booking" })).toBe(`/admin/booking/${id}`);
  expect(notificationRoute({ ...n, entity_id: "javascript:alert(1)" })).toBeNull();
});
it("only retries unconfirmed provider outcomes inside the bounded window", () => {
  const base = {
    state: "FAILED",
    attempts: 1,
    recipient: "test@example.test",
    provider_email_id: null,
    first_attempt_at: new Date().toISOString(),
  };
  expect(retryEligible(base)).toBe(true);
  expect(retryEligible({ ...base, attempts: 3 })).toBe(false);
  expect(retryEligible({ ...base, provider_email_id: id })).toBe(false);
  expect(retryEligible({ ...base, first_attempt_at: "2000-01-01T00:00:00Z" })).toBe(false);
});
const envelope = {
  id,
  kind: "BOOKING_CONFIRMED",
  recipient: "customer@example.test",
  payload: {
    reference: "BK-TEST",
    name: "<img src=x>",
    status: "CONFIRMED",
    travelDate: "2099-11-06",
    pickup: "A & B",
    dropoff: "C",
    internalSecret: "must-not-appear",
  },
};
it("templates escape HTML, preserve verified facts and omit internal and invented financial data", () => {
  const t = communicationTemplate(envelope);
  expect(t.html).toContain("&lt;img src=x&gt;");
  expect(t.html).toContain("A &amp; B");
  expect(t.text).toContain("2099-11-06");
  expect(t.text + t.html).not.toContain("must-not-appear");
  expect(t.text + t.html).not.toMatch(/invoice|receipt|chauffeur|tax|paid/i);
  expect(() =>
    communicationTemplate({ ...envelope, payload: { ...envelope.payload, status: "CANCELLED" } }),
  ).toThrow();
  expect(() => communicationTemplate({ ...envelope, recipient: "invalid" })).toThrow();
});
it("disabled delivery never claims work or calls a provider", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await processCommunication()).toEqual({ enabled: false, processed: false });
  expect(rpc).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("internal processor rejects missing and incorrect authorization without accessing the queue", async () => {
  expect(
    (await handleCommunicationDispatch(new Request("https://local.test", { method: "POST" })))
      .status,
  ).toBe(503);
  vi.stubEnv("COMMUNICATION_DISPATCH_SECRET", "x".repeat(32));
  expect(
    (
      await handleCommunicationDispatch(
        new Request("https://local.test", {
          method: "POST",
          headers: { authorization: "Bearer wrong" },
        }),
      )
    ).status,
  ).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("provider acceptance has a durable idempotency key but is never called delivery", async () => {
  vi.stubEnv("COMMUNICATION_EMAIL_MODE", "live");
  vi.stubEnv("RESEND_API_KEY", "isolated-placeholder");
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_" + btoa("x".repeat(32)));
  rpc.mockImplementation((name) =>
    Promise.resolve({
      data:
        name === "phase8_claim"
          ? envelope
          : name === "phase8_freeze"
            ? communicationTemplate(envelope)
            : null,
      error: null,
    }),
  );
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: unit }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  expect(await processCommunication()).toEqual({
    enabled: true,
    processed: true,
    providerAccepted: true,
  });
  const [url, request] = fetch.mock.calls[0]!;
  expect(url).toBe("https://api.resend.com/emails");
  expect(request.headers["Idempotency-Key"]).toBe(`communication/${id}`);
  expect(rpc).toHaveBeenLastCalledWith(
    "phase8_finish",
    expect.objectContaining({ _id: id, _provider: unit }),
  );
});
it.each(["timeout", "rejection"])(
  "records %s as unknown without changing booking state",
  async (mode) => {
    vi.stubEnv("COMMUNICATION_EMAIL_MODE", "live");
    vi.stubEnv("RESEND_API_KEY", "isolated-placeholder");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_" + btoa("x".repeat(32)));
    rpc.mockImplementation((name) =>
      Promise.resolve({
        data:
          name === "phase8_claim"
            ? envelope
            : name === "phase8_freeze"
              ? communicationTemplate(envelope)
              : null,
        error: null,
      }),
    );
    vi.stubGlobal(
      "fetch",
      mode === "timeout"
        ? vi.fn().mockRejectedValue(new Error("private provider details"))
        : vi.fn().mockResolvedValue(new Response("private", { status: 500 })),
    );
    expect(await processCommunication()).toEqual({
      enabled: true,
      processed: true,
      providerAccepted: false,
    });
    expect(rpc).toHaveBeenLastCalledWith(
      "phase8_finish",
      expect.objectContaining({ _id: id, _provider: null }),
    );
    expect(
      rpc.mock.calls.every(([name]) =>
        ["phase8_claim", "phase8_freeze", "phase8_finish"].includes(name),
      ),
    ).toBe(true);
  },
);

it("incomplete webhook configuration keeps automated delivery disabled", async () => {
  vi.stubEnv("COMMUNICATION_EMAIL_MODE", "live");
  vi.stubEnv("RESEND_API_KEY", "isolated-placeholder");
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
  expect(await processCommunication()).toEqual({ enabled: false, processed: false });
  expect(rpc).not.toHaveBeenCalled();
});

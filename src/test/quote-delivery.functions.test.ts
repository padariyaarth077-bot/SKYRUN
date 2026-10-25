import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const { rpc, adminRpc, getUser, limit, header, createClient, send, single } = vi.hoisted(() => ({
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  getUser: vi.fn(),
  limit: vi.fn(),
  header: vi.fn(),
  createClient: vi.fn(),
  send: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({
    validator: (validate: (input: unknown) => unknown) => ({
      handler:
        (handle: (input: { data: unknown }) => unknown) => async (input: { data: unknown }) =>
          handle({ data: validate(input.data) }),
    }),
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: header,
  setResponseHeader: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: adminRpc,
    from: (table: string) => ({ select: () => ({ eq: () => ({ single: () => single(table) }) }) }),
  },
}));
vi.mock("@/lib/quote-email.server", () => ({ submitQuoteEmail: send }));
import { sendQuoteEmail, getQuoteDeliveryStatus } from "@/lib/quote-delivery.functions";
import { deriveDeliveryCapability } from "@/lib/quote-acceptance.server";
const data = {
  quoteId: "ee2471c9-44b0-4f38-9b58-0fd84686e867",
  deliveryId: "ef965fa7-ed2c-40ef-9b97-93afcc67c703",
  expectedUpdatedAt: "2026-10-18T12:00:00Z",
  expectedRideUpdatedAt: "2026-10-18T12:00:00Z",
  reviewedRecipient: "padariyaarth077@gmail.com",
};
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  for (const [name, value] of Object.entries({
    SUPABASE_URL: "http://127.0.0.1:56341",
    SUPABASE_PUBLISHABLE_KEY: "invalid-fixture",
    QUOTE_EMAIL_MODE: "test",
    QUOTE_PUBLIC_ORIGIN: "http://127.0.0.1:56500",
    RESEND_API_KEY: "invalid-test-key",
    RESEND_WEBHOOK_SECRET: "whsec_" + btoa("a".repeat(32)),
    QUOTE_LINK_SECRET: "ab".repeat(32),
  }))
    vi.stubEnv(name, value);
  header.mockReturnValue("Bearer invalid-session-fixture");
  getUser.mockResolvedValue({ data: { user: { id: "staff" } }, error: null });
  limit.mockResolvedValue({ data: [{ role: "ADMIN" }], error: null });
  createClient.mockReturnValue({
    auth: { getUser },
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ in: () => ({ limit }) }) }) }),
  });
  rpc.mockImplementation(async (name) => ({
    data:
      name === "quote_delivery_status"
        ? {
            deliveryId: data.deliveryId,
            state: "PROVIDER_ACCEPTED",
            frozen: true,
            recipient: data.reviewedRecipient,
          }
        : { proceed: true, state: "IN_FLIGHT" },
    error: null,
  }));
  adminRpc.mockResolvedValue({ data: null, error: null });
  const cap = await deriveDeliveryCapability(data.deliveryId);
  single.mockImplementation(async (table) => ({
    error: null,
    data:
      table === "quote_deliveries"
        ? {
            public_origin: "http://127.0.0.1:56500",
            is_test: true,
            message_text: "TEST ONLY saved immutable body",
          }
        : {
            token_hash: cap.tokenHash,
            recipient_email: data.reviewedRecipient,
            quote_id: data.quoteId,
          },
  }));
  send.mockResolvedValue({ providerEmailId: data.quoteId, state: "provider_accepted" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("reconstructs one deterministic secret per delivery and a different secret per ID", async () => {
  const a = await deriveDeliveryCapability(data.deliveryId),
    b = await deriveDeliveryCapability(data.deliveryId),
    c = await deriveDeliveryCapability(data.quoteId);
  expect(a).toEqual(b);
  expect(a.token).not.toBe(c.token);
  expect(a.token).not.toBe(a.tokenHash);
});
it.each(["missing session", "invalid session", "roleless"])(
  "denies %s before a privileged read or email",
  async (kind) => {
    if (kind === "missing session") header.mockReturnValue(undefined);
    if (kind === "invalid session") getUser.mockResolvedValue({ data: { user: null }, error: {} });
    if (kind === "roleless") limit.mockResolvedValue({ data: [], error: null });
    expect((await sendQuoteEmail({ data })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  },
);
it("defaults to disabled without explicit mode and does not prepare a link", async () => {
  vi.stubEnv("QUOTE_EMAIL_MODE", "");
  expect((await sendQuoteEmail({ data })).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it("normalizes UUID case so retries cannot change provider idempotency keys", async () => {
  expect(
    (
      await sendQuoteEmail({
        data: {
          ...data,
          deliveryId: data.deliveryId.toUpperCase(),
          quoteId: data.quoteId.toUpperCase(),
        },
      })
    ).ok,
  ).toBe(true);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ deliveryId: data.deliveryId, quoteId: data.quoteId }),
  );
});
it("never sends a loopback acceptance URL when connected to a hosted backend", async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.invalid");
  expect((await sendQuoteEmail({ data })).ok).toBe(false);
  expect(send).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("restricts test sends to the owner-approved recipient", async () => {
  expect(
    (await sendQuoteEmail({ data: { ...data, reviewedRecipient: "other@example.test" } })).ok,
  ).toBe(false);
  expect(send).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("requires a successful scoped database claim before reading secrets or sending", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private database detail" } });
  expect((await sendQuoteEmail({ data })).ok).toBe(false);
  expect(single).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it("uses the persisted exact recipient/body and appends the deterministic fragment link only in memory", async () => {
  expect(await sendQuoteEmail({ data })).toEqual({ ok: true, state: "PROVIDER_ACCEPTED" });
  const cap = await deriveDeliveryCapability(data.deliveryId);
  expect(send).toHaveBeenCalledWith({
    deliveryId: data.deliveryId,
    quoteId: data.quoteId,
    to: data.reviewedRecipient,
    isTest: true,
    text: `TEST ONLY saved immutable body\n\nReview and accept your quote:\nhttp://127.0.0.1:56500/quote/accept#token=${cap.token}`,
  });
  expect(adminRpc).toHaveBeenCalledWith(
    "finish_quote_delivery",
    expect.objectContaining({ _delivery_id: data.deliveryId, _provider_email_id: data.quoteId }),
  );
  expect(adminRpc).toHaveBeenCalledWith("process_quote_delivery_events", {
    _provider_email_id: data.quoteId,
  });
  expect(JSON.stringify(rpc.mock.calls)).not.toContain(cap.token);
});
it.each(["IN_FLIGHT", "PROVIDER_ACCEPTED", "DELIVERED", "FAILED"])(
  "does not send again for saved %s state",
  async (state) => {
    rpc.mockResolvedValue({ data: { proceed: false, state }, error: null });
    expect(await sendQuoteEmail({ data })).toEqual({ ok: true, state });
    expect(send).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
  },
);
it("fails closed if the link secret changed since preparation", async () => {
  single.mockImplementation(async (table) => ({
    error: null,
    data:
      table === "quote_deliveries"
        ? { public_origin: "http://127.0.0.1:56500", is_test: true, message_text: "test" }
        : {
            token_hash: "0".repeat(64),
            recipient_email: data.reviewedRecipient,
            quote_id: data.quoteId,
          },
  }));
  expect((await sendQuoteEmail({ data })).ok).toBe(false);
  expect(send).not.toHaveBeenCalled();
});
it("records ambiguous network failures without claiming SENT or losing the stable delivery ID", async () => {
  send.mockRejectedValue(new Error("private provider response"));
  expect((await sendQuoteEmail({ data })).ok).toBe(false);
  expect(adminRpc).toHaveBeenCalledWith(
    "finish_quote_delivery",
    expect.objectContaining({ _delivery_id: data.deliveryId, _provider_email_id: null }),
  );
});
it("does not report success when storing the provider result fails", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  adminRpc.mockResolvedValue({ data: null, error: {} });
  expect((await sendQuoteEmail({ data })).ok).toBe(false);
  expect(log).toHaveBeenCalledWith('{"event":"quote_delivery_failure","stage":"finish_delivery"}');
});
it("reads saved delivery state through the scoped client and reports disabled configuration honestly", async () => {
  vi.stubEnv("QUOTE_EMAIL_MODE", "");
  rpc.mockResolvedValue({
    data: { deliveryId: null, state: "NOT_PREPARED", frozen: false, recipient: null },
    error: null,
  });
  expect(await getQuoteDeliveryStatus({ data: { quoteId: data.quoteId } })).toEqual({
    ok: true,
    deliveryId: null,
    state: "NOT_PREPARED",
    frozen: false,
    recipient: null,
    retryAllowed: true,
    enabled: false,
    isTest: false,
  });
});

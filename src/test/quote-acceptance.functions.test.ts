import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { rpc, setHeader } = vi.hoisted(() => ({ rpc: vi.fn(), setHeader: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({
    validator: (validate: (data: unknown) => unknown) => ({
      handler:
        (handle: (input: { data: unknown }) => unknown) => async (input: { data: unknown }) =>
          handle({ data: validate(input.data) }),
    }),
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: setHeader }));
import { createAcceptanceCapability, hashAcceptanceToken } from "@/lib/quote-acceptance.server";
import { customerQuoteAcceptance } from "@/lib/quote-acceptance.functions";
import { acceptanceFailure } from "@/lib/quote-acceptance.shared";
const token = "ab".repeat(32);
const quote = {
  quoteId: "ee2471c9-44b0-4f38-9b58-0fd84686e867",
  amount: "125.50",
  currency: "USD",
  pickup: "Airport",
  dropoff: "Hotel",
  travelDate: "2099-01-01",
  pickupTime: "14:30:00",
  passengers: 2,
  tripType: "ONE_WAY",
  returnDate: null,
  returnTime: null,
  hourlyDuration: null,
  flightNumber: null,
  expiresAt: "2099-01-01T00:00:00+00:00",
  accepted: false,
  bookingReference: null,
  bookingStatus: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  rpc.mockResolvedValue({ data: quote, error: null });
});
afterEach(() => vi.unstubAllGlobals());
it("generates independent 256-bit tokens and SHA-256 hashes, without storing raw tokens", async () => {
  const a = await createAcceptanceCapability(),
    b = await createAcceptanceCapability();
  expect(a.token).toMatch(/^[a-f0-9]{64}$/);
  expect(a.token).not.toBe(b.token);
  expect(a.tokenHash).toBe(await hashAcceptanceToken(a.token));
  expect(a.tokenHash).not.toBe(a.token);
});
it("preview forwards only a hash and false; excludes arbitrary tenant and recipient overrides", async () => {
  const result = await customerQuoteAcceptance({
    data: { token, accept: false, tenant: "hostile", recipient: "hostile@example.test" } as {
      token: string;
      accept: boolean;
    },
  });
  expect(result).toEqual({ ok: true, quote });
  expect(rpc).toHaveBeenCalledWith("customer_quote_acceptance", {
    _token_hash: await hashAcceptanceToken(token),
    _accept: false,
  });
  expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, private");
});
it("returns accepted only with a confirmed booking reference", async () => {
  rpc.mockResolvedValue({
    data: {
      ...quote,
      accepted: true,
      bookingReference: "BK-confirmed-transaction",
      bookingStatus: "PENDING",
    },
    error: null,
  });
  const result = await customerQuoteAcceptance({ data: { token, accept: true } });
  expect(result.ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith("customer_quote_acceptance", {
    _token_hash: await hashAcceptanceToken(token),
    _accept: true,
  });
});
it.each(["expired", "revoked", "unknown", "missing migration"])(
  "sanitizes %s RPC failure",
  async () => {
    rpc.mockResolvedValue({ data: null, error: { message: `private details ${token}` } });
    expect(await customerQuoteAcceptance({ data: { token, accept: true } })).toEqual({
      ok: false,
      message: acceptanceFailure,
    });
  },
);
it("sanitizes unexpected transport failure", async () => {
  rpc.mockRejectedValue(new Error("sensitive transport"));
  expect(await customerQuoteAcceptance({ data: { token, accept: false } })).toEqual({
    ok: false,
    message: acceptanceFailure,
  });
});
it.each([{ ...quote, accepted: true }, { ...quote, quoteId: "invalid" }, quote])(
  "does not falsely confirm an incomplete acceptance result",
  async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect(await customerQuoteAcceptance({ data: { token, accept: true } })).toEqual({
      ok: false,
      message: acceptanceFailure,
    });
  },
);
it.each(["", "guessable", "a".repeat(63), "a".repeat(65), "Z".repeat(64)])(
  "rejects malformed capabilities before any database call",
  async (value) => {
    await expect(
      customerQuoteAcceptance({ data: { token: value, accept: false } }),
    ).rejects.toThrow(acceptanceFailure);
    expect(rpc).not.toHaveBeenCalled();
  },
);

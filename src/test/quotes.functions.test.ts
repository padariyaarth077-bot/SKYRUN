import { beforeEach, expect, it, vi } from "vitest";
const { rpc, getUser, limit, header, createClient } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  limit: vi.fn(),
  header: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator: (validate: (d: unknown) => unknown) => ({
      handler: (handle: (input: { data: unknown }) => unknown) => (input: { data: unknown }) =>
        handle({ data: validate(input.data) }),
    }),
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: header }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
import { quoteDraftSchema, quoteIsEditable } from "@/lib/quotes.shared";
import { saveQuoteDraft } from "@/lib/quotes.functions";
const data = {
  quoteId: "11111111-1111-4111-8111-111111111111",
  rideRequestId: "22222222-2222-4222-8222-222222222222",
  amount: "125.50",
  currency: "USD",
  validUntil: "2099-11-06T14:30:00Z",
  notes: "Two bags",
  expectedUpdatedAt: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:56341");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "local-public-fixture");
  header.mockReturnValue("Bearer invalid-test-fixture");
  getUser.mockResolvedValue({ data: { user: { id: "staff" } }, error: null });
  limit.mockResolvedValue({ data: [{ role: "ADMIN" }], error: null });
  createClient.mockReturnValue({
    auth: { getUser },
    rpc,
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit,
    }),
  });
  rpc.mockResolvedValue({ data: data.quoteId, error: null });
});
it("accepts decimal text without rounding and permits zero without inventing a minimum price", () => {
  expect(quoteDraftSchema.safeParse(data).success).toBe(true);
  expect(quoteDraftSchema.safeParse({ ...data, amount: "0" }).success).toBe(true);
});
it.each(["-1", "1.001", "100000000.00", "NaN", "1e2", "01.00", ""])(
  "rejects invalid monetary amount %s",
  (amount) => {
    expect(quoteDraftSchema.safeParse({ ...data, amount }).success).toBe(false);
  },
);
it.each([
  { currency: "usd" },
  { currency: "US" },
  { validUntil: "2000-01-01T00:00:00Z" },
  { validUntil: "bad" },
  { notes: "x".repeat(4001) },
  { quoteId: "bad" },
])("rejects malformed quote input %s", (change) => {
  expect(quoteDraftSchema.safeParse({ ...data, ...change }).success).toBe(false);
});
it.each(["SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"])(
  "does not permit editing %s",
  (status) => {
    expect(quoteIsEditable({ status, valid_until: data.validUntil })).toBe(false);
  },
);
it("rejects expired draft edits", () => {
  expect(quoteIsEditable({ status: "DRAFT", valid_until: "2000-01-01" })).toBe(false);
});
it("verifies the caller and forwards only validated draft fields to the RPC", async () => {
  await expect(saveQuoteDraft({ data })).resolves.toEqual({ id: data.quoteId });
  expect(getUser).toHaveBeenCalledWith("invalid-test-fixture");
  expect(rpc).toHaveBeenCalledWith("save_quote_draft", {
    _quote_id: data.quoteId,
    _ride_request_id: data.rideRequestId,
    _amount: "125.50",
    _currency: "USD",
    _valid_until: data.validUntil,
    _notes: "Two bags",
    _expected_updated_at: null,
  });
  expect(createClient).toHaveBeenCalledWith(
    "http://127.0.0.1:56341",
    "local-public-fixture",
    expect.objectContaining({
      global: { headers: { Authorization: "Bearer invalid-test-fixture" } },
    }),
  );
});
it("rejects missing authorization before constructing a database client", async () => {
  header.mockReturnValue(undefined);
  await expect(saveQuoteDraft({ data })).rejects.toThrow("Please sign in again");
  expect(createClient).not.toHaveBeenCalled();
});
it("rejects invalid identity and roleless callers without invoking the RPC", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "private" } });
  await expect(saveQuoteDraft({ data })).rejects.toThrow("Please sign in again");
  getUser.mockResolvedValue({ data: { user: { id: "staff" } }, error: null });
  limit.mockResolvedValue({ data: [], error: null });
  await expect(saveQuoteDraft({ data })).rejects.toThrow("Staff access is required");
  expect(rpc).not.toHaveBeenCalled();
});
it("reports a missing approved migration honestly", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "private" } });
  await expect(saveQuoteDraft({ data })).rejects.toThrow("approved Phase 3 database update");
});
it("sanitizes database errors and refuses unconfirmed results", async () => {
  rpc
    .mockResolvedValueOnce({ data: null, error: { message: "private" } })
    .mockResolvedValueOnce({ data: "unexpected", error: null });
  await expect(saveQuoteDraft({ data })).rejects.toThrow("Could not save the draft");
  await expect(saveQuoteDraft({ data })).rejects.toThrow("Could not save the draft");
});

it("sanitizes unexpected authentication transport failures", async () => {
  getUser.mockRejectedValue(new Error("private transport details"));
  await expect(saveQuoteDraft({ data })).rejects.toThrow("Quote saving is unavailable.");
  expect(rpc).not.toHaveBeenCalled();
});
it("ignores client-supplied tenant and actor overrides", async () => {
  await saveQuoteDraft({
    data: { ...data, business_unit_id: "other-tenant", actor_id: "other-user" } as typeof data,
  });
  expect(rpc).toHaveBeenCalledWith(
    "save_quote_draft",
    expect.not.objectContaining({ _business_unit_id: "other-tenant" }),
  );
  expect(rpc.mock.calls[0]![1]).not.toHaveProperty("_actor_id");
});
it("rejects impossible calendar dates", () => {
  expect(quoteDraftSchema.safeParse({ ...data, validUntil: "2099-02-30T12:00:00Z" }).success).toBe(
    false,
  );
});

import { beforeEach, expect, it, vi } from "vitest";
const { rpc, budget } = vi.hoisted(() => ({ rpc: vi.fn(), budget: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@/lib/public-budget.server", () => ({ enforcePublicBudget: budget }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator: (validate: (input: unknown) => unknown) => ({
      handler: (handler: (input: { data: unknown }) => unknown) => (input: { data: unknown }) =>
        handler({ data: validate(input.data) }),
    }),
  }),
}));
import { submitRegularRide } from "@/lib/regular-booking.functions";
const data = {
  submissionKey: "11111111-1111-4111-8111-111111111111",
  name: "Test",
  email: "TEST@example.test",
  phone: "12345678",
  service: "Airport transfer",
  pickupLocation: "ORD",
  dropoffLocation: "Chicago",
  travelDate: "2099-11-06",
  pickupTime: "14:30",
  passengerCount: 2,
  categoryCode: "regular-sedan",
  luggageDetails: "Two bags",
};
beforeEach(() => {
  vi.resetAllMocks();
  budget.mockResolvedValue(undefined);
});
it("uses the rate budget and separate fixed-scope database operation without client price authority", async () => {
  rpc.mockResolvedValue({ data: { reference: "RR-TEST" }, error: null });
  await expect(submitRegularRide({ data })).resolves.toEqual({ ok: true, reference: "RR-TEST" });
  expect(budget).toHaveBeenCalledWith("ride");
  expect(rpc).toHaveBeenCalledWith(
    "submit_regular_ride",
    expect.objectContaining({
      _category: "regular-sedan",
      _email: "test@example.test",
      _luggage: "Two bags",
    }),
  );
  expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("_amount");
  expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("_business_unit_id");
});
it("rejects rate exhaustion and invalid payloads before a database operation", async () => {
  budget.mockRejectedValue(new Error("Rate limited"));
  await expect(submitRegularRide({ data })).rejects.toThrow("Rate limited");
  expect(rpc).not.toHaveBeenCalled();
  for (const patch of [
    { categoryCode: "Rolls-Royce Ghost" },
    { amount: 1 },
    { booking_mode: "regular" },
    { website: "spam" },
  ])
    expect(() => submitRegularRide({ data: { ...data, ...patch } })).toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it("hides database details and never reports malformed success as saved", async () => {
  for (const result of [
    { data: null, error: { message: "private" } },
    { data: { reference: "" }, error: null },
  ]) {
    rpc.mockResolvedValue(result);
    await expect(submitRegularRide({ data })).rejects.toThrow("Regular request unavailable");
  }
});

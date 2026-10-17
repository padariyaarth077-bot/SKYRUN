import { beforeEach, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc, from } }));
// Exercise the actual validator and handler without TanStack's HTTP transport.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator: (validate: (data: unknown) => unknown) => ({
      handler: (handle: (input: { data: unknown }) => unknown) => (input: { data: unknown }) =>
        handle({ data: validate(input.data) }),
    }),
  }),
}));
import { submitLead, submitRideEnquiry } from "@/lib/leads.functions";
const data = {
  submissionKey: "8d78657a-ff8c-4bb1-92a3-82c9e3d4c56b",
  name: "Ava",
  email: "AVA@example.com",
  phone: "12345",
  service: "Airport transfer",
  pickupLocation: "Airport",
  dropoffLocation: "Hotel",
  travelDate: "2026-11-06",
  pickupTime: "14:30",
  passengerCount: 2,
};
beforeEach(() => vi.resetAllMocks());

it("keeps generic contact leads separate and scopes customer lookup to the limo business unit", async () => {
  const customer = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "customer" }, error: null }),
  };
  const lead = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "lead", business_unit_id: "00000000-0000-0000-0000-000000000002" },
      error: null,
    }),
  };
  const activity = { insert: vi.fn().mockResolvedValue({ error: null }) };
  from.mockImplementation((table: string) =>
    table === "customers" ? customer : table === "leads" ? lead : activity,
  );
  await expect(
    submitLead({
      data: { source: "CONTACT_FORM", name: "Ava", email: "ava@example.com", phone: "12345" },
    }),
  ).resolves.toMatchObject({ ok: true });
  expect(customer.eq).toHaveBeenCalledWith(
    "business_unit_id",
    "00000000-0000-0000-0000-000000000002",
  );
  expect(lead.insert).toHaveBeenCalledWith(
    expect.objectContaining({ source: "CONTACT_FORM", customer_id: "customer", status: "NEW" }),
  );
  expect(from).not.toHaveBeenCalledWith("ride_requests");
  expect(rpc).not.toHaveBeenCalled();
});

it("calls the ride RPC with the server-selected tenant and mapped fields", async () => {
  rpc.mockResolvedValue({ data: { reference: "SR-TEST" }, error: null });
  await expect(submitRideEnquiry({ data })).resolves.toEqual({ ok: true, reference: "SR-TEST" });
  expect(rpc).toHaveBeenCalledWith(
    "create_ride_enquiry",
    expect.objectContaining({
      _business_unit_id: "00000000-0000-0000-0000-000000000002",
      _email: "ava@example.com",
      _submission_key: data.submissionKey,
      _pickup_location: "Airport",
      _passenger_count: 2,
    }),
  );
});
it.each([null, {}, { reference: "" }])("rejects malformed success results %s", async (result) => {
  rpc.mockResolvedValue({ data: result, error: null });
  await expect(submitRideEnquiry({ data })).rejects.toThrow("Could not save your ride request");
});
it("hides database errors", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private detail" } });
  await expect(submitRideEnquiry({ data })).rejects.toThrow("Could not save your ride request");
});
it("rejects invalid inputs before the database call", () => {
  expect(() => submitRideEnquiry({ data: { ...data, travelDate: "2026-02-30" } })).toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it("ignores a caller-supplied tenant and keeps the public endpoint scoped to Skyrun Limo", async () => {
  rpc.mockResolvedValue({ data: { reference: "SR-TEST" }, error: null });
  await submitRideEnquiry({ data: { ...data, business_unit_id: "another-tenant" } });
  expect(rpc.mock.calls[0]?.[1]._business_unit_id).toBe("00000000-0000-0000-0000-000000000002");
});

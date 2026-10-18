import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
const { from, save, navigate, session, params, search } = vi.hoisted(() => ({
  from: vi.fn(),
  save: vi.fn(),
  navigate: vi.fn(),
  session: vi.fn(),
  params: { id: "new" },
  search: { rideRequestId: "22222222-2222-4222-8222-222222222222" },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from, auth: { getSession: session } },
}));
vi.mock("@/lib/quotes.functions", () => ({ saveQuoteDraft: save }));
vi.mock("@/lib/quote-delivery.functions", () => ({
  getQuoteDeliveryStatus: vi
    .fn()
    .mockResolvedValue({ ok: false, message: "Delivery configuration pending" }),
  sendQuoteEmail: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => params,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
import { Route as QuoteRoute } from "@/routes/_authenticated/admin.quote.$id";
import { Route as BookingRoute } from "@/routes/_authenticated/admin.booking.$id";
const Quote = QuoteRoute.options.component as ComponentType,
  Booking = BookingRoute.options.component as ComponentType;
const ride = {
  id: search.rideRequestId,
  lead_id: "lead",
  customer_id: "customer",
  status: "SUBMITTED",
  request_number: "RQ-TEST",
  pickup_location: "Airport",
  dropoff_location: "Hotel",
  travel_date: "2099-11-06",
  pickup_time: "14:30",
  passenger_count: 2,
  notes: "Two bags",
};
const quote = {
  id: "11111111-1111-4111-8111-111111111111",
  ride_request_id: ride.id,
  amount: 125.5,
  currency: "USD",
  valid_until: "2099-11-06T14:30:00Z",
  updated_at: "2026-10-18T12:00:00Z",
  status: "DRAFT",
  pickup_location: "Quoted airport",
  dropoff_location: "Quoted hotel",
  travel_date: ride.travel_date,
  pickup_time: ride.pickup_time,
  notes: "Quote notes",
};
function stub(table: string, leadStatus = "GENUINE", q = quote) {
  const data =
    table === "ride_requests"
      ? ride
      : table === "customers"
        ? { id: "customer", full_name: "Ava" }
        : table === "leads"
          ? { status: leadStatus }
          : table === "quotes"
            ? q
            : null;
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  params.id = "new";
  from.mockImplementation((t) => stub(t));
  session.mockResolvedValue({
    data: { session: { access_token: "invalid-session-fixture" } },
    error: null,
  });
  save.mockImplementation(({ data }) => Promise.resolve({ id: data.quoteId }));
});
afterEach(cleanup);
async function fill() {
  await screen.findByRole("textbox", { name: "Quote amount" });
  fireEvent.change(screen.getByRole("textbox", { name: "Quote amount" }), {
    target: { value: "125.50" },
  });
  fireEvent.change(screen.getByLabelText("Quote expiry"), {
    target: { value: "2099-11-06T14:30" },
  });
}
it("prepares a draft only from an eligible genuine enquiry", async () => {
  render(<Quote />);
  expect(await screen.findByRole("button", { name: "Save draft" })).toBeInTheDocument();
  expect(screen.getByText("Ava")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /send|accept|confirm booking/i })).toBeNull();
  expect(screen.getByText(/Save a draft before reviewing delivery/)).toBeInTheDocument();
});
it.each(["NEW", "SPAM", "REVIEWING"])("does not allow %s to create a quote", async (status) => {
  from.mockImplementation((t) => stub(t, status));
  render(<Quote />);
  expect(await screen.findByText(/A Genuine lead/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
});
it("preserves fields and draft id across a missing-migration failure and retry", async () => {
  save
    .mockRejectedValueOnce(new Error("Draft saving requires the approved Phase 3 database update."))
    .mockImplementationOnce(({ data }) => Promise.resolve({ id: data.quoteId }));
  render(<Quote />);
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText("Draft saving requires the approved Phase 3 database update.");
  expect(screen.getByRole("textbox", { name: "Quote amount" })).toHaveValue("125.50");
  const firstId = save.mock.calls[0]![0].data.quoteId;
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(save.mock.calls[1]![0].data.quoteId).toBe(firstId);
});
it("prevents duplicate pending submissions", async () => {
  let finish!: (value: { id: string }) => void;
  save.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Quote />);
  await fill();
  const b = screen.getByRole("button", { name: "Save draft" });
  fireEvent.click(b);
  await screen.findByRole("button", { name: "Saving…" });
  fireEvent.click(b);
  expect(save).toHaveBeenCalledTimes(1);
  finish({ id: quote.id });
  await waitFor(() => expect(navigate).toHaveBeenCalled());
});
it("blocks draft expiry/amount validation before the server call", async () => {
  render(<Quote />);
  await fill();
  fireEvent.change(screen.getByRole("textbox", { name: "Quote amount" }), {
    target: { value: "1.001" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByText(/nonnegative amount/)).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});
it.each(["SENT", "ACCEPTED", "DECLINED", "EXPIRED"])(
  "renders %s quotes read-only without fake transition actions",
  async (status) => {
    params.id = quote.id;
    from.mockImplementation((t) => stub(t, "GENUINE", { ...quote, status }));
    render(<Quote />);
    expect(await screen.findByText(/This quote is read-only/)).toBeInTheDocument();
    expect(screen.getByText("USD 125.50")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  },
);
it("hides database details when quote reading fails", async () => {
  from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "private" } }),
  });
  render(<Quote />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load quote information");
  expect(screen.queryByText(/private/)).toBeNull();
});
it("shows stored booking relationships without implying confirmation", async () => {
  params.id = "booking";
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: "booking",
        booking_number: "BK-TEST",
        status: "PENDING",
        customer_id: "customer",
        ride_request_id: ride.id,
        quote_id: quote.id,
        final_amount: 125.5,
        currency: "USD",
        pickup_location: "Airport",
        dropoff_location: "Hotel",
        travel_date: ride.travel_date,
        pickup_time: "14:30",
        passenger_count: 2,
      },
      error: null,
    }),
  }));
  render(<Booking />);
  expect(await screen.findByText("Linked quote")).toBeInTheDocument();
  expect(screen.getByText("PENDING")).toBeInTheDocument();
  expect(screen.getByText("Agreed amount: USD 125.50")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /confirm|assign|pay/i })).toBeNull();
});

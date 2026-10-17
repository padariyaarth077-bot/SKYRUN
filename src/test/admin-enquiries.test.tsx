import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";

const { from, fetchLeads } = vi.hoisted(() => ({ from: vi.fn(), fetchLeads: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/lib/admin-data", () => ({ fetchLeads, setLeadStatus: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ id: "lead" }),
    useRouteContext: () => ({ user: { id: "staff" } }),
    useSearch: () => ({ status: "NEW", q: "" }),
  }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  LEAD_STATUSES: ["NEW", "GENUINE", "SPAM"],
  timeAgo: () => "Just now",
}));
import { Route as DetailRoute } from "@/routes/_authenticated/admin.leads.$id";
import { Route as ListRoute } from "@/routes/_authenticated/admin.leads.index";
const Detail = DetailRoute.options.component as ComponentType;
const List = ListRoute.options.component as ComponentType;
const lead = {
  id: "lead",
  lead_number: "SR-TEST",
  status: "NEW",
  priority: "NORMAL",
  source: "RIDE_ENQUIRY",
  subject: "Ride request",
  message: "Airport transfer",
  created_at: "2026-10-17T12:00:00Z",
  customers: { full_name: "Ava", email: "ava@example.test", phone: "12345", company_name: null },
  ride_requests: [
    {
      id: "ride",
      request_number: "RQ-TEST",
      status: "SUBMITTED",
      travel_date: "2026-11-06",
      pickup_time: "14:30:00",
      pickup_location: "Airport",
      dropoff_location: "Hotel",
      passenger_count: 2,
      notes: "Luxury SUV; two bags",
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: lead, error: null }),
    order: vi.fn().mockResolvedValue({
      data:
        table === "activities"
          ? [
              {
                id: "activity",
                activity_type: "CREATED",
                description: "Ride created",
                created_at: lead.created_at,
              },
            ]
          : [],
      error: null,
    }),
  }));
});
afterEach(cleanup);

it("shows the ride enquiry in the NEW review list and excludes other statuses", async () => {
  fetchLeads.mockResolvedValue([
    lead,
    { ...lead, id: "genuine", lead_number: "SR-GENUINE", status: "GENUINE" },
  ]);
  render(<List />);
  expect(await screen.findByText("SR-TEST")).toBeInTheDocument();
  expect(screen.queryByText("SR-GENUINE")).toBeNull();
  expect(screen.getByText("RIDE_ENQUIRY")).toBeInTheDocument();
});
it("shows a safe list error and can retry instead of claiming there are no leads", async () => {
  fetchLeads
    .mockRejectedValueOnce(new Error("private database detail"))
    .mockResolvedValueOnce([lead]);
  render(<List />);
  await screen.findByRole("alert");
  expect(screen.queryByText(/private database/)).toBeNull();
  expect(screen.queryByText(/No leads match/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("SR-TEST")).toBeInTheDocument();
});
it("displays the linked customer, trip and review controls on the actual lead detail component", async () => {
  render(<Detail />);
  expect(await screen.findByText("Ride enquiry RQ-TEST")).toBeInTheDocument();
  expect(screen.getByText("Pickup: Airport")).toBeInTheDocument();
  expect(screen.getByText("Drop-off: Hotel")).toBeInTheDocument();
  expect(screen.getByText("Passengers: 2")).toBeInTheDocument();
  expect(screen.getByText("Ava")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mark Genuine" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Ride created")).toBeInTheDocument());
});
it.each([null, { message: "private database detail" }])(
  "distinguishes missing and failed detail reads",
  async (error) => {
    from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    render(<Detail />);
    await screen.findByText(error ? /Could not load this enquiry/ : /Lead not found/);
    expect(screen.queryByText(/private database/)).toBeNull();
  },
);

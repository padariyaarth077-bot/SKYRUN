import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";

const { from, fetchLeads, rpc, navigate, setLeadStatus } = vi.hoisted(() => ({
  from: vi.fn(),
  fetchLeads: vi.fn(),
  rpc: vi.fn(),
  navigate: vi.fn(),
  setLeadStatus: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@/lib/admin-data", async (original) => ({
  ...(await original<typeof import("@/lib/admin-data")>()),
  fetchLeads,
  setLeadStatus,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ id: "lead", module: "ride-enquiries" }),
    useRouteContext: () => ({ user: { id: "staff" } }),
    useSearch: () => ({ status: "NEW", q: "" }),
  }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigate,
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
import { Route as DashboardRoute } from "@/routes/_authenticated/admin.index";
import { Route as ModuleRoute } from "@/routes/_authenticated/admin.m.$module";
const Detail = DetailRoute.options.component as ComponentType;
const List = ListRoute.options.component as ComponentType;
const Dashboard = DashboardRoute.options.component as ComponentType;
const Module = ModuleRoute.options.component as ComponentType;
const lead = {
  id: "lead",
  lead_number: "SR-TEST",
  status: "NEW",
  priority: "NORMAL",
  source: "RIDE_ENQUIRY",
  subject: "Ride request",
  message: "Airport transfer",
  created_at: "2026-10-17T12:00:00Z",
  customers: {
    id: "customer",
    full_name: "Ava",
    email: "ava@example.test",
    phone: "12345",
    company_name: null,
  },
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
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
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

it("opens dashboard review and recent lead rows on double-click", async () => {
  fetchLeads.mockResolvedValue([lead]);
  from.mockImplementation((table: string) =>
    table === "ride_requests"
      ? { select: vi.fn().mockResolvedValue({ count: 1, error: null }) }
      : {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        },
  );
  render(<Dashboard />);
  const names = await screen.findAllByText("Ava");
  for (const name of names) {
    const row = name.closest("li,tr");
    expect(row).not.toBeNull();
    fireEvent.doubleClick(row!);
  }
  expect(navigate).toHaveBeenCalledTimes(2);
  expect(navigate).toHaveBeenCalledWith({ to: "/admin/leads/$id", params: { id: "lead" } });
});

it("opens enquiry module rows on double-click", async () => {
  from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [lead], error: null }),
  });
  render(<Module />);
  fireEvent.doubleClick(await screen.findByText("Ava"));
  expect(navigate).toHaveBeenCalledWith({ to: "/admin/leads/$id", params: { id: "lead" } });
});

it("opens a lead on row double-click without hijacking the checkbox", async () => {
  fetchLeads.mockResolvedValue([lead]);
  render(<List />);
  const cell = await screen.findByText("Ava");
  fireEvent.doubleClick(cell);
  expect(navigate).toHaveBeenCalledWith({ to: "/admin/leads/$id", params: { id: "lead" } });
  navigate.mockClear();
  fireEvent.doubleClick(cell.closest("tr")!.querySelector("input")!);
  expect(navigate).not.toHaveBeenCalled();
});

it("preserves failed notes, shows safe feedback and clears only after a successful retry", async () => {
  rpc
    .mockResolvedValueOnce({ error: { message: "private database detail" } })
    .mockResolvedValueOnce({ data: "new-activity", error: null });
  render(<Detail />);
  const input = await screen.findByRole("textbox", { name: "Activity note" });
  const button = screen.getByRole("button", { name: "Add" });
  expect(button).toBeDisabled();
  fireEvent.change(input, { target: { value: "Called customer about pickup" } });
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save your note");
  expect(input).toHaveValue("Called customer about pickup");
  expect(screen.queryByText(/private database/)).toBeNull();
  fireEvent.click(button);
  await waitFor(() => expect(input).toHaveValue(""));
  expect(rpc).toHaveBeenLastCalledWith(
    "log_activity",
    expect.objectContaining({
      _entity_type: "lead",
      _entity_id: "lead",
      _activity_type: "NOTE",
      _description: "Called customer about pickup",
      _metadata: { actor_id: "staff" },
    }),
  );
});

it("disables note submission while saving and refreshes the timeline", async () => {
  let finish!: (value: { data: string; error: null }) => void;
  rpc.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Detail />);
  const input = await screen.findByRole("textbox", { name: "Activity note" });
  fireEvent.change(input, { target: { value: "Test note" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(input).toBeDisabled();
  from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: lead, error: null }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data:
        table === "activities"
          ? [
              {
                id: "note",
                activity_type: "NOTE",
                description: "Test note",
                created_at: lead.created_at,
              },
            ]
          : [],
      error: null,
    }),
  }));
  finish({ data: "note", error: null });
  expect(await screen.findByText("Test note")).toBeInTheDocument();
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("shows the ride enquiry in the NEW review list and excludes other statuses", async () => {
  fetchLeads.mockResolvedValue([
    lead,
    { ...lead, id: "genuine", lead_number: "SR-GENUINE", status: "GENUINE" },
  ]);
  render(<List />);
  expect(await screen.findByText("SR-TEST")).toBeInTheDocument();
  expect(screen.queryByText("SR-GENUINE")).toBeNull();
  expect(screen.getAllByText("RIDE_ENQUIRY").length).toBeGreaterThan(0);
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
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    render(<Detail />);
    await screen.findByText(error ? /Could not load this enquiry/ : /Lead not found/);
    expect(screen.queryByText(/private database/)).toBeNull();
  },
);

it("dashboard query failure never fabricates zero metrics or empty state", async () => {
  fetchLeads.mockRejectedValue(new Error("private database detail"));
  from.mockImplementation((t: string) =>
    t === "ride_requests"
      ? { select: vi.fn().mockResolvedValue({ count: null, error: { message: "private" } }) }
      : {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: null, error: { message: "private" } }),
        },
  );
  render(<Dashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load dashboard data");
  expect(screen.queryByText(/All caught up/)).toBeNull();
  expect(screen.queryByText("No activity yet.")).toBeNull();
});
it("lead list paginates and sorts actual records", async () => {
  fetchLeads.mockResolvedValue(
    Array.from({ length: 51 }, (_, i) => ({
      ...lead,
      id: String(i),
      lead_number: `SR-${i}`,
      customers: { ...lead.customers, full_name: `Person ${i}` },
    })),
  );
  render(<List />);
  await screen.findByText("SR-0");
  expect(screen.queryByText("SR-50")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("SR-50")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lead sort" }), {
    target: { value: "oldest" },
  });
  expect(screen.getByText("SR-50")).toBeInTheDocument();
  expect(screen.queryByText("SR-0")).toBeNull();
});
it("review failures stay visible and duplicate clicks are blocked", async () => {
  let reject!: (reason: Error) => void;
  setLeadStatus.mockImplementation(
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
  );
  fetchLeads.mockResolvedValue([lead]);
  render(<List />);
  await screen.findByText("SR-TEST");
  const b = screen.getByRole("button", { name: "Genuine" });
  fireEvent.click(b);
  fireEvent.click(b);
  expect(setLeadStatus).toHaveBeenCalledTimes(1);
  expect(b).toBeDisabled();
  reject(new Error("Could not save the lead status. Please refresh and retry."));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
});
it("activity query failures are not labelled an empty timeline", async () => {
  from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: lead, error: null }),
    order: vi.fn().mockResolvedValue({
      data: null,
      error: table === "activities" ? { message: "private" } : null,
    }),
  }));
  render(<Detail />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load the activity timeline",
  );
  expect(screen.queryByText("No activity yet.")).toBeNull();
});

it("dashboard metrics use precise, separate lead and ride counts", async () => {
  fetchLeads.mockResolvedValue([
    lead,
    { ...lead, id: "review", status: "REVIEWING" },
    { ...lead, id: "good", status: "GENUINE" },
    { ...lead, id: "contacted", status: "CONTACTED" },
    { ...lead, id: "spam", status: "SPAM" },
  ]);
  from.mockImplementation((t: string) =>
    t === "ride_requests"
      ? { select: vi.fn().mockResolvedValue({ count: 3, error: null }) }
      : {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        },
  );
  render(<Dashboard />);
  await waitFor(() =>
    expect(
      within(screen.getByText("Total leads").closest(".adm-in") as HTMLElement).getByText("5"),
    ).toBeInTheDocument(),
  );
  expect(
    within(screen.getByText("Needs review").closest(".adm-in") as HTMLElement).getByText("2"),
  ).toBeInTheDocument();
  expect(
    within(screen.getAllByText("Genuine")[0]!.closest(".adm-in") as HTMLElement).getByText("1"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByText("Ride requests").closest(".adm-in") as HTMLElement).getByText("3"),
  ).toBeInTheDocument();
});
it("validates supported lead query parameters and bounds search", () => {
  const validate = ListRoute.options.validateSearch as (
    s: Record<string, unknown>,
  ) => Record<string, unknown>;
  expect(validate({ status: "FAKE", source: "FAKE", q: 42 })).toEqual({});
  expect(validate({ status: "NEEDS_REVIEW", source: "CONTACT_FORM", q: "x".repeat(300) })).toEqual({
    status: "NEEDS_REVIEW",
    source: "CONTACT_FORM",
    q: "x".repeat(200),
  });
});

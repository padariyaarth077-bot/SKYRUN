import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
const { from, rpc, params } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  params: { id: "customer", module: "contact-messages" },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => params }),
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    params: p,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => <a href={to.replace("$id", p?.["id"] ?? "")}>{children}</a>,
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
  Panel: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  timeAgo: () => "Just now",
}));
import { Route as CustomersRoute } from "@/routes/_authenticated/admin.customers";
import { Route as CustomerRoute } from "@/routes/_authenticated/admin.customer.$id";
import { Route as RideRoute } from "@/routes/_authenticated/admin.ride-request.$id";
import { Route as ModuleRoute } from "@/routes/_authenticated/admin.m.$module";
const Customers = CustomersRoute.options.component as ComponentType,
  Customer = CustomerRoute.options.component as ComponentType,
  Ride = RideRoute.options.component as ComponentType,
  Module = ModuleRoute.options.component as ComponentType;
const customer = {
  id: "customer",
  business_unit_id: "unit",
  updated_at: "2026-10-21T12:00:00Z",
  full_name: "Ava",
  email: "ava@example.test",
  phone: "12345",
  company_name: null,
  created_at: "2026-10-18",
};
function chain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi
      .fn()
      .mockResolvedValue({ data: Array.isArray(data) || data === null ? data : [data], error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({ data: false, error: null });
  params.id = "customer";
  params.module = "contact-messages";
});
afterEach(cleanup);
it("shows customer loading failure distinctly and retries", async () => {
  from
    .mockReturnValueOnce(chain(null, { message: "private database" }))
    .mockReturnValue(chain([customer]));
  render(<Customers />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load customers");
  expect(screen.queryByText(/No customers/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("link", { name: "Ava" })).toHaveAttribute(
    "href",
    "/admin/customer/customer",
  );
});
it("searches customer email and paginates without duplicates", async () => {
  from.mockReturnValue(
    chain(
      Array.from({ length: 51 }, (_, i) => ({
        ...customer,
        id: String(i),
        full_name: `Customer ${i}`,
        email: `test${i}@example.test`,
      })),
    ),
  );
  render(<Customers />);
  await screen.findByText("Customer 0");
  expect(screen.queryByText("Customer 50")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Customer 50")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search customers" }), {
    target: { value: "TEST20@example.test" },
  });
  expect(screen.getByText("Customer 20")).toBeInTheDocument();
  expect(screen.queryByText("Customer 50")).toBeNull();
});
it("shows customer with no associated enquiries honestly", async () => {
  from.mockImplementation((t) => (t === "customers" ? chain(customer) : chain([])));
  render(<Customer />);
  expect(await screen.findByText("No leads for this customer.")).toBeInTheDocument();
  expect(screen.getByText("No ride requests for this customer.")).toBeInTheDocument();
});
it("loads linked customer history scoped by customer id", async () => {
  const leads = chain([
    {
      id: "lead",
      lead_number: "SR-1",
      source: "CONTACT_FORM",
      status: "NEW",
      subject: "Contact",
      created_at: "2026-10-18",
    },
  ]);
  from.mockImplementation((t) =>
    t === "customers" ? chain(customer) : t === "leads" ? leads : chain([]),
  );
  render(<Customer />);
  expect(await screen.findByRole("link", { name: "SR-1" })).toHaveAttribute(
    "href",
    "/admin/leads/lead",
  );
  expect(leads.eq).toHaveBeenCalledWith("customer_id", "customer");
  expect(leads.eq).toHaveBeenCalledWith("business_unit_id", "unit");
});
it("distinguishes missing customer from forbidden/failed history", async () => {
  from.mockReturnValue(chain(null));
  render(<Customer />);
  expect(await screen.findByText("Customer not found or unavailable.")).toBeInTheDocument();
});
it("displays unlinked ride details without inventing a booking", async () => {
  from.mockImplementation((t) =>
    t === "customers"
      ? chain(customer)
      : chain({
          id: "ride",
          customer_id: "customer",
          lead_id: null,
          request_number: "RQ-1",
          status: "SUBMITTED",
          pickup_location: "Airport",
          dropoff_location: "Hotel",
          travel_date: "2026-11-06",
          pickup_time: "14:30",
          passenger_count: 2,
          trip_type: "ONE_WAY",
          notes: "Two bags",
        }),
  );
  render(<Ride />);
  expect(await screen.findByText("No lead linked to this request.")).toBeInTheDocument();
  expect(screen.getByText("Two bags")).toBeInTheDocument();
  expect(screen.getByText(/does not confirm a booking/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ava" })).toHaveAttribute(
    "href",
    "/admin/customer/customer",
  );
});
it("contact messages query only CONTACT_FORM and display actual message/contact", async () => {
  const query = chain([
    {
      id: "lead",
      lead_number: "SR-CONTACT",
      subject: "Question",
      message: "Please call",
      status: "NEW",
      created_at: "2026-10-18",
      customers: customer,
    },
  ]);
  from.mockReturnValue(query);
  render(<Module />);
  expect(await screen.findByText("Please call")).toBeInTheDocument();
  expect(query.eq).toHaveBeenCalledWith("source", "CONTACT_FORM");
  expect(screen.getByText("ava@example.test")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search records" }), {
    target: { value: "unmatched" },
  });
  expect(screen.getByText("No records yet.")).toBeInTheDocument();
});
it("hides private module errors and never claims empty data on failure", async () => {
  from.mockReturnValue(chain(null, { message: "private database detail" }));
  render(<Module />);
  expect(await screen.findByText("Could not load records. Please retry.")).toBeInTheDocument();
  expect(screen.queryByText(/private database/)).toBeNull();
  expect(screen.queryByText("No records yet.")).toBeNull();
});

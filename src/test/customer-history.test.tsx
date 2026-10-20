import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
const { from, rpc, queries } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  queries: [] as { table: string; field: string; value: string }[],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ id: "customer" }) }),
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params?: { id: string };
    children: ReactNode;
  }) => <a href={to.replace("$id", params?.id ?? "")}>{children}</a>,
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
  Panel: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  timeAgo: () => "Recently",
}));
import { Route } from "@/routes/_authenticated/admin.customer.$id";
const Detail = Route.options.component as ComponentType;
const customer = {
  id: "customer",
  business_unit_id: "unit",
  full_name: "TEST ONLY Customer",
  email: "test@example.test",
  phone: null,
  updated_at: "2026-10-21T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  queries.length = 0;
  rpc.mockResolvedValue({ data: false, error: null });
  from.mockImplementation((table) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(function (this: unknown, field, value) {
      queries.push({ table, field, value });
      return this;
    }),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: customer, error: null }),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  }));
});
afterEach(cleanup);
it("distinguishes empty customer history and scopes every related query", async () => {
  render(<Detail />);
  await screen.findByText("No bookings for this customer.");
  expect(screen.getByText("No quotes for this customer.")).toBeInTheDocument();
  expect(screen.getByText("No leads for this customer.")).toBeInTheDocument();
  for (const table of ["leads", "ride_requests", "quotes", "bookings", "activities"])
    expect(queries).toContainEqual({ table, field: "business_unit_id", value: "unit" });
});
it("links real quote and booking history and displays actual statuses", async () => {
  from.mockImplementation((table) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: customer, error: null }),
    range: vi.fn().mockResolvedValue({
      error: null,
      data:
        table === "quotes"
          ? [{ id: "quote-id", currency: "USD", amount: 125.5, status: "DRAFT" }]
          : table === "bookings"
            ? [
                {
                  id: "booking-id",
                  booking_number: "TEST-BOOKING",
                  travel_date: "2026-11-06",
                  status: "PENDING",
                },
              ]
            : [],
    }),
  }));
  render(<Detail />);
  expect(await screen.findByRole("link", { name: "TEST-BOOKING" })).toHaveAttribute(
    "href",
    "/admin/booking/booking-id",
  );
  expect(screen.getByRole("link", { name: "Quote quote-id" })).toHaveAttribute(
    "href",
    "/admin/quote/quote-id",
  );
  expect(screen.getByText("PENDING")).toBeInTheDocument();
  expect(screen.getByText("DRAFT")).toBeInTheDocument();
});
it("shows history query failure instead of misleading empty history", async () => {
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: customer, error: null }),
    range: vi.fn().mockResolvedValue({ data: null, error: { message: "private detail" } }),
  }));
  render(<Detail />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load customer history");
  expect(screen.queryByText("No bookings for this customer.")).toBeNull();
  expect(screen.queryByText("private detail")).toBeNull();
});
it("shows an unavailable customer without exposing editing controls", async () => {
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }));
  render(<Detail />);
  await screen.findByText("Customer not found or unavailable.");
  expect(screen.queryByRole("button", { name: "Save contact details" })).toBeNull();
});

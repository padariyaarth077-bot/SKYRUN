import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Reports } from "@/components/reports";
import { FinanceDocument } from "@/components/finance-documents";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
vi.mock("@/lib/operations-hooks", () => ({ useOperationsPermission: () => "allowed" }));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({
    children,
    title,
    actions,
  }: {
    children: ReactNode;
    title: string;
    actions: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
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
}));
const bookingId = "11111111-1111-4111-8111-111111111111",
  draftId = "22222222-2222-4222-8222-222222222222";
let tables: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  tables = {
    bookings: {
      id: bookingId,
      business_unit_id: "unit",
      customer_id: "customer",
      booking_number: "B-TEST",
      currency: "USD",
      final_amount: 100,
      status: "PENDING",
    },
    invoice_drafts: {
      id: draftId,
      booking_id: bookingId,
      business_unit_id: "unit",
      customer_id: "customer",
      amount: 100,
      currency: "USD",
      description: "Stored booking amount",
      customer_snapshot: { name: "Stored customer" },
      business_snapshot: { legal_name: "Approved business" },
      updated_at: "2026-10-21T12:00:00Z",
    },
    customers: { id: "customer", full_name: "Current customer", email: "contact@example.test" },
    document_profiles: { legal_name: "Current business" },
    booking_deposit_receipts: {
      id: draftId,
      booking_id: bookingId,
      business_unit_id: "unit",
      currency: "USD",
      amount: 30,
      verified_at: "2026-10-21T11:00:00Z",
      verified_by: "actor",
      received_at: "2026-10-20T11:00:00Z",
    },
  };
  from.mockImplementation((table) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockImplementation(() => Promise.resolve({ data: tables[table] ?? null, error: null })),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [], error: null }),
  }));
  rpc.mockImplementation((name) =>
    Promise.resolve(
      name === "can_manage_booking"
        ? { data: true, error: null }
        : { data: { rows: [], total: 0 }, error: null },
    ),
  );
});
afterEach(cleanup);
it("distinguishes missing report infrastructure from empty data and hides database messages", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private SQL" } });
  render(<Reports />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load report");
  expect(screen.queryByText(/No matching records/)).toBeNull();
  expect(screen.queryByText("private SQL")).toBeNull();
});
it("passes filters to the real report contract and links existing entities", async () => {
  rpc.mockResolvedValue({
    data: {
      rows: [
        {
          id: bookingId,
          reference: "SR-TEST",
          customer: "Name",
          entity_type: "lead",
          date: "2026-10-21",
          status: "NEW",
        },
      ],
      total: 1,
    },
    error: null,
  });
  render(<Reports />);
  expect(await screen.findByRole("link", { name: "SR-TEST" })).toHaveAttribute(
    "href",
    "/admin/leads/" + bookingId,
  );
  fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Name" } });
  await waitFor(() =>
    expect(rpc).toHaveBeenLastCalledWith(
      "phase7_report",
      expect.objectContaining({ _search: "Name", _offset: 0 }),
    ),
  );
});
it("renders snapshot-based invoice draft and never invents a number or claims payment", async () => {
  render(<FinanceDocument kind="invoice" id={draftId} />);
  expect(await screen.findByText("DRAFT — NOT ISSUED")).toBeInTheDocument();
  expect(screen.getByText("Stored customer")).toBeInTheDocument();
  expect(screen.getByText("Approved business")).toBeInTheDocument();
  expect(screen.getByText(/no assertion of payment/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Issue invoice/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Booking B-TEST" })).toHaveAttribute(
    "href",
    "/admin/booking/" + bookingId,
  );
});
it("preserves a failed draft edit and reuses its operation ID on retry", async () => {
  rpc.mockImplementation((name) =>
    Promise.resolve(
      name === "can_manage_booking"
        ? { data: true, error: null }
        : { data: null, error: { message: "private SQL" } },
    ),
  );
  render(<FinanceDocument kind="invoice" id={draftId} />);
  const input = await screen.findByLabelText("Draft description");
  fireEvent.change(input, { target: { value: "Keep my edits" } });
  fireEvent.click(screen.getByRole("button", { name: "Save invoice draft" }));
  await screen.findByText(/Could not confirm save/);
  expect(input).toHaveValue("Keep my edits");
  const first = rpc.mock.calls.find((call) => call[0] === "phase7_save")![1];
  fireEvent.click(screen.getByRole("button", { name: "Save invoice draft" }));
  await waitFor(() =>
    expect(rpc.mock.calls.filter((call) => call[0] === "phase7_save")).toHaveLength(2),
  );
  expect(rpc.mock.calls.filter((call) => call[0] === "phase7_save")[1]![1]._operation_id).toBe(
    first._operation_id,
  );
});
it("allows a preview only for eligible evidence and disables printing when verification is missing", async () => {
  tables["booking_deposit_receipts"] = {
    ...(tables["booking_deposit_receipts"] as object),
    verified_at: null,
    verified_by: null,
  };
  render(<FinanceDocument kind="receipt" id={draftId} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("unverified, reversed, mismatched");
  expect(screen.getByRole("button", { name: "Print / Save PDF preview" })).toBeDisabled();
  expect(screen.queryByText("PAYMENT PREVIEW — NOT AN ISSUED RECEIPT")).toBeNull();
});
it("shows eligible partial payment as a preview, without an official receipt reference", async () => {
  render(<FinanceDocument kind="receipt" id={draftId} />);
  expect(await screen.findByText("PAYMENT PREVIEW — NOT AN ISSUED RECEIPT")).toBeInTheDocument();
  expect(screen.getByText("30.00")).toBeInTheDocument();
  expect(screen.getByText(/not an official document number/)).toBeInTheDocument();
});

it("rechecks evidence at print time and never prints a newly ineligible payment", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<FinanceDocument kind="receipt" id={draftId} />);
  await screen.findByText("PAYMENT PREVIEW — NOT AN ISSUED RECEIPT");
  tables["booking_deposit_receipts"] = {
    ...(tables["booking_deposit_receipts"] as object),
    verified_at: null,
    verified_by: null,
  };
  fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF preview" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Payment eligibility changed");
  expect(print).not.toHaveBeenCalled();
  print.mockRestore();
});

it("does not expose or print a payment preview when management permission is denied", async () => {
  rpc.mockImplementation(() => Promise.resolve({ data: false, error: null }));
  render(<FinanceDocument kind="receipt" id={draftId} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Document unavailable");
  expect(screen.queryByText("30.00")).toBeNull();
  expect(screen.getByRole("button", { name: "Print / Save PDF preview" })).toBeDisabled();
});

it("blocks an open payment preview after a receipt reversal", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  try {
    render(<FinanceDocument kind="receipt" id={draftId} />);
    await screen.findByText("PAYMENT PREVIEW — NOT AN ISSUED RECEIPT");
    tables["booking_deposit_reversals"] = [{ id: "reversal" }];
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Payment eligibility changed");
    expect(print).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Print / Save PDF preview" })).toBeDisabled();
  } finally {
    print.mockRestore();
  }
});

it("fails closed when print-time verification cannot reach the database", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  try {
    render(<FinanceDocument kind="receipt" id={draftId} />);
    await screen.findByText("PAYMENT PREVIEW — NOT AN ISSUED RECEIPT");
    from.mockImplementation(() => {
      throw new Error("private connection details");
    });
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not recheck payment eligibility",
    );
    expect(screen.queryByText("private connection details")).toBeNull();
    expect(print).not.toHaveBeenCalled();
  } finally {
    print.mockRestore();
  }
});

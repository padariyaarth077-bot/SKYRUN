import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BookingDeposits } from "@/components/booking-deposits";
import { depositAmount, depositTotals, type Receipt, type Reversal } from "@/lib/booking-deposits";
import type { Database } from "@/integrations/supabase/types";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
const booking = {
  id: "11111111-1111-4111-8111-111111111111",
  business_unit_id: "unit",
  status: "PENDING",
  currency: "USD",
  required_deposit_amount: null,
  updated_at: "2026-10-18T12:00:00Z",
} as Booking;
const receipt = {
  id: "receipt",
  amount: 0.1,
  currency: "USD",
  verified_at: "2026-10-18T12:00:00Z",
  external_reference: "ref",
} as Receipt;
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockImplementation((name) =>
    Promise.resolve({ data: name === "can_manage_booking" ? true : booking.id, error: null }),
  );
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  }));
});
afterEach(cleanup);
it.each(["-1", "1.001", "NaN", "1e2", "", "100000000"])(
  "rejects malformed exact amount %s",
  (value) => {
    expect(depositAmount.safeParse(value).success).toBe(false);
  },
);
it("uses integer cents and excludes unverified, reversed and wrong-currency evidence", () => {
  const records = [
    receipt,
    { ...receipt, id: "two", amount: 0.2 },
    { ...receipt, id: "unverified", amount: 99, verified_at: null },
    { ...receipt, id: "wrong", amount: 99, currency: "EUR" },
    { ...receipt, id: "reversed", amount: 99 },
  ];
  expect(depositTotals(0.3, "USD", records, [{ receipt_id: "reversed" } as Reversal])).toEqual({
    eligible: 0.3,
    shortfall: 0,
  });
  expect(depositTotals(null, "USD", [], [])).toEqual({ eligible: 0, shortfall: null });
});
it("blocks confirmation with missing requirement and shows explicit empty state", async () => {
  render(<BookingDeposits booking={booking} onSaved={vi.fn()} />);
  await screen.findByText("No deposit receipts recorded.");
  fireEvent.change(screen.getByLabelText("Booking action"), { target: { value: "confirm" } });
  expect(screen.getByText("Record an explicit deposit requirement first.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save booking action" })).toBeDisabled();
});
it("fails closed on loading/permission errors with a retry", async () => {
  rpc.mockResolvedValue({ error: { message: "private database detail" } });
  render(<BookingDeposits booking={booking} onSaved={vi.fn()} />);
  await screen.findByRole("alert");
  expect(screen.queryByText("private database detail")).toBeNull();
  expect(screen.queryByLabelText("Booking action")).toBeNull();
  rpc.mockResolvedValue({ data: false, error: null });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText(/Read-only/);
});
it("preserves failure input and operation ID across retry; clears only after confirmed success", async () => {
  const saved = vi.fn();
  render(<BookingDeposits booking={booking} onSaved={saved} />);
  const amount = await screen.findByLabelText("Deposit amount");
  fireEvent.change(amount, { target: { value: "0" } });
  rpc.mockResolvedValueOnce({ data: null, error: { message: "internal failure" } });
  fireEvent.click(screen.getByRole("button", { name: "Save booking action" }));
  await screen.findByText(/Your entries are preserved/);
  expect(amount).toHaveValue("0");
  expect(saved).not.toHaveBeenCalled();
  const first = rpc.mock.calls.find(([name]) => name === "phase4_booking_action")![1];
  fireEvent.click(screen.getByRole("button", { name: "Save booking action" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  const calls = rpc.mock.calls.filter(([name]) => name === "phase4_booking_action");
  expect(calls[1]![1]._operation_id).toBe(first._operation_id);
  expect(amount).toHaveValue("");
});
it("prevents duplicate pending mutations", async () => {
  render(<BookingDeposits booking={booking} onSaved={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText("Deposit amount"), { target: { value: "25" } });
  rpc.mockImplementation(() => new Promise(() => {}));
  const submit = screen.getByRole("button", { name: "Save booking action" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(rpc.mock.calls.filter(([name]) => name === "phase4_booking_action")).toHaveLength(1);
  expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
});
it("requires cancellation reason and completion attestation", async () => {
  render(
    <BookingDeposits
      booking={{ ...booking, status: "CONFIRMED", required_deposit_amount: 0 }}
      onSaved={vi.fn()}
    />,
  );
  await screen.findByLabelText("Booking action");
  fireEvent.change(screen.getByLabelText("Booking action"), { target: { value: "complete" } });
  expect(screen.getByRole("button", { name: "Save booking action" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Save booking action" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Booking action"), { target: { value: "cancel" } });
  expect(screen.getByLabelText("Reason")).toBeRequired();
});
it("does not offer lifecycle actions on terminal bookings", async () => {
  render(<BookingDeposits booking={{ ...booking, status: "COMPLETED" }} onSaved={vi.fn()} />);
  await screen.findByText(/no Phase 4 lifecycle transitions/);
  expect(screen.queryByLabelText("Booking action")).toBeNull();
});
it("shows a post-confirmation reversal as a visible exception without changing status", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  from.mockImplementation((table) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data:
        table === "booking_deposit_receipts"
          ? [receipt]
          : [
              {
                id: "rev",
                receipt_id: receipt.id,
                reason: "External reversal",
                actor_id: "staff",
                created_at: "2026-10-19T12:00:00Z",
              },
            ],
      error: null,
    }),
  }));
  render(
    <BookingDeposits
      booking={{
        ...booking,
        status: "CONFIRMED",
        confirmed_at: "2026-10-18T12:00:00Z",
        required_deposit_amount: 30,
      }}
      onSaved={vi.fn()}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Payment exception");
  expect(screen.getByText(/Status is preserved/)).toBeInTheDocument();
  expect(screen.getByText(/Eligible verified total: USD 0.00/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Booking action")).toBeNull();
});
it("blocks confirmation when the configured deposit is insufficient", async () => {
  render(
    <BookingDeposits booking={{ ...booking, required_deposit_amount: 30 }} onSaved={vi.fn()} />,
  );
  fireEvent.change(await screen.findByLabelText("Booking action"), {
    target: { value: "confirm" },
  });
  expect(screen.getByText("Verified, unreversed deposits are insufficient.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save booking action" })).toBeDisabled();
});

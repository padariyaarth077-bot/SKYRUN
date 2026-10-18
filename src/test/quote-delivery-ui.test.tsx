import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
const { status, send, session } = vi.hoisted(() => ({
  status: vi.fn(),
  send: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/lib/quote-delivery.functions", () => ({
  getQuoteDeliveryStatus: status,
  sendQuoteEmail: send,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: session,
    },
  },
}));
import { QuoteDelivery } from "@/components/quote-delivery";
const props = {
  quoteId: "ee2471c9-44b0-4f38-9b58-0fd84686e867",
  updatedAt: "2026-10-18T12:00:00Z",
  rideUpdatedAt: "2026-10-18T12:00:00Z",
  recipient: "padariyaarth077@gmail.com",
  eligible: true,
  unsavedChanges: false,
  onFrozenChange: vi.fn(),
};
const initial = {
  ok: true,
  deliveryId: null,
  state: "NOT_PREPARED",
  frozen: false,
  recipient: null,
  enabled: true,
  isTest: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  session.mockResolvedValue({
    data: { session: { access_token: "invalid-session-fixture" } },
    error: null,
  });
  status.mockResolvedValue(initial);
  send.mockResolvedValue({ ok: true, state: "PROVIDER_ACCEPTED" });
});
it("never sends on page load and requires explicit staff approval", async () => {
  render(<QuoteDelivery {...props} />);
  const button = await screen.findByRole("button", { name: "Send Quote" });
  expect(button).toBeDisabled();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ reviewedRecipient: props.recipient, quoteId: props.quoteId }),
    }),
  );
});
it("does not offer sending when configuration is disabled", async () => {
  status.mockResolvedValue({ ...initial, enabled: false });
  render(<QuoteDelivery {...props} />);
  await screen.findByText(/Email sending is disabled/);
  expect(screen.queryByRole("button", { name: "Send Quote" })).not.toBeInTheDocument();
});
it("does not offer a retry after the safe delivery window has elapsed", async () => {
  status.mockResolvedValue({ ...initial, state: "UNCERTAIN", retryAllowed: false });
  render(<QuoteDelivery {...props} />);
  await screen.findByText(/Automatic retry is disabled/);
  expect(screen.queryByRole("button", { name: "Retry same delivery" })).not.toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
});
it("requires draft changes to be saved before sending", async () => {
  render(<QuoteDelivery {...props} unsavedChanges />);
  await screen.findByText(/Save your draft changes/);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Send Quote" })).toBeDisabled();
  expect(send).not.toHaveBeenCalled();
});
it("retains staff review and a stable ID on ambiguous failure and retry", async () => {
  send.mockResolvedValue({ ok: false, message: "Outcome uncertain" });
  render(<QuoteDelivery {...props} />);
  await screen.findByRole("button", { name: "Send Quote" });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send Quote" }));
  await screen.findByRole("alert");
  const first = send.mock.calls[0]?.[0].data.deliveryId;
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Send Quote" }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls[1]?.[0].data.deliveryId).toBe(first);
});
it("guards duplicate clicks during a pending send", async () => {
  let finish!: (result: unknown) => void;
  send.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<QuoteDelivery {...props} />);
  await screen.findByRole("button", { name: "Send Quote" });
  fireEvent.click(screen.getByRole("checkbox"));
  const button = screen.getByRole("button", { name: "Send Quote" });
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByRole("button", { name: "Requesting delivery…" });
  expect(send).toHaveBeenCalledTimes(1);
  finish({ ok: true, state: "PROVIDER_ACCEPTED" });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Requesting delivery…" })).not.toBeInTheDocument(),
  );
});
it("separates provider acceptance from verified delivery and freezes edits", async () => {
  status.mockResolvedValue({
    ...initial,
    state: "PROVIDER_ACCEPTED",
    frozen: true,
    deliveryId: props.quoteId,
  });
  render(<QuoteDelivery {...props} />);
  await screen.findByText(/Delivery is not yet verified/);
  expect(props.onFrozenChange).toHaveBeenCalledWith(true);
  expect(screen.queryByRole("button", { name: "Send Quote" })).not.toBeInTheDocument();
});

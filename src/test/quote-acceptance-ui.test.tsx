import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/quote-acceptance.functions", () => ({ customerQuoteAcceptance: submit }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
import { QuoteAcceptancePage } from "@/routes/quote.accept";
const token = "ab".repeat(32);
const quote = {
  quoteId: "ee2471c9-44b0-4f38-9b58-0fd84686e867",
  amount: "125.50",
  currency: "USD",
  pickup: "Airport",
  dropoff: "Hotel",
  travelDate: "2099-01-01",
  pickupTime: "14:30:00",
  passengers: 2,
  tripType: "ONE_WAY",
  returnDate: null,
  returnTime: null,
  hourlyDuration: null,
  flightNumber: null,
  expiresAt: "2099-01-01T00:00:00Z",
  accepted: false,
  bookingReference: null,
  bookingStatus: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", `/quote/accept#token=${token}`);
  submit.mockResolvedValue({ ok: true, quote });
});
it("removes the token from browser history, previews without accepting and requires explicit confirmation", async () => {
  render(<QuoteAcceptancePage />);
  await screen.findByText("USD 125.50");
  expect(window.location.hash).toBe("");
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledWith({ data: { token, accept: false } });
  expect(screen.getByRole("button", { name: "Accept quote" })).toBeDisabled();
});
it("blocks malformed links without calling the server", async () => {
  window.history.replaceState({}, "", "/quote/accept#token=guessable");
  render(<QuoteAcceptancePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable or expired");
  expect(submit).not.toHaveBeenCalled();
});
it("shows the saved booking status on revisits instead of assuming it remains pending", async () => {
  submit.mockResolvedValueOnce({
    ok: true,
    quote: {
      ...quote,
      accepted: true,
      bookingReference: "BK-local-test",
      bookingStatus: "CANCELLED",
    },
  });
  render(<QuoteAcceptancePage />);
  await screen.findByText("Booking status: CANCELLED.", { exact: false });
  expect(screen.queryByText(/pending operational confirmation/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept quote" })).not.toBeInTheDocument();
});
it("shows honest failure without a success state and retries the same capability", async () => {
  render(<QuoteAcceptancePage />);
  await screen.findByText("USD 125.50");
  fireEvent.click(screen.getByRole("checkbox"));
  submit.mockRejectedValueOnce(new Error("network"));
  fireEvent.click(screen.getByRole("button", { name: "Accept quote" }));
  await screen.findByRole("button", { name: "Retry acceptance" });
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.queryByText(/Quote accepted\./)).not.toBeInTheDocument();
  submit.mockResolvedValueOnce({
    ok: true,
    quote: {
      ...quote,
      accepted: true,
      bookingReference: "BK-local-test",
      bookingStatus: "PENDING",
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry acceptance" }));
  await screen.findByText(/Booking reference: BK-local-test/);
  expect(screen.getByText(/pending operational confirmation/)).toBeInTheDocument();
  expect(submit).toHaveBeenLastCalledWith({ data: { token, accept: true } });
});
it("prevents duplicate pending acceptance and GET/load never accepts", async () => {
  render(<QuoteAcceptancePage />);
  await screen.findByText("USD 125.50");
  let finish!: (result: unknown) => void;
  submit.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.click(screen.getByRole("checkbox"));
  const button = screen.getByRole("button", { name: "Accept quote" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(submit).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Recording acceptance…" })).toBeDisabled();
  finish({
    ok: true,
    quote: {
      ...quote,
      accepted: true,
      bookingReference: "BK-local-test",
      bookingStatus: "PENDING",
    },
  });
  await waitFor(() => expect(screen.getByText(/Booking reference/)).toBeInTheDocument());
});
it("distinguishes unavailable quote from empty loading and provides a safe recheck", async () => {
  submit.mockResolvedValueOnce({ ok: false, message: "Quote unavailable" });
  render(<QuoteAcceptancePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Quote unavailable");
  expect(screen.queryByRole("button", { name: "Accept quote" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check quote again" }));
  await screen.findByText("USD 125.50");
});

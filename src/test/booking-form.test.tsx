import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BookingForm } from "@/components/skyrun-site";

const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/leads.functions", () => ({ submitRideEnquiry: submit }));
vi.mock("@/components/chat-widget", () => ({ ChatWidget: () => null }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function fill() {
  const view = render(<BookingForm />);
  const fields = {
    name: "Ava",
    email: "ava@example.com",
    phone: "12345",
    service: "Airport transfer",
    pickup: "Airport",
    dropoff: "Hotel",
    date: "2026-11-06",
    time: "14:30",
    passengers: "2",
  };
  for (const [name, value] of Object.entries(fields)) {
    fireEvent.change(view.container.querySelector(`[name="${name}"]`)!, { target: { value } });
  }
  return view.container.querySelector("form")!;
}

it("preserves values and key after failure, prevents concurrent calls, and resets only after confirmation", async () => {
  let fail!: (error: Error) => void;
  submit.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const form = fill();
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(submit).toHaveBeenCalledTimes(1);
  const first = submit.mock.calls[0]?.[0].data;
  expect(first).toMatchObject({
    pickupLocation: "Airport",
    dropoffLocation: "Hotel",
    passengerCount: 2,
  });
  fail(new Error("private database detail"));
  await screen.findByText(/Something went wrong/);
  expect(screen.queryByText(/private database/)).toBeNull();
  expect(screen.getByLabelText("Full name")).toHaveValue("Ava");
  submit.mockResolvedValue({ ok: true, reference: "SR-TEST" });
  fireEvent.submit(form);
  await screen.findByText(/awaiting review/);
  expect(submit.mock.calls[1]?.[0].data.submissionKey).toBe(first.submissionKey);
  expect(screen.getByLabelText("Full name")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ava" } });
  // Other cleared fields prevent a new request until the new enquiry is complete.
  fireEvent.submit(form);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  for (const [name, value] of Object.entries({
    email: "ava@example.com",
    phone: "12345",
    service: "Airport transfer",
    pickup: "Airport",
    dropoff: "Hotel",
    date: "2026-11-06",
    time: "14:30",
    passengers: "2",
  })) {
    fireEvent.change(form.querySelector(`[name="${name}"]`)!, { target: { value } });
  }
  fireEvent.submit(form);
  await screen.findByText(/awaiting review/);
  expect(submit.mock.calls[2]?.[0].data.submissionKey).not.toBe(first.submissionKey);
});

it("retains values when the server returns no confirmation reference", async () => {
  submit.mockResolvedValue({ ok: true, reference: "" });
  fireEvent.submit(fill());
  await screen.findByText(/Something went wrong/);
  expect(screen.getByLabelText("Full name")).toHaveValue("Ava");
});

it("starts a new logical enquiry with a new key after an explicit reset", async () => {
  submit.mockRejectedValue(new Error("Network failure"));
  const form = fill();
  fireEvent.submit(form);
  await screen.findByText(/Something went wrong/);
  const firstKey = submit.mock.calls[0]?.[0].data.submissionKey;
  fireEvent.click(screen.getByRole("button", { name: "Start a new enquiry" }));
  expect(screen.getByLabelText("Full name")).toHaveValue("");
  const fields = {
    name: "Ava",
    email: "ava@example.com",
    phone: "12345",
    service: "Airport transfer",
    pickup: "Airport",
    dropoff: "Hotel",
    date: "2026-11-06",
    time: "14:30",
    passengers: "2",
  };
  for (const [name, value] of Object.entries(fields)) {
    fireEvent.change(form.querySelector(`[name="${name}"]`)!, { target: { value } });
  }
  fireEvent.submit(form);
  await screen.findByText(/Something went wrong/);
  expect(submit.mock.calls[1]?.[0].data.submissionKey).not.toBe(firstKey);
});

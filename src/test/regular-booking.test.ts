import { expect, it } from "vitest";
import { regularCode, regularRideSchema, regularReviewSchema } from "@/lib/regular-booking.shared";
import { regularConfirmationTemplate } from "@/lib/regular-confirmation";
const trip = {
  submissionKey: "11111111-1111-4111-8111-111111111111",
  name: "Test",
  email: "test@example.test",
  phone: "12345678",
  service: "Airport transfer",
  pickupLocation: "ORD",
  dropoffLocation: "Chicago",
  travelDate: "2099-11-06",
  pickupTime: "14:30",
  passengerCount: 2,
  categoryCode: "regular-sedan",
  luggageDetails: "Two bags",
};
it("rejects special classifications, client fare authority and booking-mode spoofing", () => {
  expect(regularCode("Rolls-Royce Ghost")).toBeUndefined();
  expect(regularCode("Regular Sedan")).toBe("regular-sedan");
  expect(regularRideSchema.parse(trip).categoryCode).toBe("regular-sedan");
  for (const patch of [
    { categoryCode: "Rolls-Royce Ghost" },
    { amount: 1 },
    { booking_mode: "regular" },
    { business_unit_id: "other" },
    { luggageDetails: "" },
    { travelDate: "2099-02-30" },
  ])
    expect(regularRideSchema.safeParse({ ...trip, ...patch }).success).toBe(false);
});
it("requires explicit availability attestation and review evidence", () => {
  const review = {
    action: "approve",
    amount: "125.50",
    basis: "Reviewed entire itinerary",
    availability: "Supplier and category checked",
    attested: true,
  };
  expect(regularReviewSchema.safeParse(review).success).toBe(true);
  for (const patch of [
    { attested: false },
    { availability: "" },
    { amount: "1.001" },
    { currency: "EUR" },
  ])
    expect(regularReviewSchema.safeParse({ ...review, ...patch }).success).toBe(false);
});
it("prepares escaped confirmed ride details while keeping payment separate", () => {
  const row = {
    id: trip.submissionKey,
    kind: "REGULAR_BOOKING_CONFIRMED",
    recipient: trip.email,
    payload: {
      reference: "RB-TEST",
      name: "<script>bad</script>",
      status: "CONFIRMED",
      travelDate: trip.travelDate,
      pickupTime: "14:30:00",
      pickup: "ORD",
      dropoff: "Chicago",
      category: "Regular Sedan",
      amount: 125.5,
      currency: "USD",
      paymentStatus: "NOT_REQUESTED",
      timeZone: "America/Chicago",
    },
  };
  const email = regularConfirmationTemplate(row);
  expect(email.html).toContain("&lt;script&gt;");
  expect(email.html).not.toContain("<script>");
  expect(email.text).toContain("Your ride is confirmed");
  expect(email.text).toContain("USD 125.50");
  expect(email.text).toContain("not a payment receipt");
  expect(email.text).not.toMatch(/https:\/\/.*square/i);
  expect(() =>
    regularConfirmationTemplate({ ...row, payload: { ...row.payload, status: "PENDING" } }),
  ).toThrow();
  expect(() =>
    regularConfirmationTemplate({ ...row, payload: { ...row.payload, paymentStatus: "RECEIVED" } }),
  ).toThrow();
});

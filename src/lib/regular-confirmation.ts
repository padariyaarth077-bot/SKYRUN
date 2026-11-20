import { emailBrandingHtml } from "@/lib/branding";
import { z } from "zod";

const confirmation = z.object({
  id: z.string().uuid(),
  kind: z.literal("REGULAR_BOOKING_CONFIRMED"),
  recipient: z.string().email().max(254),
  payload: z.object({
    reference: z.string().min(1).max(200),
    name: z.string().max(200),
    status: z.literal("CONFIRMED"),
    travelDate: z.string().date(),
    pickupTime: z.string().min(1).max(30),
    pickup: z.string().min(1).max(300),
    dropoff: z.string().min(1).max(300),
    category: z.string().min(1).max(120),
    amount: z.number().positive().max(99999999.99),
    currency: z.literal("USD"),
    paymentStatus: z.literal("NOT_REQUESTED"),
    timeZone: z.literal("America/Chicago"),
  }),
});
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

// Pure preparation only. HELD outbox records have no authorized delivery path in this phase.
export function regularConfirmationTemplate(input: unknown, verifiedLogoUrl?: string) {
  const row = confirmation.parse(input),
    p = row.payload;
  const lines = [
    `Hello ${p.name},`,
    `Your ride is confirmed. Booking reference: ${p.reference}`,
    `Vehicle category: ${p.category}. Your booking is for a category; a specific model is not guaranteed.`,
    `Pickup: ${p.pickup}`,
    `Drop-off: ${p.dropoff}`,
    `Ride date: ${p.travelDate} · Pickup time: ${p.pickupTime} (America/Chicago)`,
    `Approved amount: ${p.currency} ${p.amount.toFixed(2)}`,
    "Payment has not been requested through this booking workflow. This confirmation is not a payment receipt.",
    "Questions or changes? Call 224-619-2024 or 779-240-6371, or email skyrunlimo2428@gmail.com.",
  ];
  return {
    id: row.id,
    to: row.recipient,
    subject: "Skyrun Limo — your ride is confirmed",
    text: ["SKYRUN LIMO", ...lines].join("\n\n"),
    html: `<!doctype html><html><body style="background:#edf3f9;font-family:Arial,sans-serif;color:#112139"><main style="max-width:600px;margin:24px auto;background:white;padding:32px;border-top:5px solid #1264cc">${emailBrandingHtml(verifiedLogoUrl)}<h2>Your ride is confirmed</h2>${lines.map((line) => `<p style="line-height:1.7;overflow-wrap:anywhere">${escape(line)}</p>`).join("")}</main></body></html>`,
  };
}

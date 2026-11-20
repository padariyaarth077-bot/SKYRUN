import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
const img = "/vehicle-images/cadillac-escalade-esv-preview.jpg";
import { fleetSelection } from "@/lib/public-fleet";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { vehicle?: string } => {
    const selection = fleetSelection(search["vehicle"]);
    return selection ? { vehicle: selection.vehicle } : {};
  },
  head: () => ({
    meta: [
      { title: "Book a Ride \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content: "Send a ride request to Skyrun Limo. Bookings are confirmed when Skyrun replies.",
      },
      { property: "og:title", content: "Book a Ride \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content: "Send a ride request to Skyrun Limo. Bookings are confirmed when Skyrun replies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { vehicle } = Route.useSearch();
  const selection = fleetSelection(vehicle);
  return (
    <InnerPage
      eyebrow={
        selection?.special ? "Special Fleet · Request availability" : "Regular Fleet · Ride enquiry"
      }
      title={selection ? `Request ${selection.vehicle}.` : "Plan your Chicago ride."}
      intro={
        selection?.special
          ? "Send a request for this specific vehicle. Our team will confirm availability, prepare a custom quote and approve the arrangement before a booking is confirmed."
          : selection
            ? "Submit your Regular ride for admin review. Your amount and category availability need approval; no payment is requested during booking."
            : "Send your route and travel details for a quote. Your ride is confirmed when Skyrun replies."
      }
      initialVehicle={vehicle ?? ""}
      image={img}
      blocks={[]}
      showForm
    />
  );
}

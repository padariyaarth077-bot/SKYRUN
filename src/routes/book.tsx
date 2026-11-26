import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
const img = "/vehicle-images/cadillac-escalade-esv-preview.jpg";
import { fleetSelection } from "@/lib/public-fleet";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { vehicle?: string } => {
    const selection = fleetSelection(search["vehicle"]);
    return selection ? { vehicle: selection.vehicle } : {};
  },
  head: () =>
    publicSeo(
      "/book",
      "Request a Chicago Chauffeur Ride | Skyrun Limo",
      "Send Skyrun your pickup, destination and travel details. The team reviews availability and confirms arrangements directly; submitting a request does not confirm a ride.",
    ),

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

import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
const img = "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg";

export const Route = createFileRoute("/corporate-transportation")({
  head: () =>
    publicSeo(
      "/corporate-transportation",
      "Corporate Transportation in Chicago | Skyrun Limo",
      "Request executive chauffeur transportation for business travel, meetings and corporate events in Chicago. Share your itinerary and timing for the team to review.",
    ),

  component: CorporateTransportationPage,
});

function CorporateTransportationPage() {
  return (
    <InnerPage
      eyebrow="Corporate"
      title="Business travel,"
      accent="without the distraction."
      intro="Executive car service for business travel, meetings and corporate events in Chicago."
      image={img}
    >
      <JourneyContent page="corporate" />
    </InnerPage>
  );
}

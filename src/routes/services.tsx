import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
const img = "/vehicle-images/cadillac-escalade-esv-preview.jpg";

export const Route = createFileRoute("/services")({
  head: () =>
    publicSeo(
      "/services",
      "Chauffeur Services in Chicago | Skyrun Limo",
      "Explore O’Hare and Midway airport transfers, corporate transportation, hourly chauffeur service and occasion rides in Chicago and surrounding suburbs.",
    ),

  component: ServicesPage,
});

function ServicesPage() {
  return (
    <InnerPage
      eyebrow="Our services"
      title="Private transportation,"
      accent="for every itinerary."
      intro="Airport transfers, corporate travel, hourly and point-to-point chauffeur service in Chicago."
      image={img}
    >
      <JourneyContent page="services" />
    </InnerPage>
  );
}

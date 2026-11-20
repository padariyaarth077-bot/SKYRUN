import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
const img = "/vehicle-images/cadillac-escalade-esv-preview.jpg";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Airport transfers, corporate travel, hourly and point-to-point chauffeur service in Chicago.",
      },
      { property: "og:title", content: "Services \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Airport transfers, corporate travel, hourly and point-to-point chauffeur service in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

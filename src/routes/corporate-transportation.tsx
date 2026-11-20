import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
const img = "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg";

export const Route = createFileRoute("/corporate-transportation")({
  head: () => ({
    meta: [
      { title: "Corporate Transportation \u2014 Skyrun Limo" },
      {
        name: "description",
        content:
          "Executive car service for business travel, meetings and corporate events in Chicago.",
      },
      { property: "og:title", content: "Corporate Transportation \u2014 Skyrun Limo" },
      {
        property: "og:description",
        content:
          "Executive car service for business travel, meetings and corporate events in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

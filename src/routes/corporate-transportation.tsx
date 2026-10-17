import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-executive.jpg";

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
      blocks={[
        {
          title: "For executives",
          body: "Airport runs, client pickups and meeting-to-meeting travel.",
        },
        {
          title: "For events",
          body: "Coordinated transportation for conferences and corporate gatherings.",
        },
        {
          title: "Accounts",
          body: "Ask about recurring bookings for your team \u2014 details confirmed directly with Skyrun.",
        },
      ]}
    />
  );
}

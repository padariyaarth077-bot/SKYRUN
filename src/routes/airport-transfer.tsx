import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-airport.jpg";

export const Route = createFileRoute("/airport-transfer")({
  head: () => ({
    meta: [
      { title: "Airport Transfers \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content: "Chauffeured rides to and from O'Hare, Midway and all airports from Chicago.",
      },
      { property: "og:title", content: "Airport Transfers \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content: "Chauffeured rides to and from O'Hare, Midway and all airports from Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AirportTransferPage,
});

function AirportTransferPage() {
  return (
    <InnerPage
      eyebrow="Airport transfers"
      title="Chicago to"
      accent="all airports."
      intro="Chauffeured rides to and from O'Hare, Midway and all airports from Chicago."
      image={img}
      blocks={[
        {
          title: "Airports",
          body: "Request service for:",
          items: [
            "O'Hare International (ORD)",
            "Midway International (MDW)",
            "Other regional airports on request",
          ],
        },
        {
          title: "How it works",
          body: "Share your flight details, pickup address and passenger count. Skyrun will confirm timing, pickup instructions and pricing directly.",
        },
      ]}
    />
  );
}

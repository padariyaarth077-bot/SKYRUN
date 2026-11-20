import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
const img = "/vehicle-images/cadillac-escalade-esv-preview.jpg";

export const Route = createFileRoute("/airport-transfer")({
  head: () => ({
    meta: [
      { title: "Airport Transfers \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Request a private transfer for O'Hare or Midway across Chicago and surrounding suburbs.",
      },
      { property: "og:title", content: "Airport Transfers \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Request a private transfer for O'Hare or Midway across Chicago and surrounding suburbs.",
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
      title="Your arrival,"
      accent="personally arranged."
      intro="Request a private transfer for O’Hare or Midway across Chicago and surrounding suburbs. Discuss other airport routes with our team."
      image={img}
    >
      <JourneyContent page="airport" />
    </InnerPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
const img = "/vehicle-images/cadillac-escalade-esv-preview.jpg";

export const Route = createFileRoute("/airport-transfer")({
  head: () =>
    publicSeo(
      "/airport-transfer",
      "O’Hare & Midway Airport Car Service | Skyrun Limo",
      "Request a private chauffeur transfer to or from O’Hare (ORD) and Midway (MDW) in Chicago and nearby suburbs. Share your flight and pickup details so the team can confirm arrangements.",
    ),

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

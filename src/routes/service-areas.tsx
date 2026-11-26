import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/service-areas")({
  head: () =>
    publicSeo(
      "/service-areas",
      "Chicago Chauffeur Service Areas | Skyrun Limo",
      "Skyrun arranges private chauffeur transportation in Chicago and surrounding suburbs. Share your pickup and destination so the team can confirm whether your route is covered.",
    ),

  component: ServiceAreasPage,
});

function ServiceAreasPage() {
  return (
    <InnerPage
      eyebrow="Chicago, Illinois"
      title="Your journey"
      accent="starts here."
      intro="Chauffeur service across Chicago and surrounding suburbs, including airport transfer requests."
      image={img}
    >
      <JourneyContent page="areas" />
    </InnerPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/service-areas")({
  head: () => ({
    meta: [
      { title: "Service Areas \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Chauffeur service across Chicago and surrounding suburbs, including airport transfer requests.",
      },
      { property: "og:title", content: "Service Areas \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Chauffeur service across Chicago and surrounding suburbs, including airport transfer requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

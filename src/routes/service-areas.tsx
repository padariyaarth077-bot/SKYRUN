import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/service-areas")({
  head: () => ({
    meta: [
      { title: "Service Areas \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Chauffeur service across Chicago, Illinois, its suburbs, airports and destinations beyond.",
      },
      { property: "og:title", content: "Service Areas \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Chauffeur service across Chicago, Illinois, its suburbs, airports and destinations beyond.",
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
      intro="Chauffeur service across Chicago, Illinois, its suburbs, airports and destinations beyond."
      image={img}
      blocks={[
        {
          title: "Where we go",
          body: "Request rides in and around:",
          items: [
            "Downtown Chicago & the Loop",
            "O'Hare and Midway airports",
            "Chicago suburbs",
            "Destinations beyond Chicago on request",
          ],
        },
        {
          title: "Confirm your route",
          body: "Coverage for each trip is confirmed when Skyrun replies.",
        },
      ]}
    />
  );
}

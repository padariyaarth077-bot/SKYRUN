import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Skyrun Limo \u2014 Chicago Chauffeur Service" },
      {
        name: "description",
        content:
          "Meet Skyrun Limo LLC, a Chicago transportation company led by Vrund Patel and Nisharg Patel.",
      },
      { property: "og:title", content: "About Skyrun Limo \u2014 Chicago Chauffeur Service" },
      {
        property: "og:description",
        content:
          "Meet Skyrun Limo LLC, a Chicago transportation company led by Vrund Patel and Nisharg Patel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <InnerPage
      eyebrow="About"
      title="Personal service."
      accent="A Chicago point of view."
      intro="Meet Skyrun Limo LLC, a Chicago transportation company led by Vrund Patel and Nisharg Patel."
      image={img}
      blocks={[
        { title: "Our idea", body: "The ride should feel as considered as the destination." },
        {
          title: "The team",
          body: "Reach the people behind Skyrun directly:",
          items: ["Vrund Patel \u2014 224-619-2024", "Nisharg Patel \u2014 779-240-6371"],
        },
      ]}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-hero.jpg";

export const Route = createFileRoute("/special-occasions")({
  head: () => ({
    meta: [
      { title: "Special Occasions \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Chauffeured transportation for weddings, celebrations, proms and evenings out in Chicago.",
      },
      { property: "og:title", content: "Special Occasions \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Chauffeured transportation for weddings, celebrations, proms and evenings out in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpecialOccasionsPage,
});

function SpecialOccasionsPage() {
  return (
    <InnerPage
      eyebrow="Special occasions"
      title="Make the arrival"
      accent="part of the moment."
      intro="Chauffeured transportation for weddings, celebrations, proms and evenings out in Chicago."
      image={img}
      blocks={[
        { title: "Weddings", body: "Arrivals and departures for the couple and guests." },
        { title: "Celebrations", body: "Birthdays, anniversaries and milestones." },
        { title: "Nights out", body: "Dinners, concerts and shows." },
        { title: "Events", body: "Galas, proms and private gatherings." },
      ]}
    />
  );
}

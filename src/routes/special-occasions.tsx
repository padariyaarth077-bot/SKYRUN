import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
const img = "/vehicle-images/mercedes-benz-sprinter-jet-van.jpg";

export const Route = createFileRoute("/special-occasions")({
  head: () =>
    publicSeo(
      "/special-occasions",
      "Wedding & Special Event Chauffeur Service | Skyrun Limo",
      "Request chauffeured transportation for weddings, celebrations, proms and evenings out in Chicago. Share your event date, schedule and vehicle preference.",
    ),

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

import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-airport.jpg";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Airport transfers, corporate travel, hourly and point-to-point chauffeur service in Chicago.",
      },
      { property: "og:title", content: "Services \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Airport transfers, corporate travel, hourly and point-to-point chauffeur service in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <InnerPage
      eyebrow="Our services"
      title="Private transportation,"
      accent="for every itinerary."
      intro="Airport transfers, corporate travel, hourly and point-to-point chauffeur service in Chicago."
      image={img}
      blocks={[
        {
          title: "Airport transfers",
          body: "Rides to and from O'Hare, Midway and other airports.",
        },
        {
          title: "Corporate transportation",
          body: "Executive travel, meetings and corporate events.",
        },
        { title: "Hourly chauffeur", body: "Keep a chauffeur for as long as your day needs." },
        { title: "Point-to-point", body: "One way or round trip across Chicago and beyond." },
        { title: "Special occasions", body: "Weddings, celebrations and evenings out." },
        { title: "Event transportation", body: "Concerts, galas and group events." },
      ]}
    />
  );
}

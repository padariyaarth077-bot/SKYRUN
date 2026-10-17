import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-executive.jpg";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Luxury sedan, SUV and executive vehicle categories available on request in Chicago.",
      },
      { property: "og:title", content: "Fleet \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Luxury sedan, SUV and executive vehicle categories available on request in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FleetPage,
});

function FleetPage() {
  return (
    <InnerPage
      eyebrow="The fleet"
      title="Arrive in"
      accent="quiet confidence."
      intro="Luxury sedan, SUV and executive vehicle categories available on request in Chicago."
      image={img}
      blocks={[
        {
          title: "Luxury sedan",
          body: "Suited to solo travelers and airport runs. Typically up to 3 passengers.",
        },
        {
          title: "Luxury SUV",
          body: "Extra room for luggage and small groups. Typically up to 6 passengers.",
        },
        { title: "Executive van", body: "For teams and larger groups." },
        { title: "Premium limousine", body: "For occasions that call for more." },
        {
          title: "Please note",
          body: "Vehicle categories are illustrative. Exact vehicles, capacity and availability are confirmed when Skyrun replies to your request.",
        },
      ]}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
const img = "/vehicle-images/cadillac-escalade-esv-2.jpg";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Skyrun Limo \u2014 Chicago" },
      {
        name: "description",
        content: "Call or email Skyrun Limo to request a chauffeur in Chicago, Illinois.",
      },
      { property: "og:title", content: "Contact Skyrun Limo \u2014 Chicago" },
      {
        property: "og:description",
        content: "Call or email Skyrun Limo to request a chauffeur in Chicago, Illinois.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <InnerPage
      eyebrow="Contact"
      title="Let's talk"
      accent="details."
      intro="Call or email Skyrun Limo to request a chauffeur in Chicago, Illinois."
      image={img}
    >
      <JourneyContent page="contact" />
    </InnerPage>
  );
}

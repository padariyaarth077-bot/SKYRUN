import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-executive.jpg";

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
      blocks={[
        {
          title: "Phone",
          body: "Call the team directly:",
          items: ["Vrund Patel \u2014 224-619-2024", "Nisharg Patel \u2014 779-240-6371"],
        },
        { title: "Email", body: "skyrunlimo2428@gmail.com" },
        { title: "Location", body: "Chicago, Illinois" },
      ]}
    />
  );
}

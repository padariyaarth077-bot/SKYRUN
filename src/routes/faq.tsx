import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQs \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content: "Answers to common questions about booking a Skyrun Limo chauffeur in Chicago.",
      },
      { property: "og:title", content: "FAQs \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content: "Answers to common questions about booking a Skyrun Limo chauffeur in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <InnerPage
      eyebrow="FAQs"
      title="Good to"
      accent="know."
      intro="Answers to common questions about booking a Skyrun Limo chauffeur in Chicago."
      image={img}
      blocks={[]}
      showFaq
    />
  );
}

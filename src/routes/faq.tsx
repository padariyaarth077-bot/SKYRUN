import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/faq")({
  head: () =>
    publicSeo(
      "/faq",
      "Chicago Chauffeur Service FAQs | Skyrun Limo",
      "Find answers about requesting a Skyrun chauffeur, O’Hare and Midway transfers, service areas, vehicles and booking confirmation.",
    ),
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

import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
const img = "/vehicle-images/cadillac-escalade-esv-2.jpg";

export const Route = createFileRoute("/contact")({
  head: () =>
    publicSeo(
      "/contact",
      "Contact Skyrun Limo | Chicago Chauffeur Service",
      "Call or email Skyrun Limo to discuss private chauffeur transportation in Chicago and surrounding suburbs. For a ride request, use the online booking form.",
    ),

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

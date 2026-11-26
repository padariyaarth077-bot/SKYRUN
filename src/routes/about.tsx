import { createFileRoute } from "@tanstack/react-router";
import { JourneyContent } from "@/components/journey-content";
import { InnerPage } from "@/components/inner-page";
import { publicSeo } from "@/lib/seo";
import img from "@/assets/skyrun-chicago.jpg";

export const Route = createFileRoute("/about")({
  head: () =>
    publicSeo(
      "/about",
      "About Skyrun Limo LLC | Chicago Chauffeur Service",
      "Skyrun Limo LLC is led by Vrund Patel and Nisharg Patel. The team arranges private chauffeur transportation in Chicago and surrounding suburbs.",
    ),

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
    >
      <JourneyContent page="about" />
    </InnerPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";
import img from "@/assets/skyrun-hero.jpg";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a Ride \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content: "Send a ride request to Skyrun Limo. Bookings are confirmed when Skyrun replies.",
      },
      { property: "og:title", content: "Book a Ride \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content: "Send a ride request to Skyrun Limo. Bookings are confirmed when Skyrun replies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  return (
    <InnerPage
      eyebrow="Book a ride"
      title="Tell us about"
      accent="your journey."
      intro="Send a ride request to Skyrun Limo. Bookings are confirmed when Skyrun replies."
      image={img}
      blocks={[]}
      showForm
    />
  );
}

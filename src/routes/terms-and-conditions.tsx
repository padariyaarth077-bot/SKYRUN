import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions \u2014 Skyrun Limo" },
      {
        name: "description",
        content: "Terms for requesting transportation from Skyrun Limo LLC in Chicago, Illinois.",
      },
      { property: "og:title", content: "Terms & Conditions \u2014 Skyrun Limo" },
      {
        property: "og:description",
        content: "Terms for requesting transportation from Skyrun Limo LLC in Chicago, Illinois.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsAndConditionsPage,
});

function TermsAndConditionsPage() {
  return (
    <InnerPage
      eyebrow="Legal"
      title="Terms & Conditions"
      intro="Terms for requesting transportation from Skyrun Limo LLC in Chicago, Illinois."
      blocks={[
        {
          title: "Requests",
          body: "Submitting a request does not confirm a booking. A ride is confirmed only when Skyrun replies directly.",
        },
        { title: "Pricing", body: "Quoted individually and confirmed before service." },
        {
          title: "Changes & cancellations",
          body: "Contact Skyrun as early as possible; terms are confirmed per booking.",
        },
        {
          title: "Vehicles",
          body: "Vehicle categories are illustrative and subject to availability.",
        },
        {
          title: "Note",
          body: "This is a general template and should be reviewed by a legal professional.",
        },
      ]}
      legal
    />
  );
}

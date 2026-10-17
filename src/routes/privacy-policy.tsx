import { createFileRoute } from "@tanstack/react-router";
import { InnerPage } from "@/components/inner-page";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy \u2014 Skyrun Limo" },
      {
        name: "description",
        content: "How Skyrun Limo LLC handles information you share when requesting a ride.",
      },
      { property: "og:title", content: "Privacy Policy \u2014 Skyrun Limo" },
      {
        property: "og:description",
        content: "How Skyrun Limo LLC handles information you share when requesting a ride.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <InnerPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How Skyrun Limo LLC handles information you share when requesting a ride."
      blocks={[
        {
          title: "Information we receive",
          body: "Details you send through a ride request or email: name, phone, email, trip details and notes.",
        },
        {
          title: "How it is used",
          body: "Only to respond to and arrange your transportation request.",
        },
        { title: "Sharing", body: "We do not sell your information." },
        { title: "Contact", body: "Questions: skyrunlimo2428@gmail.com." },
        {
          title: "Note",
          body: "This is a general template and should be reviewed by a legal professional.",
        },
      ]}
      legal
    />
  );
}

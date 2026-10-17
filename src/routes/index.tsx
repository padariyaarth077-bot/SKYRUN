import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/skyrun-site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skyrun Limo | Chicago Chauffeur & Black Car Service" },
      {
        name: "description",
        content:
          "Elevate every journey with Skyrun Limo. Request private chauffeur transportation for Chicago airport, corporate, hourly, and destination travel.",
      },
      { property: "og:title", content: "Skyrun Limo | Elevate Every Journey" },
      {
        property: "og:description",
        content:
          "Private chauffeur-driven transportation for airport, corporate, and destination travel in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/skyrun-site";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    publicSeo(
      "/",
      "Chicago Limo & Chauffeur Service | Skyrun Limo",
      "Private chauffeur service in Chicago for O’Hare (ORD) and Midway (MDW) transfers, corporate travel, hourly rides and special occasions. Request a ride from Skyrun Limo LLC.",
    ),
  component: HomePage,
});

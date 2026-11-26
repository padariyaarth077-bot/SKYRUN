import { createFileRoute } from "@tanstack/react-router";
import { PolicyHub } from "@/components/policy-page";
import { publicSeo } from "@/lib/seo";
export const Route = createFileRoute("/policies")({
  head: () =>
    publicSeo(
      "/policies",
      "Policies & Information | Skyrun Limo",
      "Read Skyrun Limo’s privacy, terms, refund, cookie and chauffeur service policies.",
    ),
  component: PolicyHub,
});

import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/policy-page";

export const Route = createFileRoute("/chauffeur-service-policy")({
  head: () => policyHead("chauffeur-service-policy"),
  component: () => <PolicyPage slug="chauffeur-service-policy" />,
});

import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/policy-page";

export const Route = createFileRoute("/privacy-policy")({
  head: () => policyHead("privacy-policy"),
  component: () => <PolicyPage slug="privacy-policy" />,
});

import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/policy-page";

export const Route = createFileRoute("/refund-policy")({
  head: () => policyHead("refund-policy"),
  component: () => <PolicyPage slug="refund-policy" />,
});

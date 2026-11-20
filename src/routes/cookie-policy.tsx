import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/policy-page";

export const Route = createFileRoute("/cookie-policy")({
  head: () => policyHead("cookie-policy"),
  component: () => <PolicyPage slug="cookie-policy" />,
});

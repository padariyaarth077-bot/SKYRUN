import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/policy-page";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => policyHead("terms-and-conditions"),
  component: () => <PolicyPage slug="terms-and-conditions" />,
});

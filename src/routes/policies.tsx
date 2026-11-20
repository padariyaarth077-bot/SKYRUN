import { createFileRoute } from "@tanstack/react-router";
import { PolicyHub } from "@/components/policy-page";
export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Policies & Information — Skyrun Limo" },
      {
        name: "description",
        content:
          "Read Skyrun Limo’s privacy, terms, refund, cookie and chauffeur service policies.",
      },
    ],
  }),
  component: PolicyHub,
});

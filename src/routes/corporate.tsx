import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/corporate")({
  beforeLoad: () => {
    throw redirect({ to: "/corporate-transportation", replace: true });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/occasions")({
  beforeLoad: () => {
    throw redirect({ to: "/special-occasions", replace: true });
  },
});

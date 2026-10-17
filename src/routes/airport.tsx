import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/airport")({
  beforeLoad: () => {
    throw redirect({ to: "/airport-transfer", replace: true });
  },
});

import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/internal/communications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCommunicationDispatch } = await import("@/lib/communication.server");
        return handleCommunicationDispatch(request);
      },
    },
  },
});

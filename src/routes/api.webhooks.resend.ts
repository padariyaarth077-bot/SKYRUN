import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleResendWebhook } = await import("@/lib/resend-webhook.server");
        return handleResendWebhook(request);
      },
    },
  },
});

import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { ChatInbox } from "@/components/chat-inbox";
export const Route = createFileRoute("/_authenticated/admin/chat-conversations")({
  validateSearch: (s: Record<string, unknown>) => ({
    conversation: z.string().uuid().safeParse(s["conversation"]).success
      ? String(s["conversation"])
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat Conversations — Skyrun Operations Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatConversations,
});
function ChatConversations() {
  const { user } = Route.useRouteContext();
  const { conversation } = Route.useSearch();
  return (
    <ChatInbox key={conversation ?? "inbox"} userId={user.id} initialConversation={conversation} />
  );
}

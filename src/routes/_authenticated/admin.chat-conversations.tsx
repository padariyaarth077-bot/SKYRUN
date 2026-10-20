import { createFileRoute } from "@tanstack/react-router";
import { ChatInbox } from "@/components/chat-inbox";
export const Route = createFileRoute("/_authenticated/admin/chat-conversations")({
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
  return <ChatInbox userId={user.id} />;
}

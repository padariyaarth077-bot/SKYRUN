import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, UserRound } from "lucide-react";
import { AdminShell, Panel, timeAgo } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/chat.shared";

type InboxConversation = {
  id: string;
  status: string;
  assigned_to: string | null;
  handoff_requested_at: string | null;
  updated_at: string;
  lead_id: string | null;
  customer_id: string | null;
  customers: { full_name: string; email: string | null; phone: string | null } | null;
  leads: { lead_number: string; subject: string | null } | null;
};

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
  const [rows, setRows] = useState<InboxConversation[]>([]);
  const [selected, setSelected] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "HANDOFF">("ALL");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("conversations")
      .select(
        "id,status,assigned_to,handoff_requested_at,updated_at,lead_id,customer_id,customers(full_name,email,phone),leads(lead_number,subject)",
      )
      .eq("channel", "CHAT_WIDGET")
      .order("updated_at", { ascending: false });
    if (loadError) setError("Could not load conversations. Please retry.");
    else setRows((data as InboxConversation[]) ?? []);
    setLoading(false);
  }, []);
  const loadMessages = useCallback(async (id: string) => {
    const { data, error: loadError } = await supabase
      .from("conversation_messages")
      .select("id,sender_type,message,created_at")
      .eq("conversation_id", id)
      .order("created_at");
    if (loadError) setError("Could not load this conversation.");
    else setMessages((data as ChatMessage[]) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (selected) void loadMessages(selected);
  }, [selected, loadMessages]);
  useEffect(() => {
    const channel = supabase
      .channel("skyrun-staff-chat-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void load();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        (event) => {
          if (selected && event.new["conversation_id"] === selected) void loadMessages(selected);
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, loadMessages, selected]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (filter === "HANDOFF" && row.status !== "HANDOFF_REQUESTED") return false;
        const value =
          `${row.customers?.full_name ?? ""} ${row.customers?.email ?? ""} ${row.leads?.lead_number ?? ""}`.toLowerCase();
        return value.includes(query.toLowerCase());
      }),
    [rows, query, filter],
  );
  const active = rows.find((row) => row.id === selected);
  const takeOver = async () => {
    if (!selected) return;
    setSending(true);
    setError("");
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ assigned_to: user.id, status: "HUMAN_HANDLING" })
      .eq("id", selected);
    if (updateError) setError("Could not take over this conversation.");
    else await load();
    setSending(false);
  };
  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    setError("");
    const { error: messageError } = await supabase
      .from("conversation_messages")
      .insert({ conversation_id: selected, sender_type: "ADMIN", message: reply.trim() });
    if (messageError) {
      setError("Your reply was not saved. Please try again.");
      setSending(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ assigned_to: user.id, status: "WAITING_FOR_CUSTOMER" })
      .eq("id", selected);
    if (updateError) setError("Reply saved, but the conversation status could not be updated.");
    else {
      setReply("");
      await Promise.all([load(), loadMessages(selected)]);
    }
    setSending(false);
  };
  const resolve = async () => {
    if (!selected) return;
    setSending(true);
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ status: "RESOLVED", ended_at: new Date().toISOString() })
      .eq("id", selected);
    if (updateError) setError("Could not resolve this conversation.");
    else await load();
    setSending(false);
  };

  return (
    <AdminShell title="Chat Conversations" subtitle="Visitor conversations and human handoffs">
      <div className="grid min-h-[36rem] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <div className="space-y-2 border-b border-border p-3">
            <input
              aria-label="Search conversations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or lead"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("ALL")}
                className={`rounded px-2 py-1 text-xs ${filter === "ALL" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("HANDOFF")}
                className={`rounded px-2 py-1 text-xs ${filter === "HANDOFF" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                Handoff required
              </button>
            </div>
          </div>
          <div className="max-h-[34rem] overflow-y-auto">
            {loading && <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>}
            {!loading && !visible.length && (
              <p className="p-4 text-sm text-muted-foreground">No matching conversations.</p>
            )}
            {visible.map((row) => (
              <button
                key={row.id}
                onClick={() => setSelected(row.id)}
                className={`block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-muted ${selected === row.id ? "bg-accent" : ""}`}
              >
                <div className="flex justify-between gap-2">
                  <strong className="truncate">
                    {row.customers?.full_name ?? "Website visitor"}
                  </strong>
                  <span className="text-xs text-muted-foreground">{timeAgo(row.updated_at)}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {row.leads?.lead_number ?? "No lead yet"} · {row.status}
                </p>
                {row.status === "HANDOFF_REQUESTED" && (
                  <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    Human requested
                  </span>
                )}
              </button>
            ))}
          </div>
        </Panel>
        <Panel className="flex min-h-[34rem] flex-col">
          {!active ? (
            <p className="m-auto text-sm text-muted-foreground">
              Select a conversation to review it.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="font-semibold">
                    {active.customers?.full_name ?? "Website visitor"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {active.customers?.email ??
                      active.customers?.phone ??
                      "Contact details not yet shared"}
                    {active.leads && ` · ${active.leads.lead_number}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={takeOver}
                    disabled={
                      sending ||
                      active.status === "HUMAN_HANDLING" ||
                      active.status === "WAITING_FOR_CUSTOMER"
                    }
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <UserRound className="size-3" /> Take over
                  </button>
                  <button
                    onClick={resolve}
                    disabled={sending || active.status === "RESOLVED"}
                    className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.sender_type === "ADMIN"
                        ? "ml-auto w-fit max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "w-fit max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm"
                    }
                  >
                    <p>{message.message}</p>
                    <time className="mt-1 block text-[10px] opacity-60">
                      {new Date(message.created_at).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
              {error && (
                <p
                  role="alert"
                  className="mx-4 rounded bg-destructive/10 p-2 text-xs text-destructive"
                >
                  {error}
                </p>
              )}
              <form onSubmit={sendReply} className="flex gap-2 border-t border-border p-3">
                <input
                  aria-label="Reply to visitor"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={1500}
                  placeholder="Write a reply…"
                  disabled={sending || active.status === "RESOLVED"}
                  className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  disabled={sending || !reply.trim()}
                  className="rounded bg-primary px-3 text-primary-foreground disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </form>
            </>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

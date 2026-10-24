import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AdminShell, Panel, timeAgo } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import { CatalogueShare } from "@/components/catalogue-share";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readAll } from "@/lib/admin-data";
import {
  mergeChatMessages,
  chatPageHasGap,
  type ChatPage,
  type ChatMessage,
  type ChatConversation,
} from "@/lib/chat.shared";
import { usePolling } from "@/lib/use-polling";

type InboxRow = Database["public"]["Views"]["chat_inbox"]["Row"];
export function ChatInbox({
  userId,
  initialConversation,
}: {
  userId: string;
  initialConversation?: string | undefined;
}) {
  const [rows, setRows] = useState<InboxRow[]>([]),
    [selected, setSelected] = useState<string | undefined>(initialConversation),
    [detail, setDetail] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true),
    [historyLoading, setHistoryLoading] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [sending, setSending] = useState(false);
  const [listError, setListError] = useState(""),
    [historyError, setHistoryError] = useState(""),
    [mutationError, setMutationError] = useState(""),
    [readWarning, setReadWarning] = useState("");
  const selectedRef = useRef<string | undefined>(initialConversation),
    listBusy = useRef(false),
    busy = useRef(false),
    sequence = useRef(0),
    flight = useRef<{ id: string; token: number } | null>(null);
  const messageCache = useRef<ChatMessage[]>([]);
  const oldest = useRef<ChatMessage | null>(null),
    retry = useRef({ signature: "", id: "" });
  const refreshList = useCallback(async (quiet = false) => {
    if (listBusy.current) return;
    listBusy.current = true;
    if (!quiet) setLoading(true);
    try {
      const records = await readAll<InboxRow>((start, end) =>
        supabase
          .from("chat_inbox")
          .select("*")
          .order("updated_at", { ascending: false })
          .order("id")
          .range(start, end),
      );
      setRows(records);
      setListError("");
    } catch {
      setListError(
        "Could not load conversations. Refresh to retry; the approved Phase 6 database update may be pending.",
      );
    } finally {
      listBusy.current = false;
      setLoading(false);
    }
  }, []);
  const refreshHistory = useCallback(async (id: string, earlier = false, quiet = false) => {
    if (selectedRef.current !== id || flight.current?.id === id) return;
    const token = ++sequence.current;
    flight.current = { id, token };
    if (!quiet) setHistoryLoading(true);
    const cursor = earlier ? oldest.current : null;
    try {
      const result = await supabase.rpc("chat_staff_load", {
        _conversation_id: id,
        _before_id: cursor?.id ?? null,
        _before_created_at: cursor?.created_at ?? null,
      });
      if (result.error || !result.data) throw Error();
      const saved = result.data as unknown as ChatPage;
      if (selectedRef.current !== id || sequence.current !== token) return;
      const gap = !earlier && chatPageHasGap(messageCache.current, saved.messages, saved.has_more);
      messageCache.current = mergeChatMessages(messageCache.current, saved.messages);
      setMessages(messageCache.current);
      setHistoryError("");
      if (earlier || !oldest.current || gap) {
        oldest.current = saved.messages[0] ?? oldest.current;
        setHasMore(saved.has_more);
      }
      if (!earlier) {
        setDetail(saved.conversation);
        if (saved.can_handle && saved.last_customer_message_id) {
          const read = await supabase.rpc("chat_mark_read", {
            _conversation_id: id,
            _last_customer_message_id: saved.last_customer_message_id,
          });
          if (selectedRef.current !== id || sequence.current !== token) return;
          setReadWarning(
            read.error ? "Messages loaded, but the team unread marker could not be saved." : "",
          );
          if (!read.error && read.data === true)
            setRows((previous) =>
              previous.map((row) =>
                row.id === id && row.last_customer_message_id === saved.last_customer_message_id
                  ? { ...row, unread: false }
                  : row,
              ),
            );
        }
      }
    } catch {
      if (selectedRef.current === id && sequence.current === token)
        setHistoryError(
          "Could not load this conversation. Saved messages and your draft are preserved. Refresh to retry.",
        );
    } finally {
      if (flight.current?.token === token) flight.current = null;
      if (selectedRef.current === id && sequence.current === token) setHistoryLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshList();
  }, [refreshList]);
  useEffect(() => {
    if (selected) void refreshHistory(selected);
  }, [selected, refreshHistory]);
  usePolling(async () => {
    await refreshList(true);
    if (selectedRef.current) await refreshHistory(selectedRef.current, false, true);
  }, !sending);
  const choose = (id: string) => {
    if (busy.current || selectedRef.current === id) return;
    selectedRef.current = id;
    sequence.current++;
    oldest.current = null;
    messageCache.current = [];
    setSelected(id);
    setDetail(null);
    setMessages([]);
    setHasMore(false);
    setHistoryError("");
    setMutationError("");
    setReadWarning("");
  };
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("skyrun-active-conversation", { detail: selected ?? null }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("skyrun-active-conversation", { detail: null }));
    };
  }, [selected]);
  const row = rows.find((item) => item.id === selected),
    active = detail ?? row;
  const terminal = active && ["RESOLVED", "CLOSED"].includes(active.status),
    owned = active?.assigned_to === userId;
  const canHandle = row?.can_handle === true,
    canReply =
      canHandle &&
      owned &&
      !terminal &&
      ["HUMAN_HANDLING", "WAITING_FOR_CUSTOMER"].includes(active?.status ?? "");
  const draft = selected ? (drafts[selected] ?? "") : "";
  const action = async (kind: "claim" | "reply" | "resolve") => {
    if (!selected || busy.current || (kind === "reply" && !draft.trim())) return;
    busy.current = true;
    setSending(true);
    setMutationError("");
    const id = selected,
      message = kind === "reply" ? draft.trim() : "",
      signature = JSON.stringify([id, kind, message]);
    if (retry.current.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await supabase.rpc("chat_staff_action", {
        _conversation_id: id,
        _operation_id: retry.current.id,
        _action: kind,
        _message: message,
      });
      if (result.error || result.data !== id) throw Error();
      if (kind === "reply") setDrafts((previous) => ({ ...previous, [id]: "" }));
      retry.current = { signature: "", id: "" };
      await Promise.all([refreshList(true), refreshHistory(id, false, true)]);
    } catch {
      setMutationError(
        "Could not confirm this action. Your draft is preserved. Refresh to check assignment, permissions and saved status, or retry the same action safely.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  const filtered = rows.filter(
    (item) =>
      (filter !== "HANDOFF" || item.status === "HANDOFF_REQUESTED") &&
      (filter !== "UNREAD" || item.unread) &&
      (filter !== "OPEN" || !["RESOLVED", "CLOSED"].includes(item.status)) &&
      (filter !== "RESOLVED" || ["RESOLVED", "CLOSED"].includes(item.status)) &&
      `${item.customer_name ?? ""} ${item.customer_email ?? ""} ${item.customer_phone ?? ""} ${item.lead_number ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return (
    <AdminShell
      title="Chat Conversations"
      subtitle="Saved customer chats and staff replies"
      actions={
        <button
          disabled={loading || sending}
          className="rounded border p-2"
          onClick={() => {
            void refreshList();
            if (selected) void refreshHistory(selected);
          }}
        >
          Refresh inbox
        </button>
      }
    >
      {listError && (
        <p role="alert" className="mb-3 text-destructive">
          {listError}
        </p>
      )}
      <p className="mb-3 text-sm">
        Unread markers are shared by the team. Messages refresh automatically while this page is
        visible. Preset answers pause during human handoff.
      </p>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel>
          <div className="space-y-3 p-3">
            <label className="block">
              Search conversations
              <input
                className="block w-full rounded border p-2"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Conversation filter
              <select
                className="ml-2 rounded border p-2"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="ALL">All</option>
                <option value="UNREAD">Unread for team</option>
                <option value="HANDOFF">Handoff required</option>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved / closed</option>
              </select>
            </label>
          </div>
          {loading ? (
            <p role="status" className="p-4">
              Loading conversations…
            </p>
          ) : !listError && !filtered.length ? (
            <p className="p-4">No matching conversations.</p>
          ) : null}
          {!loading &&
            filtered.slice(safePage * 50, safePage * 50 + 50).map((item) => (
              <button
                key={item.id}
                disabled={sending}
                onClick={() => choose(item.id)}
                aria-pressed={selected === item.id}
                className="block w-full border-t p-4 text-left hover:bg-muted"
              >
                <strong>{item.customer_name ?? "Website visitor"}</strong>
                <p className="text-xs">
                  {item.lead_number ?? "No lead yet"} · {item.status} · {timeAgo(item.updated_at)}
                </p>
                {item.unread && (
                  <span className="text-xs font-semibold text-primary">Unread for team</span>
                )}
              </button>
            ))}
          {!loading && !listError && (
            <AdminPagination page={safePage} total={filtered.length} onChange={setPage} />
          )}
        </Panel>
        <Panel>
          {!row ? (
            <p className="p-6">Select a conversation to review it.</p>
          ) : (
            <div className="space-y-3 p-4">
              <h2 className="font-semibold">{row.customer_name ?? "Website visitor"}</h2>
              <p>
                {active?.status} ·{" "}
                {owned
                  ? "Assigned to you"
                  : active?.assigned_to
                    ? "Assigned to another staff member"
                    : "Not assigned"}
              </p>
              <div className="flex flex-wrap gap-3">
                {row.customer_id && (
                  <Link
                    className="underline"
                    to="/admin/customer/$id"
                    params={{ id: row.customer_id }}
                  >
                    Customer profile
                  </Link>
                )}
                {row.lead_id && (
                  <Link className="underline" to="/admin/leads/$id" params={{ id: row.lead_id }}>
                    Linked lead
                  </Link>
                )}
              </div>
              <CatalogueShare phone={row.customer_phone} />
              <div className="flex gap-3">
                <button
                  className="rounded border p-2 disabled:opacity-50"
                  disabled={
                    sending ||
                    !canHandle ||
                    Boolean(terminal) ||
                    Boolean(active?.assigned_to && !owned) ||
                    (owned &&
                      ["HUMAN_HANDLING", "WAITING_FOR_CUSTOMER"].includes(active?.status ?? ""))
                  }
                  onClick={() => void action("claim")}
                >
                  Take over
                </button>
                <button
                  className="rounded border p-2 disabled:opacity-50"
                  disabled={sending || !canReply}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Resolve this conversation? Its saved history will remain available.",
                      )
                    )
                      void action("resolve");
                  }}
                >
                  Resolve conversation
                </button>
              </div>
              {!canHandle && (
                <p className="text-sm">This conversation is read-only for your role.</p>
              )}
              {historyLoading && <p role="status">Loading messages…</p>}
              {historyError && (
                <p role="alert">
                  {historyError}{" "}
                  <button
                    className="underline"
                    onClick={() => {
                      if (selected) void refreshHistory(selected);
                    }}
                  >
                    Refresh messages
                  </button>
                </p>
              )}
              {readWarning && <p role="alert">{readWarning}</p>}
              {hasMore && (
                <button
                  className="underline"
                  disabled={historyLoading}
                  onClick={() => {
                    if (selected) void refreshHistory(selected, true);
                  }}
                >
                  Load earlier messages
                </button>
              )}
              <div
                className="max-h-[30rem] space-y-2 overflow-y-auto"
                aria-label="Conversation messages"
              >
                {messages.map((message) => (
                  <div
                    className={
                      message.sender_type === "ADMIN"
                        ? "ml-auto max-w-[85%] rounded bg-primary p-3 text-primary-foreground"
                        : "max-w-[85%] rounded bg-muted p-3"
                    }
                    key={message.id}
                  >
                    <p>{message.message}</p>
                    <time className="text-xs">
                      {message.sender_type} · {new Date(message.created_at).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
              {!historyLoading && !historyError && !messages.length && (
                <p>No messages in this conversation.</p>
              )}
              {mutationError && <p role="alert">{mutationError}</p>}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("reply");
                }}
              >
                <label className="flex-1">
                  Reply to visitor
                  <input
                    className="block w-full rounded border p-2"
                    maxLength={1500}
                    value={draft}
                    onChange={(e) => {
                      if (selected)
                        setDrafts((previous) => ({ ...previous, [selected]: e.target.value }));
                    }}
                    disabled={sending || !canReply}
                    placeholder={owned ? "Write a reply…" : "Take over before replying"}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-primary px-3 text-primary-foreground disabled:opacity-50"
                  disabled={sending || !canReply || !draft.trim()}
                >
                  {sending ? "Saving…" : "Send reply"}
                </button>
              </form>
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

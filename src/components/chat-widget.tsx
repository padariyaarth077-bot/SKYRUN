import { EnquiryConfirmation } from "@/components/enquiry-confirmation";
import { usePolling } from "@/lib/use-polling";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, RotateCw, Send, UserRound, X } from "lucide-react";
import {
  loadChat,
  requestChatHandoff,
  sendChatMessage,
  startChat,
  submitChatContact,
} from "@/lib/chat.functions";
import {
  CHAT_SESSION_KEY,
  fallbackReply,
  mergeChatMessages,
  chatPageHasGap,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat.shared";

type Contact = { name: string; email: string; phone: string };
function storedSession() {
  try {
    return window.localStorage.getItem(CHAT_SESSION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
function saveSession(session: string) {
  try {
    window.localStorage.setItem(CHAT_SESSION_KEY, session);
  } catch {
    /* The active tab still works. */
  }
}

export function ChatWidget() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<string>();
  const [conversation, setConversation] = useState<ChatConversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "" });
  const [showContact, setShowContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [offlineAnswer, setOfflineAnswer] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false),
    refreshBusy = useRef(false),
    initializing = useRef(false);
  const sessionRef = useRef<string | undefined>(undefined);
  const retry = useRef({ signature: "", id: "" });
  const oldest = useRef<ChatMessage | null>(null);
  const messageCache = useRef<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false),
    [historyBusy, setHistoryBusy] = useState(false),
    [refreshError, setRefreshError] = useState("");
  const refresh = useCallback(async (knownSession: string) => {
    if (refreshBusy.current) return;
    refreshBusy.current = true;
    try {
      const state = await loadChat({ data: { session: knownSession } });
      if (sessionRef.current !== knownSession) return;
      setConversation(state.conversation);
      const gap = chatPageHasGap(messageCache.current, state.messages, state.has_more);
      messageCache.current = mergeChatMessages(messageCache.current, state.messages);
      setMessages(messageCache.current);
      if (!oldest.current || gap) {
        oldest.current = state.messages[0] ?? null;
        setHasMore(state.has_more);
      }
      setRefreshError("");
    } catch {
      if (sessionRef.current === knownSession)
        setRefreshError(
          "Could not refresh chat. Saved messages and your draft are preserved. Try again.",
        );
    } finally {
      refreshBusy.current = false;
    }
  }, []);
  usePolling(
    async () => {
      if (session) await refresh(session);
    },
    open && Boolean(session) && !busy && !historyBusy,
  );
  const loadOlder = async () => {
    if (!session || !oldest.current || historyBusy) return;
    setHistoryBusy(true);
    try {
      const state = await loadChat({
        data: { session, beforeId: oldest.current.id, beforeCreatedAt: oldest.current.created_at },
      });
      if (sessionRef.current !== session) return;
      messageCache.current = mergeChatMessages(state.messages, messageCache.current);
      setMessages(messageCache.current);
      oldest.current = state.messages[0] ?? oldest.current;
      setHasMore(state.has_more);
      setRefreshError("");
    } catch {
      setRefreshError("Could not load earlier messages. Try again.");
    } finally {
      setHistoryBusy(false);
    }
  };

  useEffect(() => {
    if (!open || session || initializing.current) return;
    initializing.current = true;
    const initialize = async () => {
      setBusy(true);
      try {
        const started = await startChat({ data: { session: storedSession() } });
        saveSession(started.session);
        sessionRef.current = started.session;
        setSession(started.session);
        await refresh(started.session);
        setError("");
      } catch {
        setError("Chat is temporarily unavailable. Please call or email the Skyrun team.");
      } finally {
        initializing.current = false;
        setBusy(false);
      }
    };
    void initialize();
  }, [open, session, attempt, refresh]);
  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId, open]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !input.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const signature = JSON.stringify([session, input.trim()]);
      if (retry.current.signature !== signature)
        retry.current = { signature, id: crypto.randomUUID() };
      await sendChatMessage({ data: { session, message: input, operationId: retry.current.id } });
      retry.current = { signature: "", id: "" };
      setInput("");
      await refresh(session);
    } catch (cause) {
      setError("Your message could not be confirmed. Your draft is preserved; retry safely.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const handoff = async () => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestChatHandoff({ data: { session } });
      await refresh(session);
    } catch {
      setError("We could not request human support. Please call or email the Skyrun team.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await submitChatContact({ data: { session, ...contact } });
      if (!result.ok || !result.reference) throw new Error("Missing confirmation");
      setShowContact(false);
      await refresh(session);
      setNotice(result.reference);
    } catch {
      setError("We could not save your contact details. Please check them and try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const status = conversation?.status;
  const humanHandling =
    status === "HANDOFF_REQUESTED" ||
    status === "HUMAN_HANDLING" ||
    status === "WAITING_FOR_CUSTOMER";
  const unavailable = Boolean(error && !session);

  // The widget owns browser-only session storage and must not render into SSR HTML.
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <section
          aria-label="Skyrun assistant"
          className={`mb-3 flex w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl ${unavailable ? "" : "h-[min(36rem,calc(100vh-7rem))]"}`}
        >
          <header className="flex items-center justify-between border-b border-border bg-foreground px-4 py-3 text-background">
            <div>
              <div className="font-semibold">Skyrun Assistant</div>
              <p className="text-xs text-background/70">Trip enquiries and service information</p>
            </div>
            <button
              aria-label="Minimize chat"
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-background/10"
            >
              <X className="size-4" />
            </button>
          </header>
          {unavailable ? (
            <div className="space-y-4 p-5 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Skyrun Limo
                </p>
                <h2 className="mt-1 font-display text-2xl">How can we help?</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Our secure chat is being prepared. You can still get quick answers or speak
                  directly with the team.
                </p>
              </div>
              <div className="grid gap-2">
                {[
                  "Do you handle airport travel?",
                  "Which vehicles are available?",
                  "Can I get a price?",
                ].map((question) => (
                  <button
                    key={question}
                    onClick={() => setOfflineAnswer(fallbackReply(question))}
                    className="rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-left text-xs font-medium transition hover:border-primary hover:bg-accent"
                  >
                    {question}
                  </button>
                ))}
              </div>
              {offlineAnswer && (
                <p className="rounded-xl border border-primary/20 bg-accent p-3 text-xs leading-relaxed text-accent-foreground">
                  {offlineAnswer}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="tel:+18723002173"
                  className="rounded-xl bg-primary px-3 py-3 text-center text-xs font-semibold text-primary-foreground"
                >
                  Call Skyrun
                </a>
                <a
                  href="mailto:skyrunlimo2428@gmail.com"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-3 text-xs font-semibold"
                >
                  Email <ArrowUpRight className="size-3" />
                </a>
              </div>
              <button
                onClick={() => {
                  setOfflineAnswer("");
                  setAttempt((value) => value + 1);
                }}
                disabled={busy}
                className="mx-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Checking secure chat…
                  </>
                ) : (
                  <>
                    <RotateCw className="size-3" /> Try secure chat again
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
                {hasMore && (
                  <button
                    disabled={historyBusy}
                    onClick={() => void loadOlder()}
                    className="underline text-xs"
                  >
                    {historyBusy ? "Loading earlier messages…" : "Load earlier messages"}
                  </button>
                )}
                {refreshError && (
                  <p role="alert" className="text-xs text-destructive">
                    {refreshError}{" "}
                    <button
                      className="underline"
                      onClick={() => {
                        if (session) void refresh(session);
                      }}
                    >
                      Refresh chat
                    </button>
                  </p>
                )}
                {busy && !messages.length && (
                  <p className="text-muted-foreground">Opening your secure chat…</p>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.sender_type === "CUSTOMER"
                        ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                        : "w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2"
                    }
                  >
                    {message.message}
                  </div>
                ))}
                {humanHandling && (
                  <p className="rounded-md border border-primary/30 bg-accent p-2 text-xs">
                    A Skyrun team member has been asked to review this conversation. Automated
                    replies are paused.
                  </p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded-md bg-destructive/10 p-2 text-xs text-destructive"
                  >
                    {error}
                  </p>
                )}
                {(status === "RESOLVED" || status === "CLOSED") && (
                  <div className="rounded border p-2 text-xs">
                    <p>This conversation is closed. Its saved history is still available.</p>
                    <button
                      className="underline"
                      onClick={() => {
                        try {
                          window.localStorage.removeItem(CHAT_SESSION_KEY);
                        } catch {
                          /* Keep the new session in memory if storage is blocked. */
                        }
                        oldest.current = null;
                        messageCache.current = [];
                        sessionRef.current = undefined;
                        retry.current = { signature: "", id: "" };
                        setSession(undefined);
                        setConversation(undefined);
                        setMessages([]);
                        setInput("");
                        setError("");
                        setRefreshError("");
                        setHasMore(false);
                      }}
                    >
                      Start a new chat
                    </button>
                  </div>
                )}
                {notice && <EnquiryConfirmation reference={notice} contactOnly />}
                <div ref={end} />
              </div>
              {showContact ? (
                <form onSubmit={submitContact} className="space-y-2 border-t border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Share only the details needed for Skyrun to follow up.
                  </p>
                  {(["name", "email", "phone"] as const).map((field) => (
                    <input
                      key={field}
                      required
                      type={field === "email" ? "email" : "text"}
                      value={contact[field]}
                      onChange={(e) => setContact({ ...contact, [field]: e.target.value })}
                      placeholder={field[0]!.toUpperCase() + field.slice(1)}
                      className="w-full rounded border border-border bg-background px-2 py-1.5"
                    />
                  ))}
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Save enquiry
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContact(false)}
                      className="rounded border border-border px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex gap-2 border-t border-border px-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowContact(true)}
                      disabled={!session || busy}
                      className="text-xs text-primary hover:underline"
                    >
                      Share contact details
                    </button>
                    <button
                      type="button"
                      onClick={handoff}
                      disabled={!session || busy || humanHandling}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <UserRound className="size-3" /> Talk to a person
                    </button>
                  </div>
                  <form onSubmit={send} className="flex gap-2 p-2">
                    <input
                      aria-label="Chat message"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={!session || busy || status === "RESOLVED" || status === "CLOSED"}
                      maxLength={1500}
                      placeholder={
                        humanHandling ? "Message the Skyrun team…" : "Type your message…"
                      }
                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                    <button
                      aria-label="Send message"
                      disabled={
                        !session ||
                        busy ||
                        !input.trim() ||
                        status === "RESOLVED" ||
                        status === "CLOSED"
                      }
                      className="rounded bg-primary px-3 text-primary-foreground disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </section>
      )}
      <button
        aria-label={open ? "Close Skyrun chat" : "Open Skyrun chat"}
        onClick={() => setOpen((value) => !value)}
        className="chat-widget-launcher ml-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
      >
        {open ? (
          <X aria-hidden="true" />
        ) : (
          <svg className="chat-widget-whatsapp-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
        )}
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, MessageCircle, RotateCw, Send, UserRound, X } from "lucide-react";
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
  const refresh = async (knownSession: string) => {
    const state = await loadChat({ data: { session: knownSession } });
    setConversation(state.conversation);
    setMessages(state.messages);
  };

  useEffect(() => {
    if (!open || session) return;
    const initialize = async () => {
      setBusy(true);
      try {
        const started = await startChat({ data: { session: storedSession() } });
        saveSession(started.session);
        setSession(started.session);
        await refresh(started.session);
        setError("");
      } catch {
        setError("Chat is temporarily unavailable. Please call or email the Skyrun team.");
      } finally {
        setBusy(false);
      }
    };
    void initialize();
  }, [open, session, attempt]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !input.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendChatMessage({ data: { session, message: input } });
      setInput("");
      await refresh(session);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Your message was not sent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const handoff = async () => {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestChatHandoff({ data: { session } });
      await refresh(session);
    } catch {
      setError("We could not request human support. Please call or email the Skyrun team.");
    } finally {
      setBusy(false);
    }
  };
  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await submitChatContact({ data: { session, ...contact } });
      setShowContact(false);
      await refresh(session);
      setNotice(
        result.reference
          ? `Your enquiry was saved as ${result.reference}. Skyrun will review the details before confirming anything.`
          : "Your enquiry was saved.",
      );
    } catch {
      setError("We could not save your contact details. Please check them and try again.");
    } finally {
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
                {notice && (
                  <p className="rounded-md bg-success/10 p-2 text-xs text-success">{notice}</p>
                )}
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
                      disabled={!session || busy || !input.trim()}
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
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((value) => !value)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
      >
        <MessageCircle />
      </button>
    </div>
  );
}

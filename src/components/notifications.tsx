import { useEffect, useRef, useState } from "react";
import { Bell, Volume2 } from "lucide-react";
import { AdminShell, Panel, StatusBadge, timeAgo } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import { useNotifications } from "@/components/notification-context";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultPreferences,
  eventKinds,
  notificationRoute,
  notificationSchema,
  preferencesSchema,
  retryEligible,
  type NotificationPreferences,
  type StaffNotification,
} from "@/lib/notifications";
import { playNotificationSound, unlockNotificationAudio } from "@/lib/notification-sound";
import type { Database } from "@/integrations/supabase/types";
export function NotificationSettings() {
  const state = useNotifications(),
    [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const initialized = useRef(false),
    busy = useRef(false);
  useEffect(() => {
    if (!initialized.current && state?.unread !== null && state) {
      setPrefs(state.preferences);
      initialized.current = true;
    }
  }, [state]);
  return (
    <Panel title="Notifications & communications">
      <form
        className="space-y-5 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!state || busy.current) return;
          busy.current = true;
          setPending(true);
          setMessage("");
          try {
            const valid = preferencesSchema.parse(prefs);
            const ok = await state.action("preferences", undefined, valid);
            setMessage(
              ok
                ? "Notification preferences saved."
                : "Could not save. Your preferences are preserved; retry safely.",
            );
          } catch {
            setMessage("Check notification preferences and retry.");
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <p className="text-sm text-muted-foreground">
          Preferences affect your alerts, not access permissions or retained notification history.
          Emails remain disabled until the approved server processor is configured.
        </p>
        <fieldset disabled={pending || !initialized.current} className="space-y-4">
          <legend className="font-semibold">In-app notifications</legend>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={prefs.in_app}
              onChange={(e) => setPrefs({ ...prefs, in_app: e.target.checked })}
            />
            Enable pop-up alerts
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {eventKinds.map((kind) => (
              <label className="flex gap-2" key={kind}>
                <input
                  type="checkbox"
                  checked={prefs.categories[kind] !== false}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      categories: { ...prefs.categories, [kind]: e.target.checked },
                    })
                  }
                />
                {kind.replaceAll("_", " ").toLowerCase()}
              </label>
            ))}
          </div>
          <h3 className="font-semibold">Sounds</h3>
          {(
            [
              ["sound", "Notification sounds"],
              ["normal", "Normal tones"],
              ["important", "Important tones"],
              ["urgent", "Urgent tones"],
            ] as const
          ).map(([key, label]) => (
            <label className="flex gap-2" key={key}>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <label className="block">
            Sound volume
            <input
              className="block w-full"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={prefs.volume}
              onChange={(e) => setPrefs({ ...prefs, volume: Number(e.target.value) })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {(["NORMAL", "IMPORTANT", "URGENT"] as const).map((severity) => (
              <button
                className="border px-3 py-2"
                key={severity}
                type="button"
                onClick={async () => {
                  const unlocked = await unlockNotificationAudio();
                  setMessage(
                    unlocked
                      ? "Audio initialized for this browser session."
                      : "Audio unavailable. Visual notifications still work.",
                  );
                  if (unlocked && prefs.sound) playNotificationSound(severity, prefs.volume);
                }}
              >
                <Volume2 className="mr-1 inline size-4" aria-hidden="true" />
                Enable / test {severity.toLowerCase()}
              </button>
            ))}
          </div>
          <h3 className="font-semibold">Staff email</h3>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={prefs.email_urgent}
              onChange={(e) => setPrefs({ ...prefs, email_urgent: e.target.checked })}
            />
            Opt in to scoped human handoff and payment-exception emails
          </label>
          <p className="text-sm text-muted-foreground">
            Requires a verified staff email and current record permission. No routine email
            subscription or marketing.
          </p>
          <button className="bg-primary px-4 py-2 text-primary-foreground" disabled={pending}>
            {pending ? "Saving…" : "Save notification preferences"}
          </button>
        </fieldset>
        {(message || state?.error) && <p role="status">{message || state?.error}</p>}
      </form>
    </Panel>
  );
}
export function NotificationCenter() {
  const context = useNotifications(),
    [rows, setRows] = useState<StaffNotification[]>([]),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [unreadOnly, setUnreadOnly] = useState(false),
    [kind, setKind] = useState(""),
    [severity, setSeverity] = useState(""),
    [from, setFrom] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        let query = supabase
          .from("staff_notifications")
          .select("*", { count: "exact" })
          .order("seq", { ascending: false })
          .range(page * 50, page * 50 + 49);
        if (unreadOnly) query = query.is("read_at", null);
        if (kind) query = query.eq("kind", kind);
        if (severity) query = query.eq("severity", severity);
        if (from) query = query.gte("created_at", from + "T00:00:00Z");
        const result = await query;
        if (result.error) throw Error();
        const parsed = (result.data ?? []).map((row) =>
          notificationSchema.parse({ ...row, seq: String(row.seq) }),
        );
        if (active) {
          setRows(parsed);
          setTotal(result.count ?? 0);
          setError("");
        }
      } catch {
        if (active) {
          setRows([]);
          setError(
            "Could not load notifications. Check staff access and the approved Phase 8 database update.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, unreadOnly, kind, severity, from, revision, context?.through, context?.unread]);
  const act = async (action: string, id?: string) => {
    if (busy.current || !context) return;
    busy.current = true;
    setPending(true);
    try {
      if (await context.action(action, id)) setRevision((x) => x + 1);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <AdminShell
      title="Notifications"
      subtitle="Personal, scoped event history · live updates about every five seconds"
      actions={
        <button
          className="border px-3 py-2"
          onClick={() => {
            setRevision((x) => x + 1);
            void context?.refresh();
          }}
        >
          Refresh
        </button>
      }
    >
      <div className="mb-5 flex items-center gap-4 rounded-2xl border bg-card p-5">
        <Bell className="size-9 text-indigo-600" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">
            {context?.unread === null
              ? context.error
                ? "Unread count unavailable"
                : "Loading unread count…"
              : `${context?.unread ?? 0} unread notifications`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Reading notifications does not change business records or chat read markers.
          </p>
        </div>
      </div>
      <Panel title="Notification history">
        <div className="flex flex-wrap gap-4 p-5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(0);
              }}
            />
            Unread only
          </label>
          <label>
            Event type
            <select
              className="block border p-2"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All events</option>
              {eventKinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              className="block border p-2"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(0);
              }}
            >
              {["", "NORMAL", "IMPORTANT", "URGENT"].map((s) => (
                <option key={s} value={s}>
                  {s || "All severities"}
                </option>
              ))}
            </select>
          </label>
          <label>
            From date (UTC)
            <input
              type="date"
              className="block border p-2"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <button
            className="border px-3 py-2"
            disabled={pending || !context || context.unread === null || context.unread === 0}
            onClick={() => void act("read_all")}
          >
            Mark all currently observed as read
          </button>
        </div>
        {(error || context?.error) && (
          <p role="alert" className="p-5">
            {error || context?.error}
          </p>
        )}
        {loading ? (
          <p className="p-5" role="status">
            Loading notifications…
          </p>
        ) : !error && !rows.length ? (
          <p className="p-5">
            No notifications match this view. Historical events are not backfilled.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`flex flex-wrap items-center justify-between gap-3 p-5 ${n.read_at ? "" : "bg-primary/5"}`}
              >
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {n.kind} · {n.severity} · {timeAgo(n.created_at)} ·{" "}
                    {n.read_at ? "Read" : "Unread"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    className="border px-3 py-2"
                    href={notificationRoute(n) ?? "/admin/m/notifications"}
                  >
                    Open related record
                  </a>
                  <button
                    className="border px-3 py-2"
                    disabled={pending || Boolean(n.read_at)}
                    onClick={() => void act("read", n.id)}
                  >
                    Mark read
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AdminPagination page={page} total={total} onChange={setPage} />
      </Panel>
      <div className="mt-5">
        <CommunicationHistory refreshKey={`${revision}/${context?.through}`} />
      </div>
    </AdminShell>
  );
}
type CommunicationSummary = Pick<
  Database["public"]["Tables"]["communication_outbox"]["Row"],
  | "id"
  | "business_unit_id"
  | "kind"
  | "entity_type"
  | "entity_id"
  | "recipient"
  | "state"
  | "attempts"
  | "first_attempt_at"
  | "last_attempt_at"
  | "provider_email_id"
  | "failure_category"
  | "created_at"
>;
function CommunicationHistory({ refreshKey }: { refreshKey: string }) {
  const [rows, setRows] = useState<CommunicationSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void supabase
      .from("communication_outbox")
      .select(
        "id,business_unit_id,kind,entity_type,entity_id,recipient,state,attempts,first_attempt_at,last_attempt_at,provider_email_id,failure_category,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25)
      .then(
        ({ data, error }) => {
          if (active) {
            setLoading(false);
            setRows(data ?? []);
            setError(
              error
                ? "Communication history unavailable. Management permission and the Phase 8 database update are required."
                : "",
            );
          }
        },
        () => {
          if (active) {
            setLoading(false);
            setRows([]);
            setError("Could not load communication history.");
          }
        },
      );
    return () => {
      active = false;
    };
  }, [revision, refreshKey]);
  return (
    <Panel title="Communication delivery · latest 25 in management scope">
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">
          Provider accepted is not delivered. Queued mail requires the approved server processor.
          Retry queues the same immutable message; it does not immediately send.
        </p>
        {error && <p role="alert">{error}</p>}
        {loading && <p role="status">Loading communication history…</p>}
        {!loading && !error && !rows.length && (
          <p>No communication records available in your management scope.</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap justify-between gap-3 rounded-xl border p-3">
            <div>
              <a
                className="underline"
                href={
                  row.entity_type === "booking"
                    ? `/admin/booking/${row.entity_id}`
                    : `/admin/chat-conversations?conversation=${row.entity_id}`
                }
              >
                {row.kind}
              </a>
              <p className="text-sm break-all">
                {row.recipient ?? "Missing recipient"} ·{" "}
                {row.last_attempt_at ? timeAgo(row.last_attempt_at) : "Not attempted"} ·{" "}
                {row.attempts}/3 attempts
              </p>
              <StatusBadge status={row.state} />
              {row.failure_category && (
                <p>{row.failure_category.replaceAll("_", " ").toLowerCase()}</p>
              )}
            </div>
            {retryEligible(row) && (
              <button
                className="border px-3 py-2"
                disabled={pending}
                onClick={async () => {
                  if (busy.current) return;
                  busy.current = true;
                  setPending(true);
                  try {
                    const result = await supabase.rpc("phase8_retry", { _id: row.id });
                    if (result.error) throw Error();
                    setRevision((x) => x + 1);
                  } catch {
                    setError(
                      "Could not queue retry. Check permission, attempt limit and reconciliation state.",
                    );
                  } finally {
                    busy.current = false;
                    setPending(false);
                  }
                }}
              >
                Queue safe retry
              </button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

import { setLeadStatus, readAll } from "@/lib/admin-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, StatusBadge } from "@/components/admin-shell";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/leads/$id")({
  head: () => ({
    meta: [{ title: "Lead — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadDetail,
});

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const STATUSES: LeadStatus[] = [
  "NEW",
  "REVIEWING",
  "GENUINE",
  "SPAM",
  "CONTACTED",
  "QUALIFIED",
  "LOST",
];

type LeadDetailRow = {
  id: string;
  lead_number: string;
  status: LeadStatus;
  priority: string;
  source: string;
  subject: string | null;
  message: string | null;
  created_at: string;
  customers: {
    id: string;
    full_name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  ride_requests: Database["public"]["Tables"]["ride_requests"]["Row"][];
};

type ActivityRow = {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
};

function LeadDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [lead, setLead] = useState<LeadDetailRow | null>(null);
  const [acts, setActs] = useState<ActivityRow[]>([]);
  const mutationBusy = useRef(false);
  const noteBusy = useRef(false);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [activityError, setActivityError] = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setActivityLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*, customers(*), ride_requests(*)")
        .eq("id", id)
        .maybeSingle();
      setLead(data as LeadDetailRow | null);
      setLoadError(!!error);
      setLoading(false);
      try {
        setActs(
          await readAll<ActivityRow>((start, end) =>
            supabase
              .from("activities")
              .select("*")
              .eq("entity_type", "lead")
              .eq("entity_id", id)
              .order("created_at", { ascending: false })
              .order("id")
              .range(start, end),
          ),
        );
        setActivityError(false);
      } catch {
        setActs([]);
        setActivityError(true);
      }
    } catch {
      setLoadError(true);
      setLead(null);
      setActivityError(true);
    } finally {
      setLoading(false);
      setActivityLoading(false);
    }
  }, [id]);
  useEffect(() => {
    setLead(null);
    setActs([]);
    setNote("");
    setNoteError("");
    setStatusError("");
    void load();
  }, [load]);

  const log = (type: string, description: string) =>
    supabase.rpc("log_activity", {
      _entity_type: "lead",
      _entity_id: id,
      _activity_type: type,
      _description: description,
      _metadata: { actor_id: user.id },
    });

  const setStatus = async (status: LeadStatus) => {
    if (mutationBusy.current || lead?.status === status) return;
    mutationBusy.current = true;
    setStatusPending(true);
    setStatusError("");
    try {
      await setLeadStatus(id, status, user.id);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not save status.");
    } finally {
      await load();
      mutationBusy.current = false;
      setStatusPending(false);
    }
  };
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || noteBusy.current) return;
    noteBusy.current = true;
    setSavingNote(true);
    setNoteError("");
    try {
      const { data, error } = await log("NOTE", note.trim());
      if (error || !data) throw new Error("Note was not confirmed");
      setNote("");
      await load();
    } catch {
      setNoteError("Could not save your note. Your text is preserved; please retry.");
    } finally {
      setSavingNote(false);
      noteBusy.current = false;
    }
  };

  if (!lead)
    return (
      <AdminShell title="Lead">
        <p role="status" className="text-muted-foreground">
          {loading
            ? "Loading…"
            : loadError
              ? "Could not load this enquiry. Please reload to retry."
              : "Lead not found or unavailable."}
        </p>
      </AdminShell>
    );
  const c = lead.customers;
  return (
    <AdminShell title={lead.lead_number}>
      <Link to="/admin/leads" className="mb-4 inline-block text-sm underline">
        ← All leads
      </Link>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-3">
              <StatusBadge status={lead.status} />
              <span className="text-sm text-muted-foreground">
                {lead.priority} · {lead.source} · {new Date(lead.created_at).toLocaleString()}
              </span>
            </div>
            <h2 className="font-display text-2xl">{lead.subject ?? "No subject"}</h2>
            <p className="mt-2 whitespace-pre-wrap">{lead.message ?? "—"}</p>
          </div>
          {lead.ride_requests?.map((ride) => (
            <div key={ride.id} className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-semibold">
                <Link to="/admin/ride-request/$id" params={{ id: ride.id }}>
                  Ride enquiry {ride.request_number}
                </Link>
              </h3>
              <p>
                {ride.status} · {ride.travel_date} · {ride.pickup_time}
              </p>
              {lead.status === "GENUINE" &&
                ["SUBMITTED", "UNDER_REVIEW", "QUOTE_PENDING", "QUOTED"].includes(ride.status) && (
                  <Link
                    to="/admin/quote/$id"
                    params={{ id: "new" }}
                    search={{ rideRequestId: ride.id }}
                    className="block underline text-primary"
                  >
                    Prepare quote draft
                  </Link>
                )}
              <p>Pickup: {ride.pickup_location}</p>
              <p>Drop-off: {ride.dropoff_location}</p>
              <p>Passengers: {ride.passenger_count}</p>
              <p className="whitespace-pre-wrap">{ride.notes}</p>
            </div>
          ))}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold">Activity</h3>
            <form onSubmit={addNote} className="mb-4 flex gap-2">
              <input
                aria-label="Activity note"
                maxLength={4000}
                disabled={savingNote}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                disabled={savingNote || !note.trim()}
                className="inline-flex rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {savingNote ? "Saving…" : "Add"}
              </button>
            </form>
            {noteError && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {noteError}
              </p>
            )}
            {activityError && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                Could not load the activity timeline. Please reload to retry.
              </p>
            )}
            <ul className="space-y-3">
              {activityLoading && <li role="status">Loading activity…</li>}
              {acts.map((a) => (
                <li key={a.id} className="border-l-2 border-primary pl-3">
                  <div className="text-xs text-muted-foreground">
                    {a.activity_type} · {new Date(a.created_at).toLocaleString()}
                  </div>
                  <div className="text-sm">{a.description}</div>
                </li>
              ))}
              {!acts.length && !activityError && !activityLoading && (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              )}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-2 font-semibold">Customer</h3>
            {c ? (
              <div className="space-y-1 text-sm">
                <Link to="/admin/customer/$id" params={{ id: c.id }} className="block underline">
                  {c.full_name}
                </Link>
                {c.company_name && <div>{c.company_name}</div>}
                {c.email && (
                  <a className="block underline" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                )}
                {c.phone && (
                  <a className="block underline" href={`tel:${c.phone}`}>
                    {c.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No customer linked.</p>
            )}
          </div>
          <ReviewCard status={lead.status} leadId={id} actorId={user.id} onDone={load} />
          {statusError && (
            <p role="alert" className="text-destructive">
              {statusError}
            </p>
          )}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-2 font-semibold">Change status</h3>
            <div className="flex flex-wrap gap-2">
              {STATUSES.filter((s) => s !== "GENUINE" && s !== "SPAM").map((s) => (
                <button
                  key={s}
                  disabled={statusPending || s === lead.status}
                  onClick={() => setStatus(s)}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

const REASONS = [
  "Suspicious submission",
  "Invalid contact details",
  "Duplicate",
  "Bot / automated",
  "Irrelevant",
  "Other",
];

function ReviewCard({
  status,
  leadId,
  actorId,
  onDone,
}: {
  status: string;
  leadId: string;
  actorId: string;
  onDone: () => void;
}) {
  const busy = useRef(false);
  const [mode, setMode] = useState<null | "GENUINE" | "SPAM">(null);
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    if (!mode || busy.current) return;
    busy.current = true;
    setErr(null);
    setPhase("Saving review…");
    try {
      await setLeadStatus(leadId, mode, actorId, reason);
      setMode(null);
      setReason("");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not save review. Please retry.");
    } finally {
      await onDone();
      setPhase(null);
      busy.current = false;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-1 font-semibold">Lead review</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Decide whether this submission is a real customer.
      </p>
      <div className="flex gap-2">
        <button
          disabled={status === "GENUINE"}
          onClick={() => setMode("GENUINE")}
          className="flex-1 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          Mark Genuine
        </button>
        <button
          disabled={status === "SPAM"}
          onClick={() => setMode("SPAM")}
          className="flex-1 rounded border border-destructive px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
        >
          Mark Spam
        </button>
      </div>
      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h4 className="text-lg font-semibold">
              {mode === "GENUINE" ? "Mark Lead as Genuine?" : "Mark Lead as Spam?"}
            </h4>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "GENUINE"
                ? "This will move the lead into the genuine lead workflow and allow the next communication step."
                : "This lead will be excluded from the genuine customer communication workflow."}
            </p>
            {mode === "SPAM" && (
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!!phase}
                className="mt-4 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Spam reason (optional)</option>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
            {phase && <p className="mt-4 text-sm font-medium animate-pulse">{phase}</p>}
            {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                disabled={!!phase}
                onClick={() => {
                  setMode(null);
                  setErr(null);
                }}
                className="rounded border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={!!phase}
                onClick={confirm}
                className={
                  mode === "GENUINE"
                    ? "rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    : "rounded bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
                }
              >
                {mode === "GENUINE" ? "Mark Genuine" : "Mark Spam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

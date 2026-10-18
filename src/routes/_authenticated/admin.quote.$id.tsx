import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { quoteDraftSchema, quoteIsEditable } from "@/lib/quotes.shared";
import { saveQuoteDraft } from "@/lib/quotes.functions";
import { AdminShell, Panel, StatusBadge } from "@/components/admin-shell";
import { QuoteDelivery } from "@/components/quote-delivery";
import type { Database } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin/quote/$id")({
  validateSearch: (s: Record<string, unknown>): { rideRequestId?: string | undefined } => ({
    rideRequestId: z.string().uuid().safeParse(s["rideRequestId"]).success
      ? String(s["rideRequestId"])
      : undefined,
  }),
  head: () => ({
    meta: [{ title: "Quote — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: QuoteDetail,
});
type Quote = Database["public"]["Tables"]["quotes"]["Row"];
type Ride = Database["public"]["Tables"]["ride_requests"]["Row"];
type Activity = Database["public"]["Tables"]["activities"]["Row"];
function localTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}
function QuoteDetail() {
  const { id } = Route.useParams(),
    { rideRequestId } = Route.useSearch(),
    navigate = useNavigate();
  const draftId = useRef(crypto.randomUUID()),
    busy = useRef(false);
  const [quote, setQuote] = useState<Quote | null>(null),
    [ride, setRide] = useState<Ride | null>(null),
    [customer, setCustomer] = useState<{
      id: string;
      full_name: string;
      email: string | null;
    } | null>(null),
    [deliveryLocked, setDeliveryLocked] = useState(false),
    [genuine, setGenuine] = useState(false),
    [activities, setActivities] = useState<Activity[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const [form, setForm] = useState({ amount: "", currency: "USD", expiry: "", notes: "" });
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setQuote(null);
    setDeliveryLocked(false);
    setRide(null);
    setCustomer(null);
    setActivities([]);
    setGenuine(false);
    try {
      let q: Quote | null = null;
      if (id !== "new") {
        if (!z.string().uuid().safeParse(id).success) throw Error();
        const result = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
        if (result.error) throw result.error;
        q = result.data;
        setQuote(q);
        if (!q) return;
      }
      const request = q?.ride_request_id ?? rideRequestId;
      if (!request) return;
      const r = await supabase.from("ride_requests").select("*").eq("id", request).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return;
      setRide(r.data);
      const c = await supabase
        .from("customers")
        .select("id,full_name,email")
        .eq("id", r.data.customer_id)
        .maybeSingle();
      if (c.error) throw c.error;
      setCustomer(c.data);
      if (r.data.lead_id) {
        const l = await supabase
          .from("leads")
          .select("status")
          .eq("id", r.data.lead_id)
          .maybeSingle();
        if (l.error) throw l.error;
        setGenuine(l.data?.status === "GENUINE");
      }
      if (q) {
        setForm({
          amount: q.amount.toFixed(2),
          currency: q.currency,
          expiry: localTime(q.valid_until),
          notes: q.notes ?? "",
        });
        setActivities(
          await readAll<Activity>((s, e) =>
            supabase
              .from("activities")
              .select("*")
              .eq("entity_type", "quote")
              .eq("entity_id", q!.id)
              .order("created_at", { ascending: false })
              .order("id")
              .range(s, e),
          ),
        );
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id, rideRequestId]);
  useEffect(() => {
    draftId.current = crypto.randomUUID();
    setMessage("");
    setForm({ amount: "", currency: "USD", expiry: "", notes: "" });
    void load();
  }, [load]);
  const eligible =
    !!ride &&
    genuine &&
    ["SUBMITTED", "UNDER_REVIEW", "QUOTE_PENDING", "QUOTED"].includes(ride.status);
  const editable = eligible && !deliveryLocked && (!quote || quoteIsEditable(quote));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current || !editable || !ride) return;
    setMessage("");
    const expiry = new Date(form.expiry);
    const parsed = quoteDraftSchema.safeParse({
      quoteId: quote?.id ?? draftId.current,
      rideRequestId: ride.id,
      amount: form.amount,
      currency: form.currency,
      validUntil: Number.isFinite(expiry.getTime()) ? expiry.toISOString() : "",
      notes: form.notes,
      expectedUpdatedAt: quote?.updated_at ?? null,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the draft fields.");
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      if (session.error || !session.data.session) throw Error("Please sign in again.");
      const result = await saveQuoteDraft({
        data: parsed.data,
        headers: { Authorization: `Bearer ${session.data.session.access_token}` },
      });
      setMessage("Draft saved. It has not been sent.");
      if (id === "new")
        await navigate({
          to: "/admin/quote/$id",
          params: { id: result.id },
          search: {},
          replace: true,
        });
      else await load();
    } catch (error) {
      const allowed = [
        "Please sign in again.",
        "Staff access is required.",
        "Quote saving is unavailable.",
        "Draft saving requires the approved Phase 3 database update.",
        "Could not save the draft. Refresh and check eligibility, expiry and whether another staff member edited it.",
      ];
      setMessage(
        error instanceof Error && allowed.includes(error.message)
          ? error.message
          : "Could not save the draft. Your entries are preserved; please retry.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <AdminShell title={quote ? `Quote ${quote.id.slice(0, 8)}` : "Prepare quote draft"}>
      <Link to="/admin/m/$module" params={{ module: "quotes" }} className="underline">
        ← Quotes
      </Link>
      {loading ? (
        <p role="status">Loading quote…</p>
      ) : loadError ? (
        <p role="alert">
          Could not load quote information. <button onClick={load}>Retry</button>
        </p>
      ) : !ride ? (
        <p>Quote or ride request not found or unavailable.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <Panel title="Linked trip">
            <div className="space-y-2 p-4">
              {quote && <StatusBadge status={quote.status} />}
              <Link
                to="/admin/ride-request/$id"
                params={{ id: ride.id }}
                className="block underline"
              >
                {ride.request_number}
              </Link>
              {customer && (
                <Link
                  to="/admin/customer/$id"
                  params={{ id: customer.id }}
                  className="block underline"
                >
                  {customer.full_name}
                </Link>
              )}
              {ride.lead_id && (
                <Link
                  to="/admin/leads/$id"
                  params={{ id: ride.lead_id }}
                  className="block underline"
                >
                  Originating lead
                </Link>
              )}
              <p>
                {quote?.pickup_location ?? ride.pickup_location} →{" "}
                {quote?.dropoff_location ?? ride.dropoff_location}
              </p>
              <p>
                {quote?.travel_date ?? ride.travel_date} · {quote?.pickup_time ?? ride.pickup_time}
              </p>
              <p>Passengers: {ride.passenger_count}</p>
              {quote && (
                <p className="text-sm text-muted-foreground">
                  These passenger and luggage details come from the current request. Email and
                  customer acceptance use the saved snapshot once delivery is prepared.
                </p>
              )}
              <p className="whitespace-pre-wrap">{ride.notes}</p>
            </div>
          </Panel>
          <Panel title="Quote">
            <div className="p-4">
              {!eligible && (
                <p role="status">
                  A Genuine lead and an eligible submitted ride request are required to prepare or
                  edit a quote.
                </p>
              )}
              {quote && !quoteIsEditable(quote) && (
                <p role="status">
                  This quote is read-only: its status or validity prevents draft edits.
                </p>
              )}
              {deliveryLocked && (
                <p role="status">
                  This quote's saved version is frozen for delivery and acceptance.
                </p>
              )}
              {editable ? (
                <form onSubmit={save} className="space-y-3">
                  <label className="block">
                    Amount
                    <input
                      aria-label="Quote amount"
                      required
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      disabled={saving}
                      className="block rounded border p-2"
                    />
                  </label>
                  <label className="block">
                    Currency
                    <input
                      aria-label="Quote currency"
                      required
                      maxLength={3}
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      disabled={saving}
                      className="block rounded border p-2"
                    />
                  </label>
                  <label className="block">
                    Valid until (your local time)
                    <input
                      aria-label="Quote expiry"
                      required
                      type="datetime-local"
                      step="any"
                      value={form.expiry}
                      onChange={(e) => setForm({ ...form, expiry: e.target.value })}
                      disabled={saving}
                      className="block rounded border p-2"
                    />
                  </label>
                  <label className="block">
                    Quote notes
                    <textarea
                      aria-label="Quote notes"
                      maxLength={4000}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      disabled={saving}
                      className="block w-full rounded border p-2"
                    />
                  </label>
                  <p className="text-sm">
                    Draft saving requires the reviewed Phase 3 database update. No automatic price,
                    tax or policy is added.
                  </p>
                  <button
                    disabled={saving}
                    className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save draft"}
                  </button>
                </form>
              ) : (
                quote && (
                  <div>
                    <p>
                      {quote.currency} {quote.amount.toFixed(2)}
                    </p>
                    <p>Valid until: {new Date(quote.valid_until).toLocaleString()}</p>
                    <p className="whitespace-pre-wrap">{quote.notes}</p>
                  </div>
                )
              )}
              {message && (
                <p role="status" className="mt-3">
                  {message}
                </p>
              )}
            </div>
          </Panel>
          <Panel title="Delivery and acceptance">
            {quote && quote.updated_at ? (
              <QuoteDelivery
                quoteId={quote.id}
                updatedAt={quote.updated_at}
                rideUpdatedAt={ride.updated_at}
                recipient={customer?.email ?? ""}
                eligible={eligible && quoteIsEditable(quote)}
                onFrozenChange={setDeliveryLocked}
                onStatusChanged={() => void load()}
                unsavedChanges={
                  Number(form.amount) !== quote.amount ||
                  form.currency !== quote.currency ||
                  form.notes !== (quote.notes ?? "") ||
                  new Date(form.expiry).getTime() !== new Date(quote.valid_until).getTime()
                }
              />
            ) : (
              <p className="p-4">
                Save a draft before reviewing delivery. No quote email is sent automatically.
              </p>
            )}
          </Panel>
          <Panel title="Quote activity">
            <ul className="space-y-2 p-4">
              {activities.map((a) => (
                <li key={a.id}>
                  {a.activity_type} · {new Date(a.created_at).toLocaleString()}
                  <p>{a.description}</p>
                </li>
              ))}
              {!activities.length && <li>No quote activity yet.</li>}
            </ul>
          </Panel>
        </div>
      )}
    </AdminShell>
  );
}

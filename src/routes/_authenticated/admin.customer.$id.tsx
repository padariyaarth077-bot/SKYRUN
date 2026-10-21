import { CatalogueShare } from "@/components/catalogue-share";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { AdminShell, Panel, StatusBadge, timeAgo } from "@/components/admin-shell";
import { CustomerContactEditor } from "@/components/operations-editor";
import { possibleDuplicates } from "@/lib/phase5";
import type { Database } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin/customer/$id")({
  head: () => ({
    meta: [{ title: "Customer — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: CustomerDetail,
});
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Quote = Database["public"]["Tables"]["quotes"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Activity = Database["public"]["Tables"]["activities"]["Row"];
type Ride = Database["public"]["Tables"]["ride_requests"]["Row"];
function CustomerDetail() {
  const { id } = Route.useParams();
  const generation = useRef({ value: 0 });
  const [customer, setCustomer] = useState<Customer | null>(null),
    [leads, setLeads] = useState<Lead[]>([]),
    [rides, setRides] = useState<Ride[]>([]),
    [quotes, setQuotes] = useState<Quote[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [duplicates, setDuplicates] = useState<Customer[]>([]),
    [activities, setActivities] = useState<Activity[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const load = useCallback(async () => {
    const current = ++generation.current.value;
    setLoading(true);
    setError(false);
    setCustomer(null);
    try {
      const c = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (current !== generation.current.value) return;
      if (c.error) throw c.error;
      if (!c.data) return;
      setCustomer(c.data);
      const unit = c.data.business_unit_id;
      const [l, r, q, b, peers, a] = await Promise.all([
        readAll<Lead>((s, e) =>
          supabase
            .from("leads")
            .select("*")
            .eq("customer_id", id)
            .eq("business_unit_id", unit)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
        readAll<Ride>((s, e) =>
          supabase
            .from("ride_requests")
            .select("*")
            .eq("customer_id", id)
            .eq("business_unit_id", unit)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
        readAll<Quote>((s, e) =>
          supabase
            .from("quotes")
            .select("*")
            .eq("customer_id", id)
            .eq("business_unit_id", unit)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
        readAll<Booking>((s, e) =>
          supabase
            .from("bookings")
            .select("*")
            .eq("customer_id", id)
            .eq("business_unit_id", unit)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
        readAll<Customer>((s, e) =>
          supabase
            .from("customers")
            .select("*")
            .eq("business_unit_id", unit)
            .order("id")
            .range(s, e),
        ),
        readAll<Activity>((s, e) =>
          supabase
            .from("activities")
            .select("*")
            .eq("entity_type", "customer")
            .eq("entity_id", id)
            .eq("business_unit_id", unit)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
      ]);
      if (current !== generation.current.value) return;
      setQuotes(q);
      setBookings(b);
      setDuplicates(possibleDuplicates(c.data, peers));
      setActivities(a);
      setLeads(l);
      setRides(r);
    } catch {
      if (current === generation.current.value) setError(true);
    } finally {
      if (current === generation.current.value) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const counter = generation.current;
    return () => {
      counter.value++;
    };
  }, [load]);
  return (
    <AdminShell title={customer?.full_name ?? "Customer"}>
      <Link to="/admin/customers" className="underline">
        ← Customers
      </Link>
      {loading ? (
        <p role="status">Loading customer history…</p>
      ) : error ? (
        <p role="alert">
          Could not load customer history. <button onClick={load}>Retry</button>
        </p>
      ) : !customer ? (
        <p>Customer not found or unavailable.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <Panel title="Contact details">
            <div className="p-4">
              <p>{customer.company_name}</p>
              {customer.email && (
                <a className="block underline" href={`mailto:${customer.email}`}>
                  {customer.email}
                </a>
              )}
              {customer.phone && (
                <a className="block underline" href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
              )}
            </div>
          </Panel>
          <Panel title="Financial history">
            <div className="flex flex-wrap gap-4 p-5">
              <a
                className="text-primary underline"
                href={`/admin/m/invoices?q=${encodeURIComponent(customer.id)}`}
              >
                Invoice drafts
              </a>
              <a
                className="text-primary underline"
                href={`/admin/m/receipts?q=${encodeURIComponent(customer.id)}`}
              >
                Payment evidence previews
              </a>
              <p className="text-sm text-muted-foreground">
                Filter the report by this customer ID: {customer.id}. Financial views require
                management permission.
              </p>
            </div>
          </Panel>
          <Panel title="Share catalogue">
            <div className="p-4">
              <CatalogueShare phone={customer.phone} />
            </div>
          </Panel>
          <Panel title="Edit contact details">
            <CustomerContactEditor
              key={customer.updated_at}
              customer={customer}
              onSaved={() => void load()}
            />
          </Panel>
          <Panel title="Possible duplicate customers">
            <p className="p-4">
              Suggestions use the same name, email or normalized phone within this business unit.
              Review before editing; records are never merged automatically.
            </p>
            <ul>
              {duplicates.map((c) => (
                <li key={c.id} className="p-4">
                  <Link className="underline" to="/admin/customer/$id" params={{ id: c.id }}>
                    {c.full_name}
                  </Link>
                </li>
              ))}
              {!duplicates.length && <li className="p-4">No possible duplicates found.</li>}
            </ul>
          </Panel>
          <Panel title="Quote history">
            <ul className="divide-y">
              {quotes.map((q) => (
                <li className="p-4" key={q.id}>
                  <Link
                    className="underline"
                    to="/admin/quote/$id"
                    params={{ id: q.id }}
                    search={{}}
                  >
                    Quote {q.id.slice(0, 8)}
                  </Link>{" "}
                  · {q.currency} {q.amount.toFixed(2)} · <StatusBadge status={q.status} />
                </li>
              ))}
              {!quotes.length && <li className="p-4">No quotes for this customer.</li>}
            </ul>
          </Panel>
          <Panel title="Booking history">
            <ul className="divide-y">
              {bookings.map((b) => (
                <li className="p-4" key={b.id}>
                  <Link className="underline" to="/admin/booking/$id" params={{ id: b.id }}>
                    {b.booking_number}
                  </Link>{" "}
                  · {b.travel_date} · <StatusBadge status={b.status} />
                </li>
              ))}
              {!bookings.length && <li className="p-4">No bookings for this customer.</li>}
            </ul>
          </Panel>
          <Panel title="Customer activity">
            <ul className="divide-y">
              {activities.map((a) => (
                <li className="p-4" key={a.id}>
                  {a.description} · {timeAgo(a.created_at)} ·{" "}
                  {a.actor_id ? `Staff ${a.actor_id.slice(0, 8)}` : "System"}
                </li>
              ))}
              {!activities.length && <li className="p-4">No customer activity recorded.</li>}
            </ul>
          </Panel>
          <Panel title="Lead history">
            <ul className="divide-y">
              {leads.map((l) => (
                <li key={l.id} className="p-4">
                  <Link
                    to="/admin/leads/$id"
                    params={{ id: l.id }}
                    className="text-primary underline"
                  >
                    {l.lead_number}
                  </Link>{" "}
                  · {l.source} · <StatusBadge status={l.status} />
                  <p>{l.subject}</p>
                  <span>{timeAgo(l.created_at)}</span>
                </li>
              ))}
              {!leads.length && <li className="p-4">No leads for this customer.</li>}
            </ul>
          </Panel>
          <Panel title="Ride request history">
            <ul className="divide-y">
              {rides.map((r) => (
                <li key={r.id} className="p-4">
                  <Link
                    to="/admin/ride-request/$id"
                    params={{ id: r.id }}
                    className="text-primary underline"
                  >
                    {r.request_number}
                  </Link>{" "}
                  · {r.travel_date} · <StatusBadge status={r.status} />
                  <p>
                    {r.pickup_location} → {r.dropoff_location}
                  </p>
                </li>
              ))}
              {!rides.length && <li className="p-4">No ride requests for this customer.</li>}
            </ul>
          </Panel>
        </div>
      )}
    </AdminShell>
  );
}

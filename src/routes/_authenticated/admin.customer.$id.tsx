import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { AdminShell, Panel, StatusBadge, timeAgo } from "@/components/admin-shell";
import type { Database } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin/customer/$id")({
  head: () => ({
    meta: [{ title: "Customer — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: CustomerDetail,
});
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Ride = Database["public"]["Tables"]["ride_requests"]["Row"];
function CustomerDetail() {
  const { id } = Route.useParams();
  const [customer, setCustomer] = useState<Customer | null>(null),
    [leads, setLeads] = useState<Lead[]>([]),
    [rides, setRides] = useState<Ride[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setCustomer(null);
    try {
      const c = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (c.error) throw c.error;
      if (!c.data) return;
      setCustomer(c.data);
      const [l, r] = await Promise.all([
        readAll<Lead>((s, e) =>
          supabase
            .from("leads")
            .select("*")
            .eq("customer_id", id)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
        readAll<Ride>((s, e) =>
          supabase
            .from("ride_requests")
            .select("*")
            .eq("customer_id", id)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
      ]);
      setLeads(l);
      setRides(r);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
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

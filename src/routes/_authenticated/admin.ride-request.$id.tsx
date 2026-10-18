import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, Panel, StatusBadge } from "@/components/admin-shell";
import type { Database } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin/ride-request/$id")({
  head: () => ({
    meta: [{ title: "Ride request — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RideDetail,
});
type Ride = Database["public"]["Tables"]["ride_requests"]["Row"];
function RideDetail() {
  const { id } = Route.useParams();
  const [ride, setRide] = useState<Ride | null>(null),
    [customer, setCustomer] = useState<{ id: string; full_name: string } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setRide(null);
    setCustomer(null);
    try {
      const r = await supabase.from("ride_requests").select("*").eq("id", id).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return;
      setRide(r.data);
      const c = await supabase
        .from("customers")
        .select("id,full_name")
        .eq("id", r.data.customer_id)
        .maybeSingle();
      if (c.error) throw c.error;
      setCustomer(c.data);
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
    <AdminShell title={ride?.request_number ?? "Ride request"}>
      <Link to="/admin/m/$module" params={{ module: "ride-requests" }} className="underline">
        ← Ride requests
      </Link>
      {loading ? (
        <p role="status">Loading ride request…</p>
      ) : error ? (
        <p role="alert">
          Could not load ride request. <button onClick={load}>Retry</button>
        </p>
      ) : !ride ? (
        <p>Ride request not found or unavailable.</p>
      ) : (
        <Panel title="Trip details">
          <div className="space-y-2 p-4">
            <StatusBadge status={ride.status} />
            <p>A ride request is an enquiry; it does not confirm a booking.</p>
            {customer && (
              <Link
                to="/admin/customer/$id"
                params={{ id: customer.id }}
                className="block underline"
              >
                {customer.full_name}
              </Link>
            )}
            {ride.lead_id ? (
              <Link to="/admin/leads/$id" params={{ id: ride.lead_id }} className="block underline">
                Open linked lead and activity
              </Link>
            ) : (
              <p>No lead linked to this request.</p>
            )}
            <p>Pickup: {ride.pickup_location}</p>
            <p>Drop-off: {ride.dropoff_location}</p>
            <p>
              Date: {ride.travel_date} · Time: {ride.pickup_time}
            </p>
            <p>
              Passengers: {ride.passenger_count} · Trip type: {ride.trip_type}
            </p>
            {ride.return_date && (
              <p>
                Return: {ride.return_date} {ride.return_time}
              </p>
            )}
            {ride.hourly_duration && <p>Hours: {ride.hourly_duration}</p>}
            {ride.airport_code && (
              <p>
                Airport: {ride.airport_code} {ride.airport_direction} · Flight{" "}
                {ride.flight_number ?? "—"}
              </p>
            )}
            <p className="whitespace-pre-wrap">{ride.notes ?? "No trip notes supplied."}</p>
          </div>
        </Panel>
      )}
    </AdminShell>
  );
}

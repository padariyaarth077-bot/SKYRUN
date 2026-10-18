import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { AdminShell, Panel, StatusBadge } from "@/components/admin-shell";
import type { Database } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin/booking/$id")({
  head: () => ({
    meta: [{ title: "Booking — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: BookingDetail,
});
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Activity = Database["public"]["Tables"]["activities"]["Row"];
function BookingDetail() {
  const { id } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null),
    [acts, setActs] = useState<Activity[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setBooking(null);
    setActs([]);
    try {
      const b = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
      if (b.error) throw b.error;
      if (!b.data) return;
      setBooking(b.data);
      setActs(
        await readAll<Activity>((s, e) =>
          supabase
            .from("activities")
            .select("*")
            .eq("entity_type", "booking")
            .eq("entity_id", id)
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        ),
      );
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
    <AdminShell title={booking?.booking_number ?? "Booking"}>
      <Link to="/admin/m/$module" params={{ module: "bookings" }} className="underline">
        ← Bookings
      </Link>
      {loading ? (
        <p role="status">Loading booking…</p>
      ) : error ? (
        <p role="alert">
          Could not load booking. <button onClick={load}>Retry</button>
        </p>
      ) : !booking ? (
        <p>Booking not found or unavailable.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <Panel title="Booking details">
            <div className="space-y-2 p-4">
              <StatusBadge status={booking.status} />
              <Link
                to="/admin/customer/$id"
                params={{ id: booking.customer_id }}
                className="block underline"
              >
                Customer
              </Link>
              {booking.ride_request_id && (
                <Link
                  to="/admin/ride-request/$id"
                  params={{ id: booking.ride_request_id }}
                  className="block underline"
                >
                  Ride request and originating lead
                </Link>
              )}
              {booking.quote_id ? (
                <Link
                  to="/admin/quote/$id"
                  params={{ id: booking.quote_id }}
                  className="block underline"
                >
                  Linked quote
                </Link>
              ) : (
                <p>No quote linked.</p>
              )}
              <p>
                {booking.pickup_location} → {booking.dropoff_location}
              </p>
              <p>
                {booking.travel_date} · {booking.pickup_time} · {booking.passenger_count} passengers
              </p>
              <p>
                Agreed amount:{" "}
                {booking.final_amount === null
                  ? "Not recorded"
                  : `${booking.currency} ${booking.final_amount.toFixed(2)}`}
              </p>
              <p className="whitespace-pre-wrap">{booking.notes}</p>
              <p>
                This view reports the stored booking status; it does not imply driver assignment,
                payment or dispatch confirmation.
              </p>
            </div>
          </Panel>
          <Panel title="Activity">
            <ul className="p-4">
              {acts.map((a) => (
                <li key={a.id}>
                  {a.activity_type} · {new Date(a.created_at).toLocaleString()}
                  <p>{a.description}</p>
                </li>
              ))}
              {!acts.length && <li>No booking activity yet.</li>}
            </ul>
          </Panel>
        </div>
      )}
    </AdminShell>
  );
}

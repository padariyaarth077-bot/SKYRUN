import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/admin-shell";
import { BookingDeposits } from "@/components/booking-deposits";
import { regularReviewSchema } from "@/lib/regular-booking.shared";
import { regularConfirmationTemplate } from "@/lib/regular-confirmation";
import type { Database } from "@/integrations/supabase/types";

type Approval = Database["public"]["Tables"]["regular_ride_approvals"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export function RegularRequests() {
  const [rows, setRows] = useState<Approval[]>([]),
    [page, setPage] = useState(0),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    supabase
      .from("regular_ride_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .order("ride_request_id")
      .range(page * 25, page * 25 + 24)
      .then((result) => {
        if (!live) return;
        if (result.error) {
          setRows([]);
          setError("Regular approval records unavailable. Check local migration and permissions.");
        } else setRows(result.data ?? []);
      });
    return () => {
      live = false;
    };
  }, [page, refresh]);
  return (
    <Panel title="Regular ride approvals">
      <div className="space-y-3 p-4">
        <p>
          Category requests reviewed by authorized management. Payment is not requested during
          booking.
        </p>
        <button
          className="text-blue-700 underline"
          onClick={() => setRefresh((value) => value + 1)}
        >
          Refresh Regular requests
        </button>
        {error && <p role="alert">{error}</p>}
        {!error && !rows.length && <p>No Regular approvals visible in your scope.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["Request", "Category", "Approval", "Pricing", "Submitted"].map((label) => (
                  <th className="p-2" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ride_request_id} className="border-t">
                  <td className="p-2">
                    <Link
                      to="/admin/ride-request/$id"
                      params={{ id: row.ride_request_id }}
                      className="underline"
                    >
                      Review request
                    </Link>
                  </td>
                  <td className="p-2">{row.category_code}</td>
                  <td className="p-2">{row.state.replaceAll("_", " ")}</td>
                  <td className="p-2">
                    {row.approved_amount === null
                      ? "Needs pricing"
                      : `${row.currency} ${row.approved_amount.toFixed(2)}`}
                  </td>
                  <td className="p-2">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button disabled={rows.length < 25} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </Panel>
  );
}

export function RegularApproval({
  requestId,
  onSaved,
}: {
  requestId: string;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<Approval | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [customer, setCustomer] = useState<{
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
  const [activities, setActivities] = useState<
    { id: string; description: string; created_at: string | null }[]
  >([]);
  const [communication, setCommunication] = useState("");
  const [confirmationPreview, setConfirmationPreview] = useState("");
  const [amount, setAmount] = useState(""),
    [basis, setBasis] = useState(""),
    [availability, setAvailability] = useState(""),
    [reason, setReason] = useState(""),
    [attested, setAttested] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const attempt = useRef<{ key: string; id: string } | null>(null),
    inFlight = useRef(false);
  const load = useCallback(async () => {
    setLoaded(false);
    setError("");
    try {
      const result = await supabase
        .from("regular_ride_approvals")
        .select("*")
        .eq("ride_request_id", requestId)
        .maybeSingle();
      if (result.error) throw Error();
      setRow(result.data);
      if (result.data) {
        setAmount(result.data.approved_amount?.toFixed(2) ?? "");
        setBasis(result.data.pricing_basis ?? "");
        const ride = await supabase
          .from("ride_requests")
          .select("customer_id")
          .eq("id", requestId)
          .single();
        if (ride.error) throw Error();
        const contact = await supabase
          .from("customers")
          .select("full_name,email,phone")
          .eq("id", ride.data.customer_id)
          .single();
        if (contact.error) throw Error();
        setCustomer(contact.data);
        const history = await supabase
          .from("activities")
          .select("id,description,created_at")
          .eq("entity_type", "ride_request")
          .eq("entity_id", requestId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (history.error) throw Error();
        setActivities(history.data);
        if (result.data.booking_id) {
          const outbox = await supabase
            .from("communication_outbox")
            .select("*")
            .eq("entity_id", result.data.booking_id)
            .eq("kind", "REGULAR_BOOKING_CONFIRMED")
            .maybeSingle();
          if (outbox.error) throw Error();
          setConfirmationPreview(outbox.data ? regularConfirmationTemplate(outbox.data).text : "");
          setCommunication(
            outbox.data?.state === "HELD"
              ? "Pending — delivery not authorized (held safely)"
              : (outbox.data?.state ?? "No communication recorded"),
          );
        }
      }
    } catch {
      setError("Could not load Regular approval details. Check permission and retry.");
    } finally {
      setLoaded(true);
    }
  }, [requestId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row || inFlight.current) return;
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)
      ?.value;
    const review = regularReviewSchema.safeParse(
      action === "reject"
        ? { action, reason }
        : action === "price"
          ? { action, amount, basis }
          : { action, amount, basis, availability, attested },
    );
    if (!review.success) {
      setMessage("Check the amount, pricing explanation and required review evidence.");
      return;
    }
    const data = review.data,
      key = JSON.stringify({ version: row.version, ...data });
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await supabase.rpc("review_regular_ride", {
        _id: requestId,
        _operation: attempt.current.id,
        _expected: row.version,
        _action: data.action,
        ...(data.action === "reject"
          ? { _reason: data.reason }
          : {
              _amount: Number(data.amount),
              _basis: data.basis,
              ...(data.action === "approve" ? { _availability: data.availability } : {}),
            }),
      });
      if (result.error) throw Error();
      setMessage(
        data.action === "approve"
          ? "Ride confirmed. Payment not requested. Confirmation communication held pending delivery authorization."
          : data.action === "reject"
            ? "Request rejected. No booking or confirmation was created."
            : "Price reviewed. Awaiting availability; ride is not confirmed.",
      );
      attempt.current = null;
      setAttested(false);
      await load();
      onSaved();
    } catch {
      setMessage(
        "Review not saved. Refresh to check the current state, permissions and trip details, then retry safely.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!loaded) return <p role="status">Checking Regular approval workflow…</p>;
  if (error)
    return (
      <p role="alert">
        {error} <button onClick={load}>Retry</button>
      </p>
    );
  if (!row) return null;
  return (
    <Panel title="Regular ride · management review">
      <div className="space-y-4 p-4">
        <p className="font-semibold">
          {row.state.replaceAll("_", " ")} · {row.category_code}
        </p>
        {customer && (
          <p>
            {customer.full_name} · {customer.email} · {customer.phone}
          </p>
        )}
        <p>
          Service: {row.service} · Luggage: {row.luggage_details}
        </p>
        <p>Submitted: {new Date(row.created_at).toLocaleString()} · Trip times: America/Chicago</p>
        <p>
          Payment: NOT REQUESTED · Amount{" "}
          {row.approved_amount === null
            ? "awaiting review"
            : `${row.currency} ${row.approved_amount.toFixed(2)}`}
        </p>
        <p>
          Confirmation requires management to verify category availability; a specific car is not
          promised.
        </p>
        {row.pricing_basis && <p>Pricing basis: {row.pricing_basis}</p>}
        {row.reviewed_at && (
          <p className="break-words">
            Reviewed: {new Date(row.reviewed_at).toLocaleString()} · Staff: {row.reviewed_by}
          </p>
        )}
        {row.booking_id && (
          <>
            <Link
              to="/admin/booking/$id"
              params={{ id: row.booking_id }}
              className="block underline"
            >
              Open confirmed booking
            </Link>
            <p>Confirmation email: {communication}</p>
            {confirmationPreview && (
              <details>
                <summary>Preview held confirmation · not sent</summary>
                <p className="whitespace-pre-wrap break-words">{confirmationPreview}</p>
              </details>
            )}
            <p>Availability evidence: {row.availability_note}</p>
          </>
        )}
        {row.rejection_reason && <p>Rejection reason: {row.rejection_reason}</p>}
        {!row.booking_id && row.state !== "REJECTED" && (
          <form onSubmit={submit} className="regular-review-form">
            <label>
              Approved amount (USD)
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="Exact agreed amount"
              />
            </label>
            <label>
              Pricing basis / inclusions
              <textarea
                value={basis}
                onChange={(event) => setBasis(event.target.value)}
                maxLength={1000}
                placeholder="Explain the approved amount, route, service and included fees"
              />
            </label>
            <p>
              Temporary reference rates do not calculate a final fare. Enter a reviewed amount for
              this complete itinerary.
            </p>
            <label>
              Availability evidence
              <textarea
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                maxLength={1000}
                placeholder="Record who/what you checked and category suitability for this date, passengers and luggage"
              />
            </label>
            <label className="flex-row">
              <input
                type="checkbox"
                checked={attested}
                onChange={(event) => setAttested(event.target.checked)}
              />
              I checked fleet/supplier availability and category suitability for this complete trip.
            </label>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} name="action" value="price" type="submit">
                Save price · await availability
              </button>
              <button disabled={busy || !attested} name="action" value="approve" type="submit">
                Approve & confirm ride
              </button>
            </div>
            <label>
              Rejection reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
              />
            </label>
            <button disabled={busy} type="submit" name="action" value="reject">
              Reject request
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        <details>
          <summary>Recent activity (latest 50)</summary>
          {activities.map((item) => (
            <p key={item.id}>
              {item.description} · {item.created_at}
            </p>
          ))}
        </details>
      </div>
    </Panel>
  );
}

export function BookingWorkflow({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const [regular, setRegular] = useState<Approval | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    supabase
      .from("regular_ride_approvals")
      .select("*")
      .eq("booking_id", booking.id)
      .maybeSingle()
      .then((result) => {
        if (live) {
          setRegular(result.data);
          setError(Boolean(result.error));
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, [booking.id]);
  if (!loaded) return <p>Checking booking workflow…</p>;
  if (error)
    return (
      <p role="alert">Booking workflow could not be verified. Refresh before making changes.</p>
    );
  if (!regular)
    return (
      <Panel title="Deposit and booking operations">
        <BookingDeposits booking={booking} onSaved={onSaved} />
      </Panel>
    );
  return (
    <Panel title="Regular booking · payment separate">
      <div className="space-y-3 p-4">
        <p>
          Ride: {booking.status} · Amount due: {booking.currency} {booking.final_amount?.toFixed(2)}
        </p>
        <p>Payment not requested. No payment has been recorded through this workflow.</p>
        <p>
          Confirmation communication is pending delivery authorization. Square payment links are not
          available in this phase.
        </p>
        <Link
          to="/admin/ride-request/$id"
          params={{ id: regular.ride_request_id }}
          className="underline"
        >
          Approval evidence and communication status
        </Link>
      </div>
    </Panel>
  );
}

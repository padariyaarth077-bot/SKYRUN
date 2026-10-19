import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { depositAmount, depositTotals, type Receipt, type Reversal } from "@/lib/booking-deposits";
import type { Database, Json } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export function BookingDeposits({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]),
    [reversals, setReversals] = useState<Reversal[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false),
    [manage, setManage] = useState(false);
  const [action, setAction] = useState("requirement"),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(""),
    [receiptId, setReceiptId] = useState(""),
    [reason, setReason] = useState("");
  const [attested, setAttested] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setManage(false);
    try {
      const [r, v, permission] = await Promise.all([
        readAll<Receipt>((s, e) =>
          supabase
            .from("booking_deposit_receipts")
            .select("*")
            .eq("booking_id", booking.id)
            .order("recorded_at")
            .order("id")
            .range(s, e),
        ),
        readAll<Reversal>((s, e) =>
          supabase
            .from("booking_deposit_reversals")
            .select("*")
            .eq("booking_id", booking.id)
            .order("created_at")
            .order("id")
            .range(s, e),
        ),
        supabase.rpc("can_manage_booking", { _business_unit_id: booking.business_unit_id }),
      ]);
      if (permission.error) throw permission.error;
      setReceipts(r);
      setReversals(v);
      setManage(permission.data === true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [booking.id, booking.business_unit_id]);
  useEffect(() => {
    void load();
  }, [load]);
  const totals = depositTotals(
    booking.required_deposit_amount ?? null,
    booking.currency,
    receipts,
    reversals,
  );
  const active = ["PENDING", "CONFIRMED"].includes(booking.status);
  const allowReverse = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(booking.status);
  const actions = [
    ...(booking.status === "PENDING" && !receipts.length
      ? [["requirement", "Set explicit deposit requirement"]]
      : []),
    ...(active && booking.required_deposit_amount != null
      ? [
          ["receipt", "Record unverified receipt"],
          ["verify", "Verify funds received externally"],
        ]
      : []),
    ...(allowReverse &&
    receipts.some((r) => r.verified_at && !reversals.some((v) => v.receipt_id === r.id))
      ? [["reverse", "Reverse verified receipt"]]
      : []),
    ...(booking.status === "PENDING" ? [["confirm", "Confirm booking"]] : []),
    ...(active ? [["cancel", "Cancel booking"]] : []),
    ...(booking.status === "CONFIRMED" ? [["complete", "Mark trip completed"]] : []),
  ];
  const current = actions.some(([key]) => key === action) ? action : (actions[0]?.[0] ?? "");
  const block =
    current === "confirm"
      ? booking.required_deposit_amount == null
        ? "Record an explicit deposit requirement first."
        : totals.shortfall! > 0
          ? "Verified, unreversed deposits are insufficient."
          : ""
      : "";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !manage || !current || block) return;
    let payload: Record<string, Json> = {};
    if (["requirement", "receipt"].includes(current)) {
      const parsed = depositAmount.safeParse(amount);
      if (!parsed.success || (current === "receipt" && Number(amount) <= 0)) {
        setMessage("Enter a valid exact amount.");
        return;
      }
      payload["amount"] = amount;
    }
    if (current === "receipt") {
      if (
        !reference.trim() ||
        /https?:\/\/|www\./i.test(reference) ||
        !receivedAt ||
        !Number.isFinite(new Date(receivedAt).getTime())
      ) {
        setMessage("Enter an external transaction reference and received date; no receipt URLs.");
        return;
      }
      payload = {
        ...payload,
        reference: reference.trim(),
        currency: booking.currency,
        receivedAt: new Date(receivedAt).toISOString(),
      };
    }
    if (["verify", "reverse"].includes(current)) {
      if (!receiptId) {
        setMessage("Select a receipt.");
        return;
      }
      payload["receiptId"] = receiptId;
    }
    if (["cancel", "reverse"].includes(current)) {
      if (!reason.trim()) {
        setMessage("A reason is required.");
        return;
      }
      payload["reason"] = reason.trim();
    }
    if (["verify", "complete"].includes(current)) {
      if (!attested) {
        setMessage("Explicit staff attestation is required.");
        return;
      }
      payload["attested"] = true;
    }
    const fingerprint = JSON.stringify([booking.id, booking.updated_at, current, payload]);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await supabase.rpc("phase4_booking_action", {
        _booking_id: booking.id,
        _operation_id: attempt.current.id,
        _action: current,
        _payload: payload,
        _expected_updated_at: booking.updated_at,
      });
      if (result.error || result.data !== booking.id) throw new Error();
      attempt.current = null;
      setAmount("");
      setReference("");
      setReceivedAt("");
      setReason("");
      setReceiptId("");
      setAttested(false);
      setMessage("Saved. Booking and audit history updated.");
      onSaved();
    } catch {
      setMessage(
        "Could not save. Your entries are preserved. Retry the same action, or refresh to check for changed booking state or a duplicate reference.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (loading) return <p role="status">Loading deposit evidence…</p>;
  if (loadError)
    return (
      <p role="alert">
        Could not load deposit evidence. Phase 4 migration may be unavailable.{" "}
        <button onClick={load}>Retry</button>
      </p>
    );
  return (
    <section aria-label="Booking deposits" className="space-y-4 p-4">
      <h2 className="font-semibold">Deposits received externally</h2>
      <p>
        Required:{" "}
        {booking.required_deposit_amount == null
          ? "Missing — confirmation blocked"
          : `${booking.currency} ${booking.required_deposit_amount.toFixed(2)}`}
      </p>
      <p>
        Eligible verified total: {booking.currency} {totals.eligible.toFixed(2)} · Shortfall:{" "}
        {totals.shortfall === null ? "Requirement missing" : totals.shortfall.toFixed(2)}
      </p>
      {booking.confirmed_at &&
        reversals.some((r) => new Date(r.created_at) >= new Date(booking.confirmed_at!)) && (
          <p role="alert">
            Payment exception: receipt reversed after booking processing. Review the evidence.
            Status is preserved; no refund or cancellation was performed.
          </p>
        )}
      {!receipts.length ? (
        <p>No deposit receipts recorded.</p>
      ) : (
        <ul>
          {receipts.map((r) => (
            <li key={r.id} className="border-b py-2">
              <p>
                {r.external_reference} · {r.currency} {r.amount.toFixed(2)} · received{" "}
                {new Date(r.received_at).toLocaleString()}
              </p>
              <p>
                Recorded by {r.recorded_by} ·{" "}
                {r.verified_at
                  ? `Verified by ${r.verified_by} at ${new Date(r.verified_at).toLocaleString()}`
                  : "Unverified — does not count"}
              </p>
              {reversals
                .filter((v) => v.receipt_id === r.id)
                .map((v) => (
                  <p key={v.id}>
                    Reversed: {v.reason} · {v.actor_id} · {new Date(v.created_at).toLocaleString()}
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}
      {manage && actions.length > 0 && (
        <form onSubmit={submit} className="space-y-3">
          <fieldset disabled={pending} className="space-y-3">
            <label className="block">
              Action{" "}
              <select
                aria-label="Booking action"
                value={current}
                disabled={pending}
                onChange={(e) => {
                  setAction(e.target.value);
                  setAttested(false);
                  setMessage("");
                }}
              >
                {actions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {["requirement", "receipt"].includes(current) && (
              <label className="block">
                Amount ({booking.currency}){" "}
                <input
                  aria-label="Deposit amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
            )}
            {current === "requirement" && (
              <p>Zero is an explicit staff decision. Requirements lock when any receipt exists.</p>
            )}
            {current === "receipt" && (
              <>
                <label className="block">
                  External transaction reference{" "}
                  <input
                    value={reference}
                    maxLength={200}
                    onChange={(e) => setReference(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  Received date and time{" "}
                  <input
                    type="datetime-local"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                    required
                  />
                </label>
                <p>
                  Use only a transaction reference, never bank credentials, card details or public
                  receipt URLs.
                </p>
              </>
            )}
            {["verify", "reverse"].includes(current) && (
              <label className="block">
                Receipt{" "}
                <select
                  aria-label="Receipt"
                  value={receiptId}
                  onChange={(e) => setReceiptId(e.target.value)}
                  required
                >
                  <option value="">Select receipt</option>
                  {receipts
                    .filter((r) =>
                      current === "verify"
                        ? !r.verified_at
                        : r.verified_at && !reversals.some((v) => v.receipt_id === r.id),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.external_reference}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {["cancel", "reverse"].includes(current) && (
              <label className="block">
                Reason{" "}
                <textarea
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </label>
            )}
            {["verify", "complete"].includes(current) && (
              <label className="block">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                />
                {current === "verify"
                  ? "I verified that these funds were actually received externally."
                  : "I confirm that this trip occurred."}
              </label>
            )}
            {block && <p role="status">{block}</p>}
            <button
              type="submit"
              disabled={
                pending || !!block || (["verify", "complete"].includes(current) && !attested)
              }
              className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save booking action"}
            </button>
          </fieldset>
        </form>
      )}
      {!manage && (
        <p>Read-only. An authorized booking manager must perform deposit and status actions.</p>
      )}
      {!active && (
        <p>
          This booking state has no Phase 4 lifecycle transitions. Verified receipts may still be
          reversed for an accurate financial history.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

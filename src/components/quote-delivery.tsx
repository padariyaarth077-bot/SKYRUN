import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getQuoteDeliveryStatus, sendQuoteEmail } from "@/lib/quote-delivery.functions";
import { deliveryFailure } from "@/lib/quote-delivery.shared";
const descriptions: Record<string, string> = {
  NOT_PREPARED: "Not sent. Staff must review and click Send Quote.",
  PREPARED: "Prepared, not confirmed sent.",
  IN_FLIGHT: "Email request in progress. Refresh its status before retrying.",
  UNCERTAIN:
    "Sending outcome is uncertain. A retry uses the same delivery; it does not create a new email.",
  PROVIDER_ACCEPTED: "Resend accepted the email. Delivery is not yet verified.",
  DELIVERED:
    "Delivery to the recipient's mail server is verified. Customer acceptance is a separate step.",
  FAILED:
    "Delivery failed or was reported as spam. Customer acceptance is blocked; review before preparing a replacement quote.",
  REVOKED: "This acceptance link has been revoked. It cannot be sent or accepted.",
};
type Status = Extract<Awaited<ReturnType<typeof getQuoteDeliveryStatus>>, { ok: true }>;
type Props = {
  quoteId: string;
  updatedAt: string;
  rideUpdatedAt: string | null;
  recipient: string;
  eligible: boolean;
  unsavedChanges: boolean;
  onFrozenChange: (value: boolean) => void;
  onStatusChanged?: () => void;
};
export function QuoteDelivery(props: Props) {
  const { quoteId, onFrozenChange } = props;
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const newId = useRef(crypto.randomUUID()),
    busy = useRef(false);
  const headers = async () => {
    const session = await supabase.auth.getSession();
    if (session.error || !session.data.session) throw new Error();
    return { Authorization: `Bearer ${session.data.session.access_token}` };
  };
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getQuoteDeliveryStatus({
        data: { quoteId },
        headers: await headers(),
      });
      if (!result.ok) {
        setError(result.message);
        setStatus(null);
        return null;
      }
      setStatus(result);
      onFrozenChange(result.frozen);
      return result;
    } catch {
      setError("Could not load saved delivery status. Sign in and retry.");
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [quoteId, onFrozenChange]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    setReviewed(false);
  }, [props.quoteId, props.updatedAt, props.recipient]);
  const send = async () => {
    if (busy.current || !status?.enabled || !reviewed || props.unsavedChanges || !props.eligible)
      return;
    busy.current = true;
    setSending(true);
    setError("");
    try {
      const result = await sendQuoteEmail({
        data: {
          quoteId: props.quoteId,
          deliveryId: status.deliveryId ?? newId.current,
          expectedUpdatedAt: props.updatedAt,
          expectedRideUpdatedAt: props.rideUpdatedAt,
          reviewedRecipient: status.recipient ?? props.recipient,
        },
        headers: await headers(),
      });
      const saved = await refresh();
      if (!result.ok) setError(result.message);
      if (result.ok && saved?.state === "DELIVERED") props.onStatusChanged?.();
    } catch {
      setError(deliveryFailure);
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  const canSend =
    status &&
    status.retryAllowed !== false &&
    ["NOT_PREPARED", "PREPARED", "UNCERTAIN"].includes(status.state);
  return (
    <div className="space-y-3 p-4">
      <p>
        Emails are sent only after a staff member reviews the saved quote and clicks Send Quote. New
        enquiries never send quotes automatically.
      </p>
      {loading && <p role="status">Loading delivery status…</p>}
      {status && (
        <>
          <p role="status">{descriptions[status.state]}</p>
          {status.retryAllowed === false && status.state === "UNCERTAIN" && (
            <p>
              Automatic retry is disabled. Reconcile this delivery before preparing a replacement
              quote.
            </p>
          )}
          <p>
            Recipient:{" "}
            <strong>
              {(status.recipient ?? props.recipient) || "No customer email available"}
            </strong>
          </p>
          {status.isTest && (
            <p>
              TEST MODE: only padariyaarth077@gmail.com can receive a clearly labelled test quote.
            </p>
          )}
          {!status.enabled ? (
            <p>
              Email sending is disabled until the approved database, secrets and webhook
              configuration are ready.
            </p>
          ) : (
            canSend && (
              <>
                {props.unsavedChanges && <p>Save your draft changes before sending.</p>}
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    disabled={sending}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  I reviewed this recipient, the saved trip, amount, currency and expiry, and
                  approve sending this quote.
                </label>
                <button
                  className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40"
                  disabled={
                    !reviewed ||
                    sending ||
                    loading ||
                    !props.eligible ||
                    props.unsavedChanges ||
                    !(status.recipient ?? props.recipient)
                  }
                  onClick={() => void send()}
                >
                  {sending
                    ? "Requesting delivery…"
                    : status.state === "UNCERTAIN"
                      ? "Retry same delivery"
                      : "Send Quote"}
                </button>
              </>
            )
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="underline disabled:opacity-40"
        disabled={loading || sending}
        onClick={() =>
          void refresh().then((saved) => {
            if (saved) props.onStatusChanged?.();
          })
        }
      >
        Refresh delivery status
      </button>
    </div>
  );
}

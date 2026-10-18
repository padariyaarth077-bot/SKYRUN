import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { customerQuoteAcceptance } from "@/lib/quote-acceptance.functions";
import {
  acceptanceFailure,
  acceptanceTokenSchema,
  type CustomerQuote,
} from "@/lib/quote-acceptance.shared";

export const Route = createFileRoute("/quote/accept")({
  head: () => ({
    meta: [
      { title: "Review your quote — Skyrun Limo" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: QuoteAcceptancePage,
});

export function QuoteAcceptancePage() {
  const token = useRef("");
  const busy = useRef(false);
  const initialized = useRef(false);
  const [quote, setQuote] = useState<CustomerQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [failedSave, setFailedSave] = useState(false);

  async function request(accept: boolean) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setFailedSave(false);
    if (accept) setSaving(true);
    else setLoading(true);
    try {
      const result = await customerQuoteAcceptance({ data: { token: token.current, accept } });
      if (!result.ok) {
        setError(
          accept
            ? "Acceptance could not be confirmed. Retry or check this link again before making another enquiry."
            : result.message,
        );
        setFailedSave(accept);
      } else setQuote(result.quote);
    } catch {
      setError(
        accept
          ? "Acceptance could not be confirmed. Retry or check this link again before making another enquiry."
          : acceptanceFailure,
      );
      setFailedSave(accept);
    } finally {
      busy.current = false;
      setLoading(false);
      setSaving(false);
    }
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Fragment is never sent in the page GET/referrer; remove it from this history entry.
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!acceptanceTokenSchema.safeParse(value).success) {
      setError(acceptanceFailure);
      setLoading(false);
      return;
    }
    token.current = value!;
    void request(false);
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <section className="mx-auto max-w-xl space-y-5 rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold">Skyrun Limo — review your quote</h1>
        {loading && <p role="status">Loading your quote…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            {token.current && !saving && (
              <button className="mt-3 underline" onClick={() => void request(false)}>
                Check quote again
              </button>
            )}
          </div>
        )}
        {!loading && quote && (
          <>
            <dl className="space-y-2">
              <dt>Quote reference</dt>
              <dd>{quote.quoteId}</dd>
              <dt>Pickup</dt>
              <dd>{quote.pickup}</dd>
              <dt>Drop-off</dt>
              <dd>{quote.dropoff}</dd>
              <dt>Travel date and pickup time</dt>
              <dd>
                {quote.travelDate} · {quote.pickupTime ?? "Not specified"}
              </dd>
              <dt>Trip type</dt>
              <dd>{quote.tripType}</dd>
              <dt>Passengers</dt>
              <dd>{quote.passengers}</dd>
              {quote.returnDate && (
                <>
                  <dt>Return</dt>
                  <dd>
                    {quote.returnDate} · {quote.returnTime ?? "Not specified"}
                  </dd>
                </>
              )}
              {quote.hourlyDuration !== null && (
                <>
                  <dt>Hours</dt>
                  <dd>{quote.hourlyDuration}</dd>
                </>
              )}
              {quote.flightNumber && (
                <>
                  <dt>Flight</dt>
                  <dd>{quote.flightNumber}</dd>
                </>
              )}
              <dt>Quoted amount</dt>
              <dd className="text-xl font-semibold">
                {quote.currency} {quote.amount}
              </dd>
              <dt>Valid until</dt>
              <dd>{new Date(quote.expiresAt).toLocaleString()}</dd>
            </dl>
            {quote.accepted ? (
              <div role="status">
                <p>Quote accepted. Booking reference: {quote.bookingReference}</p>
                <p>
                  {quote.bookingStatus === "PENDING"
                    ? "Your booking is pending operational confirmation."
                    : `Booking status: ${quote.bookingStatus}.`}{" "}
                  Contact support for operational details.
                </p>
              </div>
            ) : (
              <>
                <p>
                  Review these trip details and the quoted amount before accepting. Acceptance
                  creates a pending booking; it does not confirm a ride.
                </p>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    disabled={saving}
                    onChange={(event) => setAgreed(event.target.checked)}
                  />
                  I have reviewed and accept this quote and its trip details.
                </label>
                <button
                  className="rounded bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
                  disabled={!agreed || saving || (!!error && !failedSave)}
                  onClick={() => void request(true)}
                >
                  {saving
                    ? "Recording acceptance…"
                    : failedSave
                      ? "Retry acceptance"
                      : "Accept quote"}
                </button>
              </>
            )}
          </>
        )}
        <p>
          Questions?{" "}
          <a className="underline" href="mailto:support@skyrunlimo.com">
            support@skyrunlimo.com
          </a>
        </p>
      </section>
    </main>
  );
}

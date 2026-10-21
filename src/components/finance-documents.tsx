import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Printer, ShieldCheck } from "lucide-react";
import { AdminShell, Panel, StatusBadge } from "@/components/admin-shell";
import { Reports } from "@/components/reports";
import { supabase } from "@/integrations/supabase/client";
import {
  draftDescription,
  evidenceEligible,
  saveFinance,
  snapshotText,
  type DocumentProfile,
  type InvoiceDraft,
} from "@/lib/finance";
import { useOperationsPermission } from "@/lib/operations-hooks";
import type { Database, Json } from "@/integrations/supabase/types";
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Receipt = Database["public"]["Tables"]["booking_deposit_receipts"]["Row"];
type Activity = Database["public"]["Tables"]["activities"]["Row"];
export function FinanceList({
  kind,
  search = "",
}: {
  kind: "invoices" | "receipts";
  search?: string;
}) {
  return (
    <Reports
      key={kind}
      initialKind={kind}
      initialSearch={search}
      heading={kind === "invoices" ? "Invoice Drafts" : "Payment Evidence Previews"}
      lockedKind
    />
  );
}
function DraftForm({
  booking,
  draft,
  onSaved,
}: {
  booking: Booking;
  draft: InvoiceDraft | null;
  onSaved: (id: string) => void;
}) {
  const permission = useOperationsPermission(booking.business_unit_id),
    [description, setDescription] = useState(draft?.description ?? ""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    retry = useRef({ signature: "", id: "" });
  if (permission !== "allowed")
    return (
      <p className="p-5">
        {permission === "loading"
          ? "Checking financial permission…"
          : "Financial drafts require verified management permission."}
      </p>
    );
  const eligible =
    Boolean(draft) ||
    (booking.final_amount !== null &&
      ["PENDING", "CONFIRMED", "COMPLETED"].includes(booking.status));
  return (
    <form
      className="space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        const parsed = draftDescription.safeParse(description);
        if (!parsed.success) {
          setMessage("Enter a description between 1 and 2,000 characters.");
          return;
        }
        busy.current = true;
        setPending(true);
        setMessage("");
        const signature = JSON.stringify([booking.id, parsed.data, draft?.updated_at]);
        if (retry.current.signature !== signature)
          retry.current = { signature, id: crypto.randomUUID() };
        try {
          const id = await saveFinance(
            "draft",
            booking.id,
            { description: parsed.data },
            draft?.updated_at ?? null,
            retry.current.id,
          );
          retry.current = { signature: "", id: "" };
          onSaved(id);
        } catch {
          setMessage(
            "Could not confirm save. Description is preserved. Refresh to check for an existing draft or retry safely.",
          );
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <label>
        Draft description
        <textarea
          className="block w-full border p-3"
          value={description}
          maxLength={2000}
          disabled={pending}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Amount and currency are copied from the stored booking, not invented or treated as payment.
        One draft per booking. Saved customer/business snapshots are retained; editing changes only
        the description.
      </p>
      <button
        className="bg-primary px-4 py-2 text-primary-foreground"
        disabled={pending || !eligible || !description.trim()}
      >
        {pending ? "Saving…" : "Save invoice draft"}
      </button>
      {!eligible && (
        <p>Booking state and an agreed amount are required before a draft can be saved.</p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export function FinanceDocument({
  kind,
  id,
  bookingId,
}: {
  kind: "invoice" | "receipt";
  id: string;
  bookingId?: string | undefined;
}) {
  const [booking, setBooking] = useState<Booking | null>(null),
    [draft, setDraft] = useState<InvoiceDraft | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [profile, setProfile] = useState<DocumentProfile | null>(null),
    [customer, setCustomer] = useState<{ name: string; email: string } | null>(null),
    [acts, setActs] = useState<Activity[]>([]),
    [eligible, setEligible] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setDraft(null);
    setReceipt(null);
    setBooking(null);
    setProfile(null);
    setCustomer(null);
    setActs([]);
    setEligible(false);
    try {
      let bookingRef = bookingId;
      let d: InvoiceDraft | null = null,
        r: Receipt | null = null;
      if (kind === "invoice" && id !== "new") {
        const result = await supabase.from("invoice_drafts").select("*").eq("id", id).maybeSingle();
        if (result.error || !result.data) throw Error();
        d = result.data;
        bookingRef = d.booking_id;
        setDraft(d);
      }
      if (kind === "receipt") {
        const result = await supabase
          .from("booking_deposit_receipts")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (result.error || !result.data) throw Error();
        r = result.data;
        bookingRef = r.booking_id;
        setReceipt(r);
      }
      if (!bookingRef) throw Error();
      const b = await supabase.from("bookings").select("*").eq("id", bookingRef).maybeSingle();
      if (b.error || !b.data) throw Error();
      const permission = await supabase.rpc("can_manage_booking", {
        _business_unit_id: b.data.business_unit_id,
      });
      if (permission.error || permission.data !== true) throw Error();
      setBooking(b.data);
      if (kind === "invoice" && id === "new") {
        const existing = await supabase
          .from("invoice_drafts")
          .select("*")
          .eq("booking_id", b.data.id)
          .eq("business_unit_id", b.data.business_unit_id)
          .maybeSingle();
        if (existing.error) throw Error();
        d = existing.data;
        setDraft(d);
      }
      const [p, c] = await Promise.all([
        supabase
          .from("document_profiles")
          .select("*")
          .eq("business_unit_id", b.data.business_unit_id)
          .maybeSingle(),
        supabase
          .from("customers")
          .select("id,full_name,email")
          .eq("id", b.data.customer_id)
          .eq("business_unit_id", b.data.business_unit_id)
          .maybeSingle(),
      ]);
      if (p.error || c.error || !c.data) throw Error();
      setProfile(p.data);
      setCustomer({ name: c.data.full_name, email: c.data.email ?? "" });
      if (
        d &&
        (d.business_unit_id !== b.data.business_unit_id || d.customer_id !== b.data.customer_id)
      )
        throw Error();
      if (r) {
        const rev = await supabase
          .from("booking_deposit_reversals")
          .select("id")
          .eq("receipt_id", r.id);
        if (rev.error) throw Error();
        setEligible(evidenceEligible(r, b.data, Boolean(rev.data?.length)));
      }
      if (d) {
        const events = await supabase
          .from("activities")
          .select("*")
          .eq("business_unit_id", b.data.business_unit_id)
          .eq("entity_type", "invoice_draft")
          .eq("entity_id", d.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (events.error) throw Error();
        setActs(events.data ?? []);
      }
    } catch {
      setError(
        "Document unavailable. Check management access, linked records and the approved Phase 7 database update.",
      );
    } finally {
      setLoading(false);
    }
  }, [kind, id, bookingId]);
  useEffect(() => {
    void load();
  }, [load]);
  const company: Json =
      draft?.business_snapshot ?? (profile ? JSON.parse(JSON.stringify(profile)) : {}),
    client: Json =
      draft?.customer_snapshot ?? (customer ? { name: customer.name, email: customer.email } : {});
  const canPrint = Boolean(draft) || (kind === "receipt" && eligible);
  return (
    <AdminShell
      title={kind === "invoice" ? "Invoice draft" : "Payment evidence preview"}
      subtitle="Official invoice/receipt issuance is disabled while business numbering and issuance rules are deferred"
      actions={
        <button
          disabled={!canPrint || loading || Boolean(error)}
          className="no-print inline-flex items-center gap-2 border px-4 py-2"
          onClick={async () => {
            if (kind === "receipt" && receipt && booking) {
              try {
                const [fresh, rev] = await Promise.all([
                  supabase
                    .from("booking_deposit_receipts")
                    .select("*")
                    .eq("id", receipt.id)
                    .maybeSingle(),
                  supabase
                    .from("booking_deposit_reversals")
                    .select("id")
                    .eq("receipt_id", receipt.id),
                ]);
                if (
                  fresh.error ||
                  rev.error ||
                  !fresh.data ||
                  !evidenceEligible(fresh.data, booking, Boolean(rev.data?.length))
                ) {
                  setEligible(false);
                  setError(
                    "Payment eligibility changed or could not be verified. Refresh the booking before printing.",
                  );
                  return;
                }
              } catch {
                setError("Could not recheck payment eligibility. Retry before printing.");
                return;
              }
            }
            window.print();
          }}
        >
          <Printer aria-hidden="true" className="size-4" />
          Print / Save PDF preview
        </button>
      }
    >
      <a
        className="no-print text-primary underline"
        href={"/admin/m/" + (kind === "invoice" ? "invoices" : "receipts")}
      >
        ← {kind === "invoice" ? "Invoice drafts" : "Payment evidence"}
      </a>
      {loading ? (
        <p role="status" className="p-5">
          Loading document…
        </p>
      ) : error ? (
        <p role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      ) : (
        booking && (
          <div className="mt-5 space-y-5">
            <div className="no-print flex flex-wrap gap-4 rounded-xl border bg-card p-4">
              <a className="underline" href={"/admin/booking/" + booking.id}>
                Booking {booking.booking_number}
              </a>
              <a className="underline" href={"/admin/customer/" + booking.customer_id}>
                Customer history
              </a>
              {booking.quote_id && (
                <a className="underline" href={"/admin/quote/" + booking.quote_id}>
                  Accepted quote
                </a>
              )}
              <StatusBadge status={booking.status} />
            </div>
            {kind === "invoice" && (
              <Panel title="Draft preparation">
                <DraftForm
                  key={draft?.updated_at ?? booking.id}
                  booking={booking}
                  draft={draft}
                  onSaved={(saved) => {
                    if (saved !== id) window.location.assign("/admin/document/invoice/" + saved);
                    else void load();
                  }}
                />
              </Panel>
            )}
            {kind === "receipt" && !eligible && (
              <p role="alert">
                This evidence is unverified, reversed, mismatched or unavailable. It cannot support
                a payment preview or receipt. Original evidence/history remains on the booking.
              </p>
            )}
            {(draft || (kind === "receipt" && eligible)) && (
              <article className="financial-print space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {snapshotText(company, "legal_name") || "Business name not configured"}
                    </h2>
                    <p className="whitespace-pre-wrap">
                      {snapshotText(company, "address") || "Business address not configured"}
                    </p>
                    <p>
                      {snapshotText(company, "email")} {snapshotText(company, "phone")}
                    </p>
                  </div>
                  <span className="rounded-xl bg-amber-50 px-4 py-2 font-semibold text-amber-900">
                    {draft ? "DRAFT — NOT ISSUED" : "PAYMENT PREVIEW — NOT AN ISSUED RECEIPT"}
                  </span>
                </div>
                <p className="no-print break-all text-sm">
                  Internal record ID: {draft?.id ?? receipt?.id}. This is not an official document
                  number.
                </p>
                <div>
                  <h3 className="font-semibold">Customer</h3>
                  <p>{snapshotText(client, "name")}</p>
                  <p>{snapshotText(client, "email")}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Currency</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="max-w-md whitespace-pre-wrap break-words">
                          {draft?.description ?? "Verified external deposit evidence"}
                        </td>
                        <td>{draft?.currency ?? receipt?.currency}</td>
                        <td>{(draft?.amount ?? receipt?.amount)?.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  {draft
                    ? "Booking value shown; no assertion of payment, tax treatment or amount currently due."
                    : "This preview reflects one verified, unreversed payment evidence record. It is not a newly issued financial receipt."}
                </p>
                {receipt && (
                  <p>
                    Received: {new Date(receipt.received_at).toISOString()} · Evidence verified:{" "}
                    {receipt.verified_at
                      ? new Date(receipt.verified_at).toISOString()
                      : "Not verified"}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{snapshotText(company, "payment_terms")}</p>
                <footer className="whitespace-pre-wrap border-t pt-4 text-sm">
                  {snapshotText(company, "footer")}
                </footer>
              </article>
            )}
            {draft && (
              <Panel title="Draft activity — latest 50">
                <ul className="space-y-3 p-5">
                  {acts.map((a) => (
                    <li key={a.id}>
                      <FileText className="mr-2 inline size-4 text-violet-600" aria-hidden="true" />
                      {a.description} · {a.created_at} · Actor {a.actor_id ?? "System"}
                    </li>
                  ))}
                  {!acts.length && <li>No recorded draft activity.</li>}
                </ul>
              </Panel>
            )}
            <p className="no-print text-sm text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mr-1 inline size-4" />
              No sending, payment collection, official numbering or tax calculation is performed.
              Use the booking to inspect authoritative deposit verification/reversal history.
            </p>
          </div>
        )
      )}
    </AdminShell>
  );
}

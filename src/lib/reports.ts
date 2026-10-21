import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
export const REPORTS = {
  enquiries: "Enquiry report",
  quotes: "Quote report",
  bookings: "Booking report",
  customers: "Customer activity",
  deposits: "Deposit evidence",
  invoices: "Invoice drafts",
  receipts: "Payment evidence",
  audit: "Audit history",
} as const;
export type ReportKind = keyof typeof REPORTS;
export type ReportRow = Record<string, string | number | boolean | null>;
export type ReportResult = { rows: ReportRow[]; total: number };
const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Enter a valid date",
  );
export const reportFilters = z
  .object({
    kind: z.enum([
      "enquiries",
      "quotes",
      "bookings",
      "customers",
      "deposits",
      "invoices",
      "receipts",
      "audit",
    ]),
    from: date,
    to: date,
    status: z.string().max(40),
    source: z.string().max(40),
    search: z.string().trim().max(120),
    unit: z.union([z.literal(""), z.string().uuid()]),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, "Start date must not follow end date");
export type ReportFilters = z.infer<typeof reportFilters>;
export const emptyFilters = (kind: ReportKind): ReportFilters => ({
  kind,
  from: "",
  to: "",
  status: "",
  source: "",
  search: "",
  unit: "",
});
export async function fetchReport(
  filters: ReportFilters,
  offset = 0,
  limit = 50,
): Promise<ReportResult> {
  const f = reportFilters.parse(filters);
  const result = await supabase.rpc("phase7_report", {
    _kind: f.kind,
    _from: f.from || null,
    _to: f.to || null,
    _status: f.status,
    _source: f.source,
    _search: f.search,
    _unit: f.unit || null,
    _offset: offset,
    _limit: limit,
  });
  if (result.error || !result.data)
    throw new Error(
      "Report unavailable. Check your role, business-unit access and the approved Phase 7 database update, then retry.",
    );
  const data = result.data as unknown as ReportResult;
  if (!Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total < 0)
    throw new Error("Invalid report response.");
  return data;
}
export function reportColumns(kind: ReportKind) {
  const common = ["reference", "customer", "status", "date"];
  return [
    ...common,
    ...(kind === "enquiries"
      ? ["source", "reviewed_at"]
      : kind === "customers"
        ? ["enquiries", "quotes", "bookings"]
        : kind === "deposits"
          ? ["currency", "required", "verified", "shortfall", "payment_exception"]
          : kind === "audit"
            ? ["actor", "entity_type", "business_unit_id"]
            : ["amount", "currency"]),
  ];
}
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportCsv(kind: ReportKind, rows: ReportRow[]) {
  const columns = reportColumns(kind);
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(","),
      ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")),
    ].join("\r\n")
  );
}
export async function exportReport(filters: ReportFilters) {
  const result = await fetchReport(filters, 0, 10000);
  if (result.total > 10000)
    throw new Error("Export exceeds 10,000 rows. Narrow the date range or filters.");
  const rows = result.rows;
  if (!rows.length) throw new Error("No matching records to export.");
  if (rows.length !== result.total)
    throw new Error("Incomplete export. Narrow the date range and retry.");
  return reportCsv(filters.kind, rows);
}
export function entityDestination(type: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const paths: Record<string, string> = {
    lead: "/admin/leads/",
    customer: "/admin/customer/",
    booking: "/admin/booking/",
    quote: "/admin/quote/",
    ride_request: "/admin/ride-request/",
    invoice_draft: "/admin/document/invoice/",
    payment_evidence: "/admin/document/receipt/",
  };
  return paths[type] ? paths[type] + id : null;
}

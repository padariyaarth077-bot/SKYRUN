import { useEffect, useRef, useState } from "react";
import { BarChart3, Download, Filter, RefreshCw } from "lucide-react";
import { AdminShell, Panel } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import {
  REPORTS,
  emptyFilters,
  fetchReport,
  exportReport,
  entityDestination,
  reportColumns,
  type ReportKind,
  type ReportResult,
} from "@/lib/reports";
export function Reports({
  initialKind = "enquiries",
  auditOnly = false,
  heading,
  lockedKind = false,
  initialSearch = "",
}: {
  initialKind?: ReportKind;
  auditOnly?: boolean;
  heading?: string;
  lockedKind?: boolean;
  initialSearch?: string;
}) {
  const [filters, setFilters] = useState({ ...emptyFilters(initialKind), search: initialSearch }),
    [page, setPage] = useState(0),
    [data, setData] = useState<ReportResult>({ rows: [], total: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [exporting, setExporting] = useState(false),
    [notice, setNotice] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void fetchReport(filters, page * 50)
        .then((r) => {
          if (active) setData(r);
        })
        .catch(() => {
          if (active)
            setError(
              "Could not load report. Check access and the approved Phase 7 database update, then retry.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, page, revision]);
  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    setNotice("");
    try {
      const csv = await exportReport(filters),
        url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `skyrun-${filters.kind}-${filters.from || "all"}-${filters.to || "dates"}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("CSV downloaded using the active filters.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not export.");
    } finally {
      busy.current = false;
      setExporting(false);
    }
  };
  const columns = reportColumns(filters.kind);
  return (
    <AdminShell
      title={heading ?? (auditOnly ? "Audit Log" : "Reports")}
      subtitle="Authoritative records, clear financial definitions and scoped exports"
      actions={
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 border px-3 py-2"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground"
            disabled={loading || exporting || Boolean(error)}
            onClick={() => void download()}
          >
            <Download className="size-4" aria-hidden="true" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      }
    >
      <div className="mb-5 flex gap-3 rounded-2xl border bg-card p-5">
        <span className="rounded-xl bg-violet-100 p-3 text-violet-600">
          <BarChart3 aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h2 className="font-semibold">{REPORTS[filters.kind]}</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading matching records…"
              : error
                ? "Report unavailable"
                : `${data.total} matching records`}
          </p>
        </div>
      </div>
      <Panel title="Report filters">
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {!auditOnly && !lockedKind && (
            <label>
              Report
              <select
                className="block w-full border p-2"
                value={filters.kind}
                onChange={(e) => {
                  setFilters(emptyFilters(e.target.value as ReportKind));
                  setPage(0);
                }}
              >
                {Object.entries(REPORTS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(
            [
              ["from", "From date"],
              ["to", "To date"],
              ["search", "Search"],
              ["status", "Exact status / action"],
              ["source", "Exact source (enquiries)"],
              ["unit", "Business unit ID (optional)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                className="block w-full border p-2"
                type={key === "from" || key === "to" ? "date" : "text"}
                maxLength={key === "search" ? 120 : key === "status" ? 40 : undefined}
                value={filters[key]}
                onChange={(e) => {
                  setFilters((v) => ({ ...v, [key]: e.target.value }));
                  setPage(0);
                }}
              />
            </label>
          ))}
        </div>
      </Panel>
      <p className="my-4 text-sm text-muted-foreground">
        <Filter className="mr-1 inline size-4" aria-hidden="true" />
        Booking/deposit reports filter trip dates; payment evidence filters received date; other
        reports filter creation dates. Timestamp boundaries are UTC. Quote/booking values are not
        payments. Stored quote statuses are not inferred delivery or expiry. Financial reports
        require management permission. CSV is capped at 10,000 rows in one database snapshot.
      </p>
      {notice && (
        <p role="status" className="mb-4">
          {notice}
        </p>
      )}
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4">
                    {c.replaceAll("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="p-8" role="status">
                    Loading report…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columns.length} className="p-6" role="alert">
                    {error} <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
                  </td>
                </tr>
              ) : !data.rows.length ? (
                <tr>
                  <td className="p-8" colSpan={columns.length}>
                    No matching records. Change the filters or date range.
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={String(r["activity_id"] ?? r["id"] ?? i)} className="border-t">
                    {columns.map((c, index) => {
                      const link =
                        index === 0
                          ? entityDestination(String(r["entity_type"]), String(r["id"]))
                          : null;
                      return (
                        <td key={c} className="max-w-xs whitespace-pre-wrap break-words px-4">
                          {link ? (
                            <a className="font-medium text-primary underline" href={link}>
                              {String(r[c] ?? "—")}
                            </a>
                          ) : r[c] === null || r[c] === undefined ? (
                            "—"
                          ) : typeof r[c] === "boolean" ? (
                            r[c] ? (
                              "Yes"
                            ) : (
                              "No"
                            )
                          ) : (
                            String(r[c])
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {!loading && !error && <AdminPagination page={page} total={data.total} onChange={setPage} />}
      <p className="mt-4 text-xs text-muted-foreground">
        Invoice drafts and payment previews are not issued financial documents. Official numbering,
        tax treatment and issuance remain pending business approval.
      </p>
    </AdminShell>
  );
}

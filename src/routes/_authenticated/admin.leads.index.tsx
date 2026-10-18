import { AdminPagination } from "@/components/admin-pagination";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AdminShell, Panel, StatusBadge, timeAgo } from "@/components/admin-shell";
import {
  fetchLeads,
  setLeadStatus,
  matchesLeadStatus,
  LEAD_SOURCES,
  ALL_LEAD_STATUSES,
  type Lead,
} from "@/lib/admin-data";
import type { Database } from "@/integrations/supabase/types";

type S = { status?: string | undefined; source?: string | undefined; q?: string | undefined };
type LeadStatus = Database["public"]["Enums"]["lead_status"];

export const Route = createFileRoute("/_authenticated/admin/leads/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    ...(typeof s["status"] === "string" &&
    [...ALL_LEAD_STATUSES, "NEEDS_REVIEW"].includes(s["status"])
      ? { status: s["status"] }
      : {}),
    ...(typeof s["source"] === "string" &&
    LEAD_SOURCES.includes(s["source"] as (typeof LEAD_SOURCES)[number])
      ? { source: s["source"] }
      : {}),
    ...(typeof s["q"] === "string" ? { q: s["q"].slice(0, 200) } : {}),
  }),
  head: () => ({
    meta: [{ title: "Leads — Skyrun Operations Center" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { user } = Route.useRouteContext();
  const { status, source, q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/leads/" });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(0);
  const [oldest, setOldest] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [sel, setSel] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setLeads(await fetchLeads());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const shown = leads.filter((l) => {
    if (!matchesLeadStatus(l.status, status) || (source && l.source !== source)) return false;
    const s =
      `${l.lead_number} ${l.customers?.full_name} ${l.customers?.email} ${l.customers?.phone} ${l.subject}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  useEffect(() => {
    setPage(0);
    setSel([]);
  }, [status, source, q, oldest]);
  const ordered = oldest ? [...shown].reverse() : shown;
  const safePage = Math.min(page, Math.max(0, Math.ceil(shown.length / 50) - 1));
  const visible = ordered.slice(safePage * 50, safePage * 50 + 50);
  const bulk = async (s: LeadStatus, ids = sel) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMutationError("");
    try {
      const results = await Promise.allSettled(ids.map((id) => setLeadStatus(id, s, user.id)));
      const failure = results.find((r) => r.status === "rejected");
      if (failure?.status === "rejected")
        setMutationError(
          failure.reason instanceof Error
            ? failure.reason.message
            : "Could not save lead status. Please retry.",
        );
      setSel([]);
      await load();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const tab = (s?: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${status === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <AdminShell
      title={status === "NEEDS_REVIEW" ? "Needs Review" : "Leads"}
      subtitle={
        loading
          ? "Loading leads…"
          : loadError
            ? "Leads unavailable"
            : `${shown.length} of ${leads.length} leads`
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-1">
          <button className={tab(undefined)} onClick={() => navigate({ search: { q, source } })}>
            All
          </button>
          {ALL_LEAD_STATUSES.map((s) => (
            <button
              key={s}
              className={tab(s)}
              onClick={() => navigate({ search: { status: s, q, source } })}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}{" "}
              <span className="ml-0.5 text-xs text-muted-foreground">
                {leads.filter((l) => l.status === s).length}
              </span>
            </button>
          ))}
        </div>
        <label className="text-sm">
          Source{" "}
          <select
            aria-label="Lead source"
            value={source ?? ""}
            onChange={(e) =>
              navigate({ search: { status, q, source: e.target.value || undefined } })
            }
            className="rounded border p-1"
          >
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Sort{" "}
          <select
            aria-label="Lead sort"
            value={oldest ? "oldest" : "newest"}
            onChange={(e) => setOldest(e.target.value === "oldest")}
            className="rounded border p-1"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search leads"
            value={q}
            onChange={(e) =>
              navigate({
                search: { ...(status ? { status } : {}), source, q: e.target.value },
                replace: true,
              })
            }
            placeholder="Name, email, phone, lead #"
            className="w-64 rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
      </div>

      {mutationError && (
        <p role="alert" className="mb-3 text-destructive">
          {mutationError}
        </p>
      )}
      {sel.length > 0 && (
        <div className="adm-in mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-accent px-4 py-2 text-sm">
          <span className="font-semibold">{sel.length} selected</span>
          <button
            disabled={pending}
            onClick={() => bulk("GENUINE")}
            className="ml-auto rounded-md bg-success px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Mark genuine
          </button>
          <button
            disabled={pending}
            onClick={() => bulk("SPAM")}
            className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Mark spam
          </button>
          <button onClick={() => setSel([])} className="rounded-md px-2 py-1 text-xs">
            Clear
          </button>
        </div>
      )}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={!!visible.length && visible.every((l) => sel.includes(l.id))}
                    onChange={(e) => setSel(e.target.checked ? visible.map((l) => l.id) : [])}
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Lead</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Received</th>
                <th className="px-3 py-2.5 font-medium text-right">Review</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Loading leads…
                  </td>
                </tr>
              )}
              {!loading && loadError && (
                <tr>
                  <td colSpan={9} className="p-8 text-center" role="alert">
                    Could not load leads.{" "}
                    <button onClick={load} className="underline">
                      Retry
                    </button>
                  </td>
                </tr>
              )}
              {!loading && !loadError && !shown.length && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No leads match these filters.
                  </td>
                </tr>
              )}
              {!loading &&
                !loadError &&
                visible.map((l) => (
                  <tr
                    key={l.id}
                    onDoubleClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a,button,input,select,textarea"))
                        void navigate({ to: "/admin/leads/$id", params: { id: l.id } });
                    }}
                    className={`border-t border-border transition-colors hover:bg-muted/50 ${sel.includes(l.id) ? "bg-accent/60" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={sel.includes(l.id)}
                        onChange={(e) =>
                          setSel(e.target.checked ? [...sel, l.id] : sel.filter((x) => x !== l.id))
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to="/admin/leads/$id"
                        params={{ id: l.id }}
                        className="font-semibold text-primary"
                      >
                        {l.lead_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{l.customers?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.customers?.email ?? l.customers?.phone ?? ""}
                      </div>
                    </td>
                    <td className="max-w-56 truncate px-3 py-2.5">{l.subject ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.source}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-xs font-semibold ${l.priority === "HIGH" || l.priority === "URGENT" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {l.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {timeAgo(l.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button
                        disabled={pending || l.status === "GENUINE"}
                        onClick={() => bulk("GENUINE", [l.id])}
                        className="mr-1.5 rounded-md border border-success/40 px-2 py-1 text-xs font-semibold text-success hover:bg-success/10"
                      >
                        Genuine
                      </button>
                      <button
                        disabled={pending || l.status === "SPAM"}
                        onClick={() => bulk("SPAM", [l.id])}
                        className="rounded-md border border-destructive/30 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        Spam
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {!loading && !loadError && (
        <AdminPagination page={safePage} total={shown.length} onChange={setPage} />
      )}
    </AdminShell>
  );
}

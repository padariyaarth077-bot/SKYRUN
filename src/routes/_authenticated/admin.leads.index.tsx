import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AdminShell, Panel, StatusBadge, LEAD_STATUSES, timeAgo } from "@/components/admin-shell";
import { fetchLeads, setLeadStatus, type Lead } from "@/lib/admin-data";
import type { Database } from "@/integrations/supabase/types";

type S = { status?: string; q?: string };
type LeadStatus = Database["public"]["Enums"]["lead_status"];

export const Route = createFileRoute("/_authenticated/admin/leads/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    ...(typeof s["status"] === "string" ? { status: s["status"] } : {}),
    ...(typeof s["q"] === "string" ? { q: s["q"] } : {}),
  }),
  head: () => ({
    meta: [{ title: "Leads — Skyrun Operations Center" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { user } = Route.useRouteContext();
  const { status, q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/leads/" });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
    if (status && l.status !== status) return false;
    const s =
      `${l.lead_number} ${l.customers?.full_name} ${l.customers?.email} ${l.customers?.phone} ${l.subject}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  const bulk = async (s: LeadStatus) => {
    await Promise.all(sel.map((id) => setLeadStatus(id, s, user.id)));
    setSel([]);
    load();
  };
  const tab = (s?: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${status === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <AdminShell
      title={status === "NEW" ? "Needs Review" : "Leads"}
      subtitle={`${shown.length} of ${leads.length} leads`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-1">
          <button className={tab(undefined)} onClick={() => navigate({ search: { q } })}>
            All
          </button>
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              className={tab(s)}
              onClick={() => navigate({ search: { status: s, q } })}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}{" "}
              <span className="ml-0.5 text-xs text-muted-foreground">
                {leads.filter((l) => l.status === s).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) =>
              navigate({
                search: { ...(status ? { status } : {}), q: e.target.value },
                replace: true,
              })
            }
            placeholder="Name, email, phone, lead #"
            className="w-64 rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
      </div>

      {sel.length > 0 && (
        <div className="adm-in mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-accent px-4 py-2 text-sm">
          <span className="font-semibold">{sel.length} selected</span>
          <button
            onClick={() => bulk("GENUINE")}
            className="ml-auto rounded-md bg-success px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Mark genuine
          </button>
          <button
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
                    checked={!!shown.length && sel.length === shown.length}
                    onChange={(e) => setSel(e.target.checked ? shown.map((l) => l.id) : [])}
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
              {shown.map((l) => (
                <tr
                  key={l.id}
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
                      onClick={() => setLeadStatus(l.id, "GENUINE", user.id).then(load)}
                      className="mr-1.5 rounded-md border border-success/40 px-2 py-1 text-xs font-semibold text-success hover:bg-success/10"
                    >
                      Genuine
                    </button>
                    <button
                      onClick={() => setLeadStatus(l.id, "SPAM", user.id).then(load)}
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
    </AdminShell>
  );
}

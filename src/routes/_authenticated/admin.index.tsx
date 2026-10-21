import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Inbox,
  AlertCircle,
  CheckCircle2,
  Ban,
  TrendingUp,
  ArrowRight,
  Plus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, Panel, StatusBadge, LEAD_STATUSES, timeAgo } from "@/components/admin-shell";
import { fetchLeads, setLeadStatus, type Lead } from "@/lib/admin-data";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Skyrun Operations Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const BAR: Record<string, string> = {
  NEW: "bg-info",
  REVIEWING: "bg-warning",
  GENUINE: "bg-success",
  SPAM: "bg-destructive",
  CONTACTED: "bg-primary/60",
  QUALIFIED: "bg-primary",
  LOST: "bg-muted-foreground/40",
};

function Dashboard() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [rideCount, setRideCount] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [mutationError, setMutationError] = useState("");
  const [acts, setActs] = useState<
    { id: string; description: string; created_at: string; entity_id: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setLoading(true);
      const [l, a, rides] = await Promise.all([
        fetchLeads(),
        supabase
          .from("activities")
          .select("id,description,created_at,entity_id")
          .eq("entity_type", "lead")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("ride_requests").select("id", { count: "exact", head: true }),
      ]);
      if (a.error || rides.error || rides.count === null)
        throw new Error("Could not load dashboard");
      setRideCount(rides.count);
      setLeads(l);
      setActs((a.data as never) ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    leads.forEach((l) => (c[l.status] = (c[l.status] ?? 0) + 1));
    return c;
  }, [leads]);
  const n = (s: string) => counts[s] ?? 0;
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = leads.filter((l) => new Date(l.created_at).getTime() > weekAgo).length;
  const needs = leads.filter((l) => l.status === "NEW" || l.status === "REVIEWING");
  const max = Math.max(1, ...LEAD_STATUSES.map(n));

  const mark = async (l: Lead, s: LeadStatus) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMutationError("");
    try {
      await setLeadStatus(l.id, s, user.id);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not save status.");
    } finally {
      await load();
      busy.current = false;
      setPending(false);
    }
  };

  const kpis = [
    {
      label: "Total leads",
      value: leads.length,
      icon: Inbox,
      tone: "text-primary bg-primary/10",
      hint: `${thisWeek} in the last 7 days`,
    },
    {
      label: "Needs review",
      value: needs.length,
      icon: AlertCircle,
      tone: "text-warning bg-warning/15",
      hint: "New + reviewing",
    },
    {
      label: "Genuine",
      value: n("GENUINE"),
      icon: CheckCircle2,
      tone: "text-success bg-success/12",
      hint: "Status is Genuine",
    },
    {
      label: "Spam",
      value: n("SPAM"),
      icon: Ban,
      tone: "text-destructive bg-destructive/10",
      hint: leads.length ? `${Math.round((n("SPAM") / leads.length) * 100)}% of all leads` : "—",
    },
    {
      label: "Ride enquiries",
      value: leads.filter((l) => l.source === "RIDE_ENQUIRY").length,
      icon: Inbox,
      tone: "text-primary bg-primary/10",
      hint: "Leads with source RIDE_ENQUIRY",
    },
    {
      label: "Ride requests",
      value: rideCount,
      icon: Inbox,
      tone: "text-primary bg-primary/10",
      hint: "Structured requests, all statuses",
    },
  ];

  return (
    <AdminShell
      title="Dashboard"
      subtitle={`Welcome back${user.email ? `, ${user.email}` : ""}. Here's what's happening today.`}
      actions={
        <div className="flex gap-2">
          <Link
            to="/admin/leads"
            search={{ status: "NEEDS_REVIEW" } as never}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <AlertCircle className="size-4" />
            Review queue
          </Link>
        </div>
      }
    >
      {loadError && (
        <p role="alert">
          Could not load dashboard data.{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </p>
      )}
      {mutationError && (
        <p role="alert" className="text-destructive">
          {mutationError}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="adm-in adm-stat p-5"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
              <span className={`rounded-xl p-3 ${k.tone}`}>
                <k.icon className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums">
              {loading || loadError ? "–" : k.value}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="size-3" />
              {!loading && !loadError && k.hint}
              <Link
                className="underline"
                to={
                  k.label === "Ride requests" || k.label === "Ride enquiries"
                    ? "/admin/m/$module"
                    : "/admin/leads"
                }
                params={
                  k.label.startsWith("Ride")
                    ? { module: k.label === "Ride requests" ? "ride-requests" : "ride-enquiries" }
                    : {}
                }
                search={{
                  status:
                    k.label === "Needs review"
                      ? "NEEDS_REVIEW"
                      : k.label === "Genuine"
                        ? "GENUINE"
                        : k.label === "Spam"
                          ? "SPAM"
                          : undefined,
                }}
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Needs attention"
          className="lg:col-span-2"
          action={
            <Link
              to="/admin/leads"
              search={{ status: "NEEDS_REVIEW" } as never}
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {!loading && !loadError && !needs.length && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                All caught up — no leads waiting for review.
              </li>
            )}
            {!loading &&
              !loadError &&
              needs.slice(0, 6).map((l) => (
                <li
                  key={l.id}
                  onDoubleClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a,button,input,select,textarea"))
                      void navigate({ to: "/admin/leads/$id", params: { id: l.id } });
                  }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/admin/leads/$id"
                      params={{ id: l.id }}
                      className="text-sm font-semibold hover:text-primary"
                    >
                      {l.customers?.full_name ?? "Unknown"}{" "}
                      <span className="font-normal text-muted-foreground">· {l.lead_number}</span>
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.subject ?? "No subject"} · {l.source} · {timeAgo(l.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={l.status} />
                  <div className="flex gap-1.5">
                    <button
                      disabled={pending}
                      onClick={() => mark(l, "GENUINE")}
                      className="rounded-md border border-success/40 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/10"
                    >
                      Genuine
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => mark(l, "SPAM")}
                      className="rounded-md border border-destructive/30 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      Spam
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel title="Lead pipeline">
          <div className="space-y-3 p-4">
            {LEAD_STATUSES.map((s) => (
              <Link
                key={s}
                to="/admin/leads"
                search={{ status: s } as never}
                className="group block"
              >
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium group-hover:text-primary">
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {loading || loadError ? "–" : n(s)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${BAR[s]}`}
                    style={{ width: `${loading || loadError ? 0 : (n(s) / max) * 100}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Recent leads"
          className="lg:col-span-2"
          action={
            <Link
              to="/admin/leads"
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              All leads <ArrowRight className="size-3" />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Lead</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  !loadError &&
                  leads.slice(0, 6).map((l) => (
                    <tr
                      key={l.id}
                      onDoubleClick={(e) => {
                        if (!(e.target as HTMLElement).closest("a,button,input,select,textarea"))
                          void navigate({ to: "/admin/leads/$id", params: { id: l.id } });
                      }}
                      className="border-t border-border hover:bg-muted/50"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to="/admin/leads/$id"
                          params={{ id: l.id }}
                          className="font-semibold text-primary"
                        >
                          {l.lead_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{l.customers?.full_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{l.source}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{timeAgo(l.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Recent activity">
            <ul className="space-y-3 p-4">
              {!loading && !loadError && !acts.length && (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              )}
              {!loading &&
                !loadError &&
                acts.map((a) => (
                  <li
                    key={a.id}
                    onDoubleClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a,button,input,select,textarea"))
                        void navigate({ to: "/admin/leads/$id", params: { id: a.entity_id } });
                    }}
                    className="flex gap-3"
                  >
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 text-sm">
                      <Link
                        to="/admin/leads/$id"
                        params={{ id: a.entity_id }}
                        className="font-semibold hover:text-primary"
                      >
                        Lead
                      </Link>{" "}
                      <span className="text-muted-foreground">{a.description}</span>
                      <div className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</div>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2 p-4">
              <Link
                to="/admin/leads"
                className="flex items-center gap-2 rounded-md border border-border p-2.5 text-sm hover:border-primary hover:text-primary"
              >
                <Inbox className="size-4" />
                All leads
              </Link>
              <Link
                to="/admin/customers"
                className="flex items-center gap-2 rounded-md border border-border p-2.5 text-sm hover:border-primary hover:text-primary"
              >
                <Users className="size-4" />
                Customers
              </Link>
              <Link
                to="/admin/m/$module"
                params={{ module: "quotes" }}
                className="flex items-center gap-2 rounded-md border border-border p-2.5 text-sm hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" />
                Quotes
              </Link>
              <Link
                to="/admin/m/$module"
                params={{ module: "bookings" }}
                className="flex items-center gap-2 rounded-md border border-border p-2.5 text-sm hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" />
                Bookings
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
type LeadStatus = Database["public"]["Enums"]["lead_status"];

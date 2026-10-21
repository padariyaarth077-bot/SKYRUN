import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";
import {
  LayoutDashboard,
  Inbox,
  AlertCircle,
  Mail,
  Car,
  MessageSquare,
  ClipboardList,
  FileText,
  CalendarCheck,
  Truck,
  Layers,
  UserCheck,
  Clock,
  Users,
  History,
  Briefcase,
  MapPin,
  BarChart3,
  ShieldCheck,
  Bell,
  ScrollText,
  Settings,
  Menu,
  X,
  LogOut,
  Search,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const LEAD_STATUSES = [
  "NEW",
  "REVIEWING",
  "GENUINE",
  "SPAM",
  "CONTACTED",
  "QUALIFIED",
  "LOST",
] as const;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SENT: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  EXPIRED: "bg-slate-100 text-slate-700 ring-slate-200",
  DECLINED: "bg-rose-50 text-rose-700 ring-rose-200",
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  UNVERIFIED: "bg-amber-50 text-amber-800 ring-amber-200",
  REVERSED: "bg-rose-50 text-rose-700 ring-rose-200",
  NEW: "bg-info/12 text-info ring-info/25",
  REVIEWING: "bg-warning/15 text-foreground ring-warning/40",
  GENUINE: "bg-success/12 text-success ring-success/30",
  SPAM: "bg-destructive/10 text-destructive ring-destructive/25",
  CONTACTED: "bg-accent text-accent-foreground ring-primary/20",
  QUALIFIED: "bg-primary/12 text-primary ring-primary/25",
  LOST: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status] ?? "bg-muted ring-border"}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ")}
    </span>
  );
}

type NavItem = {
  label: string;
  icon: typeof Inbox;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
};
const m = (label: string, icon: NavItem["icon"], module: string): NavItem => ({
  label,
  icon,
  to: "/admin/m/$module",
  params: { module },
});

const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/admin" }] },
  {
    section: "Leads",
    items: [
      { label: "All Leads", icon: Inbox, to: "/admin/leads" },
      {
        label: "Needs Review",
        icon: AlertCircle,
        to: "/admin/leads",
        search: { status: "NEEDS_REVIEW" },
      },
      m("Contact Messages", Mail, "contact-messages"),
      m("Ride Enquiries", Car, "ride-enquiries"),
      { label: "Chat Conversations", icon: MessageSquare, to: "/admin/chat-conversations" },
    ],
  },
  {
    section: "Operations",
    items: [
      m("Ride Requests", ClipboardList, "ride-requests"),
      m("Quotes", FileText, "quotes"),
      m("Bookings", CalendarCheck, "bookings"),
    ],
  },
  {
    section: "Fleet",
    items: [
      m("Vehicles", Truck, "vehicles"),
      m("Vehicle Categories", Layers, "vehicle-categories"),
      m("Drivers", UserCheck, "drivers"),
      m("Availability", Clock, "availability"),
    ],
  },
  {
    section: "Customers",
    items: [{ label: "Customers", icon: Users, to: "/admin/customers" }],
  },
  {
    section: "Business",
    items: [
      m("Services", Briefcase, "services"),
      m("Service Areas", MapPin, "service-areas"),
      m("Reports", BarChart3, "analytics"),
      m("Invoice Drafts", FileText, "invoices"),
      m("Payment Previews", ScrollText, "receipts"),
    ],
  },
  {
    section: "System",
    items: [
      m("Team & Roles", ShieldCheck, "team"),
      m("Notifications", Bell, "notifications"),
      m("Audit Log", ScrollText, "audit-log"),
      { label: "Settings", icon: Settings, to: "/admin/settings" },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useRouterState({ select: (s) => s.location });
  const isActive = (it: NavItem) => {
    const path = it.params ? it.to.replace("$module", it.params["module"]!) : it.to;
    if (
      loc.pathname !== path &&
      !(path === "/admin/leads" && loc.pathname.startsWith("/admin/leads/") && !it.search)
    )
      return false;
    const st = (loc.search as Record<string, unknown>)["status"];
    return it.search ? st === it.search["status"] : path !== "/admin/leads" || !st;
  };
  return (
    <nav className="flex h-full flex-col bg-adm-side text-adm-side-fg">
      <div className="px-5 py-5">
        <div className="text-[15px] font-bold tracking-[0.18em]">
          SKYRUN <span className="font-normal text-adm-side-muted">LIMO</span>
        </div>
        <div className="mt-0.5 text-xs text-adm-side-muted">Operations Center</div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((g) => (
          <div key={g.section}>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-adm-side-muted">
              {g.section}
            </div>
            {g.items.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <Link
                  key={it.label}
                  to={it.to as "/admin"}
                  params={it.params as never}
                  search={(it.search ?? {}) as never}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] transition-colors ${active ? "bg-primary text-primary-foreground" : "text-adm-side-fg/80 hover:bg-adm-side-fg/10 hover:text-adm-side-fg"}`}
                >
                  <span
                    className={`rounded-lg p-1.5 ${active ? "bg-white/15" : "bg-adm-side-fg/5"}`}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                  </span>
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: ADMIN_LOGIN_PATH, replace: true });
  };
  return (
    <div className="admin min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="adm-in absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
          <button
            className="rounded-md p-1.5 hover:bg-muted lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <form
            className="relative max-w-sm flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/admin/leads", search: { q } as never });
            }}
          >
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search leads"
              placeholder="Search leads by customer or reference…"
              className="w-full rounded-md border border-input bg-muted/60 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted sm:flex"
            >
              <ExternalLink className="size-4" />
              Website
            </Link>
            <Link
              to="/admin/m/$module"
              params={{ module: "notifications" }}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="adm-in mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-card shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

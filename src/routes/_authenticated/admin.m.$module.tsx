import { ServiceConfiguration } from "@/components/service-configuration";
import { FleetImages } from "@/components/fleet-images";
import { AdminPagination } from "@/components/admin-pagination";
import { readAll } from "@/lib/admin-data";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminShell, Panel, StatusBadge, timeAgo } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";

type ModuleRow = {
  id: string;
  values: string[];
  status?: string;
  created_at: string;
  leadId?: string | null;
  rideId?: string;
  quoteId?: string;
  bookingId?: string;
};
type Module = { title: string; desc: string; cols: string[]; available: boolean };

const MODULES: Record<string, Module> = {
  "contact-messages": {
    title: "Contact Messages",
    desc: "Website contact enquiries.",
    cols: ["Lead", "Customer", "Subject", "Message", "Contact", "Status", "Received"],
    available: true,
  },
  "ride-enquiries": {
    title: "Ride Enquiries",
    desc: "Website ride enquiries, including reviewed submissions.",
    cols: ["Lead", "Customer", "Subject", "Message", "Contact", "Status", "Received"],
    available: true,
  },
  "ride-requests": {
    title: "Ride Requests",
    desc: "Structured transport requests.",
    cols: [
      "Request",
      "Pickup",
      "Drop-off",
      "Time",
      "Notes / luggage",
      "Travel date",
      "Passengers",
      "Status",
      "Received",
    ],
    available: true,
  },
  quotes: {
    title: "Quotes",
    desc: "Price quotes prepared for customers.",
    cols: ["Quote", "Travel date", "Amount", "Valid until", "Status", "Created"],
    available: true,
  },
  bookings: {
    title: "Bookings",
    desc: "Accepted bookings awaiting review and bookings in all recorded statuses.",
    cols: [
      "Booking",
      "Pickup",
      "Travel date",
      "Passengers",
      "Required deposit",
      "Status",
      "Created",
    ],
    available: true,
  },
  vehicles: {
    title: "Vehicles",
    desc: "Vehicles in the fleet.",
    cols: ["Vehicle", "Year", "Passengers", "Luggage", "Status", "Created"],
    available: true,
  },
  "vehicle-categories": {
    title: "Vehicle Categories",
    desc: "Fleet categories available to operations.",
    cols: ["Category", "Passengers", "Luggage", "Visibility", "Updated"],
    available: true,
  },
  team: {
    title: "Team & Roles",
    desc: "Staff profiles and assigned roles.",
    cols: ["Staff member", "Phone", "Status", "Roles", "Created"],
    available: true,
  },
  "audit-log": {
    title: "Audit Log",
    desc: "Recorded operational activity.",
    cols: ["Activity", "Description", "Entity", "Actor", "Time"],
    available: true,
  },
  drivers: {
    title: "Drivers",
    desc: "The approved schema has no drivers table.",
    cols: [],
    available: false,
  },
  availability: {
    title: "Availability",
    desc: "The approved schema has no availability table.",
    cols: [],
    available: false,
  },
  "customer-history": {
    title: "Customer History",
    desc: "A dedicated customer history view has not been built yet.",
    cols: [],
    available: false,
  },
  services: {
    title: "Services",
    desc: "Internal service catalogue; public enquiry options remain unchanged.",
    cols: [],
    available: false,
  },
  "service-areas": {
    title: "Service Areas",
    desc: "Internal service-area catalogue; public coverage rules remain unchanged.",
    cols: [],
    available: false,
  },
  analytics: {
    title: "Analytics",
    desc: "Reporting metrics have not been defined yet.",
    cols: [],
    available: false,
  },
  notifications: {
    title: "Notifications",
    desc: "No notification persistence has been implemented yet.",
    cols: [],
    available: false,
  },
};

const text = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

async function loadModule(module: string): Promise<{ rows: ModuleRow[]; error: string }> {
  switch (module) {
    case "contact-messages":
    case "ride-enquiries": {
      const source = module === "contact-messages" ? "CONTACT_FORM" : "RIDE_ENQUIRY";
      const data = await readAll((start, end) =>
        supabase
          .from("leads")
          .select(
            "id,lead_number,subject,message,status,created_at,customers(full_name,email,phone)",
          )
          .eq("source", source)
          .order("created_at", { ascending: false })
          .order("id")
          .range(start, end),
      );
      return {
        rows: (
          (data ?? []) as Array<{
            id: string;
            lead_number: string;
            subject: string | null;
            message: string;
            status: string;
            created_at: string;
            customers: { full_name: string; email: string | null; phone: string | null } | null;
          }>
        ).map((row) => ({
          id: row.id,
          leadId: row.id,
          values: [
            row.lead_number,
            row.customers?.full_name ?? "—",
            row.subject ?? "—",
            row.message,
            row.customers?.email ?? row.customers?.phone ?? "—",
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: "",
      };
    }
    case "ride-requests": {
      const data = await readAll((start, end) =>
        supabase
          .from("ride_requests")
          .select(
            "id,lead_id,request_number,pickup_location,dropoff_location,pickup_time,notes,customer_id,travel_date,passenger_count,status,created_at",
          )
          .order("created_at", { ascending: false })
          .order("id")
          .range(start, end),
      );
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          leadId: row.lead_id,
          rideId: row.id,
          values: [
            row.request_number,
            row.pickup_location,
            row.dropoff_location ?? "—",
            row.pickup_time ?? "—",
            row.notes ?? "—",
            row.travel_date,
            String(row.passenger_count),
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: "",
      };
    }
    case "quotes": {
      const data = await readAll((start, end) =>
        supabase
          .from("quotes")
          .select("id,travel_date,amount,currency,valid_until,status,created_at")
          .order("created_at", { ascending: false })
          .order("id")
          .range(start, end),
      );
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          quoteId: row.id,
          values: [
            row.id.slice(0, 8),
            row.travel_date,
            `${row.currency} ${row.amount.toFixed(2)}`,
            new Date(row.valid_until).toLocaleDateString(),
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: "",
      };
    }
    case "bookings": {
      const data = await readAll((start, end) =>
        supabase
          .from("bookings")
          .select(
            "id,booking_number,pickup_location,travel_date,passenger_count,status,created_at,required_deposit_amount,currency",
          )
          .order("created_at", { ascending: false })
          .order("id")
          .range(start, end),
      );
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          bookingId: row.id,
          values: [
            row.booking_number,
            row.pickup_location,
            row.travel_date,
            String(row.passenger_count),
            row.required_deposit_amount == null
              ? "Missing — review required"
              : `${row.currency} ${row.required_deposit_amount.toFixed(2)}`,
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: "",
      };
    }
    case "team": {
      const [profiles, roles] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,phone,status,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const rolesByUser = new Map<string, string[]>();
      (roles.data ?? []).forEach((role) =>
        rolesByUser.set(role.user_id, [...(rolesByUser.get(role.user_id) ?? []), role.role]),
      );
      return {
        rows: (profiles.data ?? []).map((row) => ({
          id: row.id,
          values: [
            row.full_name ?? "Unnamed staff member",
            text(row.phone),
            row.status,
            (rolesByUser.get(row.id) ?? []).join(", ") || "No role",
          ],
          created_at: row.created_at,
        })),
        error: profiles.error?.message ?? roles.error?.message ?? "",
      };
    }
    case "audit-log": {
      const { data, error } = await supabase
        .from("activities")
        .select("id,activity_type,description,entity_type,actor_id,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          values: [
            row.activity_type,
            row.description,
            row.entity_type,
            row.actor_id ? row.actor_id.slice(0, 8) : "System",
          ],
          created_at: row.created_at,
        })),
        error: error?.message ?? "",
      };
    }
    default:
      return { rows: [], error: "" };
  }
}

export const Route = createFileRoute("/_authenticated/admin/m/$module")({
  head: () => ({
    meta: [{ title: "Skyrun Operations Center" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: ({ params }) => {
    if (params.module === "customer-history") throw redirect({ to: "/admin/customers" });
  },
  component: ModulePage,
});

function ModulePage() {
  const navigate = useNavigate();
  const { module } = Route.useParams();
  const special = ["services", "service-areas", "vehicles", "vehicle-categories"].includes(module);
  const core = [
    "contact-messages",
    "ride-enquiries",
    "ride-requests",
    "quotes",
    "bookings",
  ].includes(module);
  const current = MODULES[module] ?? {
    title: "Not found",
    desc: "This section doesn't exist.",
    cols: [],
    available: false,
  };
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(current.available);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!current.available || special) return;
    setLoading(true);
    setError("");
    try {
      const result = await loadModule(module);
      setRows(result.rows);
      setError(result.error ? "Could not load records. Please retry." : "");
    } catch {
      setError("Could not load records. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [current.available, module, special]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setQ("");
    setStatus("");
    setPage(0);
  }, [module]);
  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      r.values.join(" ").toLowerCase().includes(q.trim().toLowerCase()),
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  const displayed = core ? filtered.slice(safePage * 50, safePage * 50 + 50) : rows;
  if (module === "services" || module === "service-areas")
    return (
      <ServiceConfiguration
        key={module}
        kind={module === "services" ? "service" : "service_area"}
      />
    );
  if (module === "vehicles" || module === "vehicle-categories")
    return (
      <FleetImages key={module} kind={module === "vehicles" ? "vehicle" : "vehicle_category"} />
    );
  return (
    <AdminShell
      title={current.title}
      subtitle={current.desc}
      actions={
        current.available ? (
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        ) : undefined
      }
    >
      {module === "quotes" && (
        <p className="mb-3">
          Create drafts from a{" "}
          <Link to="/admin/leads" search={{ status: "GENUINE" }} className="underline">
            Genuine enquiry
          </Link>
          . Open a saved quote to review its recipient and delivery status. Sending requires staff
          approval and enabled email configuration.
        </p>
      )}
      {module === "bookings" && (
        <p className="mb-3">
          Customer acceptance creates a pending booking. This list displays saved records and their
          actual status; pending does not mean the ride is confirmed.
        </p>
      )}
      {core && current.available && (
        <div className="mb-3 flex flex-wrap gap-3">
          <input
            aria-label="Search records"
            placeholder="Search records"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="rounded border px-3 py-2"
          />
          <select
            aria-label="Record status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="rounded border px-3 py-2"
          >
            <option value="">All statuses</option>
            {[...new Set(rows.flatMap((r) => (r.status ? [r.status] : [])))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      <Panel>
        {!current.available ? (
          <div className="px-6 py-14 text-center">
            <h2 className="text-base font-semibold">This section needs a data model first</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{current.desc}</p>
            <Link
              to="/admin/leads"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to leads <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  {current.cols.map((column) => (
                    <th key={column} className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={current.cols.length}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Loading records…
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={current.cols.length} className="p-8 text-center text-destructive">
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && !filtered.length && (
                  <tr>
                    <td
                      colSpan={current.cols.length}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No records yet.
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  displayed.map((row) => (
                    <tr
                      key={row.id}
                      onDoubleClick={(e) => {
                        if (
                          row.leadId &&
                          !(e.target as HTMLElement).closest("a,button,input,select,textarea")
                        )
                          void navigate({ to: "/admin/leads/$id", params: { id: row.leadId } });
                      }}
                      className="border-t border-border hover:bg-muted/50"
                    >
                      {row.values.map((value, index) => (
                        <td key={index} className="whitespace-nowrap px-4 py-3">
                          {index === 0 && row.quoteId ? (
                            <Link
                              to="/admin/quote/$id"
                              params={{ id: row.quoteId }}
                              search={{}}
                              className="text-primary underline"
                            >
                              {value}
                            </Link>
                          ) : index === 0 && row.bookingId ? (
                            <Link
                              to="/admin/booking/$id"
                              params={{ id: row.bookingId }}
                              className="text-primary underline"
                            >
                              {value}
                            </Link>
                          ) : index === 0 && row.rideId ? (
                            <Link
                              to="/admin/ride-request/$id"
                              params={{ id: row.rideId }}
                              className="text-primary underline"
                            >
                              {value}
                            </Link>
                          ) : index === 0 && row.leadId ? (
                            <Link
                              to="/admin/leads/$id"
                              params={{ id: row.leadId }}
                              className="font-semibold text-primary underline"
                            >
                              {value}
                            </Link>
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                      {row.status ? (
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {timeAgo(row.created_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {core && current.available && !loading && !error && (
        <AdminPagination page={safePage} total={filtered.length} onChange={setPage} />
      )}
    </AdminShell>
  );
}

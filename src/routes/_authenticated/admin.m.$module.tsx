import { createFileRoute, Link } from "@tanstack/react-router";
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
};
type Module = { title: string; desc: string; cols: string[]; available: boolean };

const MODULES: Record<string, Module> = {
  "contact-messages": {
    title: "Contact Messages",
    desc: "Website contact enquiries.",
    cols: ["Lead", "Customer", "Subject", "Status", "Received"],
    available: true,
  },
  "ride-enquiries": {
    title: "Ride Enquiries",
    desc: "Website ride enquiries awaiting review.",
    cols: ["Lead", "Customer", "Subject", "Status", "Received"],
    available: true,
  },
  "ride-requests": {
    title: "Ride Requests",
    desc: "Structured transport requests.",
    cols: ["Request", "Pickup", "Travel date", "Passengers", "Status", "Received"],
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
    desc: "Confirmed rides on the schedule.",
    cols: ["Booking", "Pickup", "Travel date", "Passengers", "Status", "Created"],
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
    desc: "The approved schema has no services table.",
    cols: [],
    available: false,
  },
  "service-areas": {
    title: "Service Areas",
    desc: "Service areas are currently static website content.",
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
      const { data, error } = await supabase
        .from("leads")
        .select("id,lead_number,subject,status,created_at,customers(full_name)")
        .eq("source", source)
        .order("created_at", { ascending: false });
      return {
        rows: (
          (data ?? []) as Array<{
            id: string;
            lead_number: string;
            subject: string | null;
            status: string;
            created_at: string;
            customers: { full_name: string } | null;
          }>
        ).map((row) => ({
          id: row.id,
          leadId: row.id,
          values: [row.lead_number, row.customers?.full_name ?? "—", row.subject ?? "—"],
          status: row.status,
          created_at: row.created_at,
        })),
        error: error?.message ?? "",
      };
    }
    case "ride-requests": {
      const { data, error } = await supabase
        .from("ride_requests")
        .select(
          "id,lead_id,request_number,pickup_location,travel_date,passenger_count,status,created_at",
        )
        .order("created_at", { ascending: false });
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          leadId: row.lead_id,
          values: [
            row.request_number,
            row.pickup_location,
            row.travel_date,
            String(row.passenger_count),
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: error?.message ?? "",
      };
    }
    case "quotes": {
      const { data, error } = await supabase
        .from("quotes")
        .select("id,travel_date,amount,currency,valid_until,status,created_at")
        .order("created_at", { ascending: false });
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          values: [
            row.id.slice(0, 8),
            row.travel_date,
            `${row.currency} ${row.amount}`,
            new Date(row.valid_until).toLocaleDateString(),
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: error?.message ?? "",
      };
    }
    case "bookings": {
      const { data, error } = await supabase
        .from("bookings")
        .select("id,booking_number,pickup_location,travel_date,passenger_count,status,created_at")
        .order("created_at", { ascending: false });
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          values: [
            row.booking_number,
            row.pickup_location,
            row.travel_date,
            String(row.passenger_count),
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: error?.message ?? "",
      };
    }
    case "vehicles": {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id,make,model,year,passenger_capacity,luggage_capacity,status,created_at")
        .order("created_at", { ascending: false });
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          values: [
            `${row.make} ${row.model}`,
            text(row.year),
            text(row.passenger_capacity),
            text(row.luggage_capacity),
          ],
          status: row.status,
          created_at: row.created_at,
        })),
        error: error?.message ?? "",
      };
    }
    case "vehicle-categories": {
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("id,name,passenger_capacity,luggage_capacity,is_visible,updated_at,created_at")
        .order("display_order");
      return {
        rows: (data ?? []).map((row) => ({
          id: row.id,
          values: [
            row.name,
            String(row.passenger_capacity),
            String(row.luggage_capacity),
            row.is_visible ? "Visible" : "Hidden",
          ],
          created_at: row.updated_at ?? row.created_at,
        })),
        error: error?.message ?? "",
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
  component: ModulePage,
});

function ModulePage() {
  const { module } = Route.useParams();
  const current = MODULES[module] ?? {
    title: "Not found",
    desc: "This section doesn't exist.",
    cols: [],
    available: false,
  };
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(current.available);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!current.available) return;
    setLoading(true);
    const result = await loadModule(module);
    setRows(result.rows);
    setError(result.error);
    setLoading(false);
  }, [current.available, module]);
  useEffect(() => {
    void load();
  }, [load]);

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
                      Could not load records: {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && !rows.length && (
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
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-border hover:bg-muted/50">
                      {row.values.map((value, index) => (
                        <td key={index} className="whitespace-nowrap px-4 py-3">
                          {index === 0 && row.leadId ? (
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
    </AdminShell>
  );
}

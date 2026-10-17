import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, Panel, timeAgo } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Skyrun Operations Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Customers,
});

type C = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  created_at: string;
  leads: { id: string } | { id: string }[] | null;
};

function Customers() {
  const [rows, setRows] = useState<C[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase
      .from("customers")
      .select("id,full_name,email,phone,company_name,created_at,leads(id)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as C[]) ?? []));
  }, []);
  const shown = rows.filter((c) =>
    `${c.full_name} ${c.email} ${c.phone} ${c.company_name}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const leadCount = (leads: C["leads"]) => (Array.isArray(leads) ? leads.length : leads ? 1 : 0);
  return (
    <AdminShell
      title="Customers"
      subtitle={`${rows.length} customers on file`}
      actions={
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers"
          className="w-64 rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none focus:border-ring"
        />
      }
    >
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Leads</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-medium">{c.full_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.company_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.email ? (
                      <a className="text-primary" href={`mailto:${c.email}`}>
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{leadCount(c.leads)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminShell>
  );
}

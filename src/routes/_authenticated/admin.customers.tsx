import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { AdminShell, Panel, timeAgo } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import type { Database } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Skyrun Operations Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Customers,
});
type Customer = Database["public"]["Tables"]["customers"]["Row"];
function Customers() {
  const [rows, setRows] = useState<Customer[]>([]),
    [q, setQ] = useState(""),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(
        await readAll<Customer>((start, end) =>
          supabase
            .from("customers")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id")
            .range(start, end),
        ),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const shown = rows.filter((c) =>
    `${c.full_name} ${c.email ?? ""} ${c.phone ?? ""} ${c.company_name ?? ""}`
      .toLowerCase()
      .includes(q.trim().toLowerCase()),
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(shown.length / 50) - 1));
  return (
    <AdminShell
      title="Customers"
      subtitle={
        loading
          ? "Loading customers…"
          : error
            ? "Customers unavailable"
            : `${rows.length} customers on file`
      }
      actions={
        <input
          aria-label="Search customers"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Name, email or phone"
          className="rounded border px-3 py-2"
        />
      }
    >
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Name", "Company", "Email", "Phone", "Added"].map((h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6">
                    Loading customers…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} role="alert" className="p-6">
                    Could not load customers.{" "}
                    <button onClick={load} className="underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : (
                <>
                  {shown.slice(safePage * 50, safePage * 50 + 50).map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3">
                        <Link
                          className="font-semibold text-primary underline"
                          to="/admin/customer/$id"
                          params={{ id: c.id }}
                        >
                          {c.full_name}
                        </Link>
                      </td>
                      <td>{c.company_name ?? "—"}</td>
                      <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                      <td>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—"}</td>
                      <td>{timeAgo(c.created_at)}</td>
                    </tr>
                  ))}
                  {!shown.length && (
                    <tr>
                      <td colSpan={5} className="p-6">
                        No customers match this search.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {!loading && !error && (
        <AdminPagination page={safePage} total={shown.length} onChange={setPage} />
      )}
    </AdminShell>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell, Panel } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import { useOperationsPermission, useOperationsSave } from "@/lib/operations-hooks";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readAll } from "@/lib/admin-data";
import { configurationSchema } from "@/lib/phase5";

type Config = Database["public"]["Tables"]["service_configuration"]["Row"];
type Unit = Pick<Database["public"]["Tables"]["business_units"]["Row"], "id" | "name">;
function ConfigurationForm({
  kind,
  unit,
  record,
  onSaved,
}: {
  kind: Config["kind"];
  unit: string;
  record: Config | null;
  onSaved: () => void;
}) {
  const permission = useOperationsPermission(unit),
    { save, pending, message } = useOperationsSave(onSaved);
  const id = useRef(record?.id ?? crypto.randomUUID());
  const [form, setForm] = useState({
    name: record?.name ?? "",
    description: record?.description ?? "",
    is_active: record?.is_active ?? true,
  });
  const [invalid, setInvalid] = useState(false);
  if (permission === "loading") return <p role="status">Checking permission…</p>;
  if (permission !== "allowed")
    return (
      <p role={permission === "error" ? "alert" : undefined}>
        {permission === "error"
          ? "Configuration changes require the approved Phase 5 database update and a successful permission check."
          : "Configuration is read-only for your role."}
      </p>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = configurationSchema.safeParse(form);
        setInvalid(!parsed.success);
        if (parsed.success)
          void save(kind, id.current, unit, parsed.data, record?.updated_at ?? null);
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <label className="block">
          Name
          <input
            required
            maxLength={100}
            className="block w-full rounded border p-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block">
          Description
          <textarea
            maxLength={2000}
            className="block w-full rounded border p-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active for staff reference
        </label>
        <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          {pending ? "Saving…" : "Save configuration"}
        </button>
      </fieldset>
      {invalid && (
        <p role="alert">
          Enter a name up to 100 characters and a description up to 2,000 characters.
        </p>
      )}
      {message && <p role={message === "Saved." ? "status" : "alert"}>{message}</p>}
    </form>
  );
}
export function ServiceConfiguration({ kind }: { kind: Config["kind"] }) {
  const [rows, setRows] = useState<Config[]>([]),
    [units, setUnits] = useState<Unit[]>([]),
    [unit, setUnit] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [editing, setEditing] = useState<Config | null>(null),
    [formVersion, setFormVersion] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [records, businessUnits] = await Promise.all([
        readAll<Config>((s, e) =>
          supabase
            .from("service_configuration")
            .select("*")
            .eq("kind", kind)
            .order("name")
            .order("id")
            .range(s, e),
        ),
        readAll<Unit>((s, e) =>
          supabase
            .from("business_units")
            .select("id,name")
            .eq("business_type", "LIMO")
            .order("name")
            .order("id")
            .range(s, e),
        ),
      ]);
      setRows(records);
      setUnits(businessUnits);
      setUnit((current) =>
        businessUnits.some((b) => b.id === current) ? current : (businessUnits[0]?.id ?? ""),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void load();
    setEditing(null);
    setPage(0);
    setFormVersion((v) => v + 1);
  }, [load]);
  const filtered = rows.filter(
    (r) =>
      r.business_unit_id === unit &&
      r.name.concat(" ", r.description).toLowerCase().includes(search.trim().toLowerCase()) &&
      (filter === "all" || r.is_active === (filter === "active")),
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return (
    <AdminShell
      title={kind === "service" ? "Services" : "Service Areas"}
      subtitle="Internal operations catalogue"
      actions={
        <button disabled={loading} onClick={() => void load()} className="rounded border p-2">
          Refresh
        </button>
      }
    >
      <p className="mb-4">
        Staff reference only. These records do not change public enquiry options, pricing,
        geographic eligibility or existing quote/booking snapshots.
      </p>
      {loading ? (
        <p role="status">Loading configuration…</p>
      ) : error ? (
        <p role="alert">
          Could not load configuration. The approved Phase 5 database update may be pending.{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <label>
              Business unit
              <select
                className="block rounded border p-2"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setEditing(null);
                  setPage(0);
                  setFormVersion((v) => v + 1);
                }}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search configuration
              <input
                className="block rounded border p-2"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Status
              <select
                className="block rounded border p-2"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          {!units.length && <p>No accessible limousine business units.</p>}
          <Panel title="Saved configuration">
            <ul className="divide-y">
              {filtered.slice(safePage * 50, safePage * 50 + 50).map((r) => (
                <li className="p-4" key={r.id}>
                  <button
                    className="font-semibold underline"
                    onClick={() => {
                      setEditing(r);
                      setFormVersion((v) => v + 1);
                    }}
                  >
                    {r.name}
                  </button>{" "}
                  · {r.is_active ? "Active" : "Inactive"}
                  <p>{r.description}</p>
                </li>
              ))}
              {!filtered.length && (
                <li className="p-4">
                  No configuration matches this selection. No records have been pre-filled.
                </li>
              )}
            </ul>
          </Panel>
          <AdminPagination page={safePage} total={filtered.length} onChange={setPage} />
          {unit && (
            <Panel title={editing ? "Review / edit configuration" : "Add configuration"}>
              <div className="p-4">
                <ConfigurationForm
                  key={`${kind}-${unit}-${formVersion}`}
                  kind={kind}
                  unit={unit}
                  record={editing}
                  onSaved={() => {
                    setEditing(null);
                    setFormVersion((v) => v + 1);
                    void load();
                  }}
                />
                {editing && (
                  <button
                    className="mt-3 underline"
                    onClick={() => {
                      setEditing(null);
                      setFormVersion((v) => v + 1);
                    }}
                  >
                    Close / add another
                  </button>
                )}
              </div>
            </Panel>
          )}
        </>
      )}
    </AdminShell>
  );
}

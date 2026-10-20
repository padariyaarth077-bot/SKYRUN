import { useCallback, useEffect, useState } from "react";
import { AdminShell, Panel } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import { useOperationsPermission, useOperationsSave } from "@/lib/operations-hooks";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { VEHICLE_IMAGES, knownVehicleImage } from "@/lib/vehicle-images";

type FleetRecord = {
  id: string;
  business_unit_id: string;
  name: string;
  image_path: string | null;
  updated_at: string;
  detail: string;
};
function ImagePicker({
  record,
  kind,
  onSaved,
}: {
  record: FleetRecord;
  kind: "vehicle" | "vehicle_category";
  onSaved: () => void;
}) {
  const permission = useOperationsPermission(record.business_unit_id),
    { save, pending, message } = useOperationsSave(onSaved);
  const [selected, setSelected] = useState(record.image_path ?? "");
  const preview = knownVehicleImage(selected);
  return (
    <div className="space-y-3">
      {preview ? (
        <img
          src={preview}
          alt={`${record.name} — selected reference photo`}
          loading="lazy"
          className="h-40 w-full rounded object-contain"
        />
      ) : (
        <p>No selected reference photo.</p>
      )}
      <p>{record.detail}</p>
      {permission === "loading" ? (
        <p role="status">Checking image edit permission…</p>
      ) : permission === "allowed" ? (
        <>
          <label className="block">
            Reference photo
            <select
              className="block w-full rounded border p-2"
              value={selected}
              disabled={pending}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">No photo</option>
              {VEHICLE_IMAGES.map((image) => (
                <option key={image.path} value={image.path}>
                  {image.label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={pending || selected === (record.image_path ?? "")}
            className="rounded border p-2 disabled:opacity-50"
            onClick={() =>
              void save(
                kind,
                record.id,
                record.business_unit_id,
                { image_path: selected || null },
                record.updated_at,
              )
            }
          >
            {pending ? "Saving…" : "Save reference photo"}
          </button>
        </>
      ) : (
        <p role={permission === "error" ? "alert" : undefined}>
          {permission === "error"
            ? "Photo assignment requires the approved Phase 5 database update and a successful permission check."
            : "Photos are read-only for your role."}
        </p>
      )}
      {message && <p role={message === "Saved." ? "status" : "alert"}>{message}</p>}
    </div>
  );
}
export function FleetImages({ kind }: { kind: "vehicle" | "vehicle_category" }) {
  const [rows, setRows] = useState<FleetRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Read existing records even before the optional image-column migration.
      if (kind === "vehicle") {
        const records = await readAll((s, e) =>
          supabase
            .from("vehicles")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id")
            .range(s, e),
        );
        setRows(
          records.map((r) => ({
            id: r.id,
            business_unit_id: r.business_unit_id,
            name: `${r.make} ${r.model}`,
            image_path: r.image_path ?? null,
            updated_at: r.updated_at,
            detail: `${r.status} · Year: ${r.year ?? "Not recorded"} · Passengers: ${r.passenger_capacity ?? "Not recorded"} · Luggage: ${r.luggage_capacity ?? "Not recorded"}`,
          })),
        );
      } else {
        const records = await readAll((s, e) =>
          supabase
            .from("vehicle_categories")
            .select("*")
            .order("display_order")
            .order("id")
            .range(s, e),
        );
        setRows(
          records.map((r) => ({
            id: r.id,
            business_unit_id: r.business_unit_id,
            name: r.name,
            image_path: r.image_path ?? null,
            updated_at: r.updated_at,
            detail: `${r.is_visible ? "Visible" : "Hidden"} · Passengers: ${r.passenger_capacity} · Luggage: ${r.luggage_capacity}`,
          })),
        );
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void load();
    setPage(0);
    setSearch("");
  }, [load]);
  const filtered = rows.filter((r) =>
    `${r.name} ${r.detail}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return (
    <AdminShell
      title={kind === "vehicle" ? "Vehicles" : "Vehicle Categories"}
      subtitle="Saved fleet records and your vehicle reference photos"
      actions={
        <button disabled={loading} onClick={() => void load()} className="rounded border p-2">
          Refresh
        </button>
      }
    >
      <p className="mb-4">
        Choose the matching photo explicitly. Photos do not establish ownership, availability or
        passenger capacity, and do not change the public website.
      </p>
      <label className="mb-4 block">
        Search fleet
        <input
          className="ml-2 rounded border p-2"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </label>
      {loading ? (
        <p role="status">Loading fleet…</p>
      ) : error ? (
        <p role="alert">
          Could not load fleet records.{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.slice(safePage * 50, safePage * 50 + 50).map((record) => (
              <Panel key={`${record.id}-${record.updated_at}`} title={record.name}>
                <div className="p-4">
                  <ImagePicker record={record} kind={kind} onSaved={() => void load()} />
                </div>
              </Panel>
            ))}
          </div>
          {!filtered.length && (
            <p>
              No saved fleet records match this search. Images do not create vehicles automatically.
            </p>
          )}
          <AdminPagination page={safePage} total={filtered.length} onChange={setPage} />
        </>
      )}
      <details open className="mt-6 rounded border p-4">
        <summary>Available reference photos ({VEHICLE_IMAGES.length})</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {VEHICLE_IMAGES.map((image) => (
            <figure key={image.path}>
              <img
                src={image.path}
                alt={image.label}
                loading="lazy"
                className="h-32 w-full object-contain"
              />
              <figcaption>{image.label}</figcaption>
            </figure>
          ))}
        </div>
      </details>
    </AdminShell>
  );
}

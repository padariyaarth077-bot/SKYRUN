import { CarFront, Images, Layers3, Search, RefreshCw, ShieldCheck } from "lucide-react";
import { CatalogueShare } from "@/components/catalogue-share";
import { VehicleCatalogue } from "@/components/vehicle-catalogue";
import { useCallback, useEffect, useState } from "react";
import { AdminShell, Panel } from "@/components/admin-shell";
import { AdminPagination } from "@/components/admin-pagination";
import { useOperationsPermission, useOperationsSave } from "@/lib/operations-hooks";
import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/admin-data";
import { VEHICLE_IMAGES, VEHICLE_MODELS, knownVehicleImage } from "@/lib/vehicle-images";

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
        <button
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? "animate-spin" : ""}`} />{" "}
          Refresh
        </button>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: kind === "vehicle" ? "Saved vehicles" : "Saved categories",
            value: loading || error ? "—" : rows.length,
            icon: CarFront,
            color: "bg-blue-100 text-blue-600",
          },
          {
            label: "Catalogue models / groups",
            value: VEHICLE_MODELS.length,
            icon: Layers3,
            color: "bg-violet-100 text-violet-600",
          },
          {
            label: "Reference photos",
            value: VEHICLE_IMAGES.length,
            icon: Images,
            color: "bg-emerald-100 text-emerald-600",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
          >
            <div className={`rounded-xl p-3 ${color}`}>
              <Icon aria-hidden="true" className="size-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-80">
          <span className="sr-only">Search fleet</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <input
            placeholder="Search vehicles or models…"
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600" /> Reference catalogue
          · availability checked separately
        </span>
      </div>
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
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-5">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <CarFront aria-hidden="true" className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">
                  {search ? "No saved records match" : "Your model catalogue is ready"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Try another model name or clear your search."
                    : "Browse the photos below. Individual vehicle quantities and capacities can be recorded when confirmed."}
                </p>
              </div>
            </div>
          )}
          {filtered.length > 50 && (
            <AdminPagination page={safePage} total={filtered.length} onChange={setPage} />
          )}
        </>
      )}
      <div className="mt-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Share your catalogue</h2>
        <CatalogueShare />
      </div>
      <section className="mt-8">
        <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Images aria-hidden="true" className="size-5 text-violet-600" />
          Fleet model catalogue ({VEHICLE_MODELS.length} models / groups)
        </h2>
        <VehicleCatalogue search={search} internal />
      </section>
    </AdminShell>
  );
}

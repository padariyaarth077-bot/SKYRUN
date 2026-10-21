import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/admin-shell";
import { useOperationsPermission } from "@/lib/operations-hooks";
import { supabase } from "@/integrations/supabase/client";
import {
  PROFILE_LABELS,
  blankProfile,
  profileSchema,
  saveFinance,
  type DocumentProfile,
} from "@/lib/finance";
function ProfileEditor({ unit }: { unit: string }) {
  const permission = useOperationsPermission(unit),
    [profile, setProfile] = useState<DocumentProfile | null>(null),
    [form, setForm] = useState(blankProfile),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    retry = useRef({ signature: "", id: "" });
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .from("document_profiles")
        .select("*")
        .eq("business_unit_id", unit)
        .maybeSingle();
      if (r.error) throw Error();
      setProfile(r.data);
      setForm(
        r.data
          ? (Object.fromEntries(
              Object.keys(blankProfile).map((k) => [k, r.data![k as keyof typeof blankProfile]]),
            ) as typeof blankProfile)
          : blankProfile,
      );
    } catch {
      setError(
        "Business profile unavailable. Check management access and the approved Phase 7 database update.",
      );
    } finally {
      setLoading(false);
    }
  }, [unit]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <p role="status" className="p-5">
        Loading document profile…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="p-5">
        {error} <button onClick={() => void load()}>Retry</button>
      </p>
    );
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        const parsed = profileSchema.safeParse(form);
        if (!parsed.success) {
          setMessage("Check email, HTTPS website and field lengths.");
          return;
        }
        busy.current = true;
        setPending(true);
        setMessage("");
        const signature = JSON.stringify([unit, form, profile?.updated_at]);
        if (retry.current.signature !== signature)
          retry.current = { signature, id: crypto.randomUUID() };
        try {
          await saveFinance(
            "profile",
            unit,
            parsed.data,
            profile?.updated_at ?? null,
            retry.current.id,
          );
          retry.current = { signature: "", id: "" };
          setMessage("Business profile saved. Existing drafts keep their original snapshots.");
          await load();
        } catch {
          setMessage(
            "Could not save. Your entries are preserved. Check permission or refresh a stale profile, then retry.",
          );
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        Enter only business-approved details. Unknown fields stay empty. No secrets, tax assumptions
        or official document numbers are stored here. Issuance remains disabled while numbering is
        deferred.
      </p>
      <fieldset
        disabled={pending || permission !== "allowed"}
        className="grid gap-4 sm:grid-cols-2"
      >
        {Object.entries(PROFILE_LABELS).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              rows={key === "address" || key === "footer" ? 3 : 1}
              className="block w-full border p-2"
              maxLength={
                key === "footer"
                  ? 2000
                  : key === "address" || key === "payment_terms"
                    ? 1000
                    : key === "phone"
                      ? 40
                      : key === "website"
                        ? 300
                        : 200
              }
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
      </fieldset>
      {permission === "allowed" ? (
        <button disabled={pending} className="bg-primary px-4 py-2 text-primary-foreground">
          {pending ? "Saving…" : "Save business profile"}
        </button>
      ) : (
        <p>Business settings are read-only for your role or permission could not be verified.</p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export function DocumentSettings() {
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]),
    [unit, setUnit] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    void supabase
      .from("business_units")
      .select("id,name")
      .order("name")
      .then(
        (r) => {
          if (r.error) setError(true);
          else {
            setUnits(r.data ?? []);
            setUnit(r.data?.[0]?.id ?? "");
          }
        },
        () => setError(true),
      );
  }, []);
  return (
    <Panel title="Document business profile">
      {error ? (
        <p role="alert" className="p-5">
          Could not load authorized business units. Refresh this page to retry.
        </p>
      ) : (
        <>
          <label className="block p-5">
            Business unit
            <select
              className="ml-3 border p-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">Select business unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {unit ? (
            <ProfileEditor key={unit} unit={unit} />
          ) : (
            <p className="p-5">Select an authorized business unit to review document settings.</p>
          )}
        </>
      )}
    </Panel>
  );
}

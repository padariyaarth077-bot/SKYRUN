import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export function useOperationsPermission(unit: string) {
  const [permission, setPermission] = useState<"loading" | "allowed" | "readonly" | "error">(
    "loading",
  );
  useEffect(() => {
    let active = true;
    setPermission("loading");
    void supabase.rpc("can_manage_operations", { _business_unit_id: unit }).then(
      ({ data, error }) => {
        if (active) setPermission(error ? "error" : data === true ? "allowed" : "readonly");
      },
      () => {
        if (active) setPermission("error");
      },
    );
    return () => {
      active = false;
    };
  }, [unit]);
  return permission;
}

export function useOperationsSave(onSaved: () => void) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    retry = useRef({ signature: "", id: "" });
  const save = async (
    kind: string,
    id: string,
    unit: string,
    payload: Json,
    version: string | null,
  ) => {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setMessage("");
    const signature = JSON.stringify([kind, id, unit, payload, version]);
    if (retry.current.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await supabase.rpc("phase5_save", {
        _kind: kind,
        _id: id,
        _business_unit_id: unit,
        _payload: payload,
        _expected_updated_at: version,
        _operation_id: retry.current.id,
      });
      if (result.error || result.data !== id) {
        setMessage(
          result.error?.code === "23505"
            ? "This contact or name already exists in this business unit. Review the existing record."
            : "Could not save. Your entries are preserved. Check permission and the approved Phase 5 migration, or refresh if this record changed.",
        );
        return false;
      }
      retry.current = { signature: "", id: "" };
      setMessage("Saved.");
      onSaved();
      return true;
    } catch {
      setMessage("Could not confirm the save. Your entries are preserved; retry safely.");
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return { save, pending, message };
}

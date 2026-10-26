import { NotificationSettings } from "@/components/notifications";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentSettings } from "@/components/document-settings";
import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (error) setMsg("Could not load your profile. Refresh before editing.");
          else {
            setName(data?.full_name ?? "");
            setProfileLoaded(true);
          }
        },
        () => setMsg("Could not load your profile. Refresh before editing."),
      );
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(
        ({ data, error }) => {
          if (error) setMsg("Could not verify role display. Refresh to retry.");
          else setRoles((data ?? []).map((r) => r.role));
        },
        () => setMsg("Could not verify role display. Refresh to retry."),
      );
  }, [user.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current || !profileLoaded) return;
    if (name.trim().length > 200) {
      setMsg("Use no more than 200 characters.");
      return;
    }
    busy.current = true;
    setPending(true);
    setMsg("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("id", user.id)
        .select("id")
        .single();
      setMsg(error ? "Could not save your profile. Entries are preserved; retry." : "Saved.");
    } catch {
      setMsg("Could not save your profile. Retry safely.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <AdminShell title="Settings">
      <form
        onSubmit={save}
        className="max-w-md space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Email</div>
          <div>{user.email}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Roles</div>
          <div>{roles.join(", ") || "None"}</div>
        </div>
        <label className="block text-sm">
          Full name
          <input
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
          />
        </label>
        <button
          disabled={pending || !profileLoaded}
          className="inline-flex rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Save
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
      <div className="mt-6">
        <DocumentSettings />
        <div className="mt-6">
          <NotificationSettings />
        </div>
      </div>
    </AdminShell>
  );
}

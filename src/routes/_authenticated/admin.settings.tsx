import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.full_name ?? ""));
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => setRoles((data ?? []).map((r) => r.role)));
  }, [user.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: name });
    setMsg(error ? error.message : "Saved.");
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
          />
        </label>
        <button className="inline-flex rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Save
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </AdminShell>
  );
}

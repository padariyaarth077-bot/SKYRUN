/**
 * _authenticated layout route — protects ALL /admin/* pages.
 *
 * Security model (defence-in-depth):
 *   1. Supabase `getUser()` — verifies a live, server-side session token.
 *      `getSession()` is intentionally NOT used here; it only reads the local
 *      storage cache and does not verify the JWT against Supabase's servers.
 *   2. Role check — confirms the authenticated user has at least one valid
 *      staff role in `user_roles`. A row must exist; holding no role is denied.
 *   3. Both checks happen in `beforeLoad`, which runs before any component
 *      renders — no flash of protected content is possible.
 *   4. The redirect target is the private login path from the central config,
 *      never the public /auth route.
 *
 * RLS on every Supabase table provides the database-level enforcement layer
 * independently of this frontend guard.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { NotificationProvider } from "@/components/notification-context";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";

// All roles that are permitted to access the admin portal.
const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "DISPATCHER",
  "SUPPORT",
  "CONTENT_MANAGER",
] as const;

export const Route = createFileRoute("/_authenticated")({
  // Must be client-side only — `getUser()` needs the browser session storage.
  ssr: false,

  beforeLoad: async () => {
    // `getUser()` makes a network request to Supabase to validate the JWT.
    // This is the authoritative check; it cannot be spoofed by a modified
    // local storage entry the way `getSession()` can.
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw redirect({ to: ADMIN_LOGIN_PATH });
    }

    // Verify the user holds at least one permitted role.
    // We use .in() so the query is a single round-trip regardless of how many
    // roles are in ALLOWED_ROLES. Limit 1 — we only need to know at least one exists.
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .in("role", [...ALLOWED_ROLES])
      .limit(1);

    if (roleError || !roles?.length) {
      // Authenticated but not a staff member — sign out to avoid a confused
      // state, then redirect to login.
      await supabase.auth.signOut();
      throw redirect({
        to: ADMIN_LOGIN_PATH,
      });
    }

    // Pass the verified user object to all child routes via context.
    return { user: data.user };
  },

  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <NotificationProvider key={user.id} userId={user.id}>
      <Outlet />
    </NotificationProvider>
  );
}

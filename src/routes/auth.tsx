/**
 * Legacy /auth route — kept so existing bookmarks and email links don't 404.
 *
 * Immediately redirects to the private admin login route.
 * No UI is rendered; no credentials are accepted here.
 * noindex prevents search engines from indexing or following this redirect.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }],
  }),
  // beforeLoad runs before any component is mounted — the redirect happens
  // server-side (or immediately client-side) with no content flash.
  beforeLoad: () => {
    throw redirect({
      to: ADMIN_LOGIN_PATH,
      replace: true,
    });
  },
  component: () => null,
});

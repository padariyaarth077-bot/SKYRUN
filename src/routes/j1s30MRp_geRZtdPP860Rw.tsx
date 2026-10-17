/**
 * Admin auth layout shell — /j1s30MRp_geRZtdPP860Rw
 *
 * This file is a LAYOUT-ONLY route. Its sole job is to render <Outlet /> so
 * TanStack Router can paint child routes (the login index and the
 * forgot-password page) inside this segment of the URL tree.
 *
 * The actual admin login UI lives in j1s30MRp_geRZtdPP860Rw.index.tsx, which
 * is the index child route for the exact path /j1s30MRp_geRZtdPP860Rw.
 *
 * WHY this split is required
 * ──────────────────────────
 * TanStack Router renders the full matched-route chain from root down to the
 * leaf. When a file is a parent AND its component doesn't call <Outlet />, any
 * child route's component is silently swallowed. Keeping the layout shell
 * purely as <Outlet /> is the same pattern used by _authenticated/route.tsx.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/j1s30MRp_geRZtdPP860Rw")({
  component: () => <Outlet />,
});

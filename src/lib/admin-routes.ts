/**
 * admin-routes.ts — Single source of truth for all private admin route paths.
 *
 * These paths are intentionally long and non-obvious to reduce casual discovery.
 * SECURITY NOTE: Obscurity is a supplementary measure only. Real access control
 * is enforced by the _authenticated layout guard (server-side Supabase auth +
 * ADMIN/SUPER_ADMIN role check) and by Supabase RLS on every table. Knowing these
 * paths does not grant access.
 *
 * How to rotate:
 *   node -e "const c=require('crypto'); console.log(c.randomBytes(16).toString('base64url'))"
 *   Update the two constants below and restart the dev server.
 *
 * Production:
 *   Override via environment variables VITE_ADMIN_LOGIN_PATH and VITE_ADMIN_DASH_PATH
 *   so the paths can be rotated without a code change.
 */

// Login entry point — the only publicly reachable admin page.
export const ADMIN_LOGIN_PATH = ((import.meta.env["VITE_ADMIN_LOGIN_PATH"] as string | undefined) ||
  "/j1s30MRp_geRZtdPP860Rw") as "/j1s30MRp_geRZtdPP860Rw";

// Protected dashboard root — every /admin/* sub-route lives under this prefix.
// The _authenticated layout is *pathless*, so the actual navigable root is /admin.
export const ADMIN_DASH_PATH = ((import.meta.env["VITE_ADMIN_DASH_PATH"] as string | undefined) ||
  "/3ZiG4lFP04tFD1Iv4Vv97g") as "/3ZiG4lFP04tFD1Iv4Vv97g";

/**
 * Supabase auth redirect URLs — list these in your Supabase project's
 * Authentication → URL Configuration → Redirect URLs allowlist:
 *
 *   Development:  http://localhost:8080/3ZiG4lFP04tFD1Iv4Vv97g/auth/callback
 *   Production:   https://yourdomain.com/3ZiG4lFP04tFD1Iv4Vv97g/auth/callback
 *
 * The dev server binds to port 8080 (enforced by @lovable.dev/vite-tanstack-config).
 * If you are running outside Lovable sandbox, the actual port shown in your
 * terminal is authoritative — use that value.
 *
 * NEVER use wildcards such as https://yourdomain.com/* in the allowlist.
 */
export const AUTH_CALLBACK_PATH = `${ADMIN_DASH_PATH}/auth/callback` as const;

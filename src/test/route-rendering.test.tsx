/**
 * route-rendering.test.tsx
 *
 * Verifies that each admin auth route renders the CORRECT component, not
 * just that the route is registered in the tree.  These tests catch the
 * specific bug this fix addresses: a parent route whose component renders
 * without <Outlet /> will swallow child routes and show the wrong page.
 *
 * Tests are MOCKED — no real network calls or Supabase sessions.
 *
 * NOTE: These are component-render tests that mount the full router into
 * jsdom.  They are necessarily heavier than unit tests.  Because several
 * components call Supabase hooks on mount (getSession, onAuthStateChange),
 * the Supabase client module is mocked globally.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { ADMIN_LOGIN_PATH, AUTH_CALLBACK_PATH } from "@/lib/admin-routes";

// ── Supabase mock ─────────────────────────────────────────────────────────────
const { mockGetSession, mockOnAuthStateChange, mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
    from: mockFrom,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
  });

  // Push the path into the router's memory history so it starts at that URL.
  // Using window.history here because jsdom provides it and TanStack Router
  // picks it up via its default BrowserHistory in test.
  window.history.pushState({}, "", path);

  const { container } = render(<RouterProvider router={router} />);
  return { container, router };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: no active session
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

  // onAuthStateChange: return a subscription object (used by callback route)
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  // from() — default empty result (used by login page getSession role check)
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
});

// ── Route component tests ─────────────────────────────────────────────────────

describe("Admin login route renders the login form", () => {
  it(`renders the sign-in heading at ${ADMIN_LOGIN_PATH}`, async () => {
    renderAt(ADMIN_LOGIN_PATH);

    await waitFor(
      () => {
        // The login form has a heading "Administration" and a label "Email address"
        expect(
          screen.queryByText("Administration") ||
            screen.queryByRole("heading", { name: /administration/i }) ||
            screen.queryByLabelText(/email address/i) ||
            screen.queryByText(/sign in with your skyrun staff account/i),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("does NOT render the forgot-password heading at the login path", async () => {
    renderAt(ADMIN_LOGIN_PATH);

    // Give React time to settle
    await new Promise((r) => setTimeout(r, 500));

    // The forgot-password page has heading "Password recovery"
    expect(screen.queryByText(/password recovery/i)).toBeNull();
  });
});

describe("Forgot-password route renders the recovery form", () => {
  const forgotPath = `${ADMIN_LOGIN_PATH}/forgot-password`;

  it(`renders the recovery heading at ${forgotPath}`, async () => {
    renderAt(forgotPath);

    await waitFor(
      () => {
        // ForgotPasswordPage renders heading "Password recovery" (or "Check your inbox" if sent)
        // and the email input with label "Email address"
        const heading = screen.queryByText(/password recovery/i);
        const emailLabel = screen.queryByLabelText(/email address/i);
        expect(heading || emailLabel).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("does NOT render the admin login form at the forgot-password path", async () => {
    renderAt(forgotPath);

    await new Promise((r) => setTimeout(r, 500));

    // AdminLoginPage has an aria-label "Administrator sign-in" on the form.
    // If this is present it means the login page was incorrectly rendered.
    expect(screen.queryByRole("form", { name: /administrator sign-in/i })).toBeNull();
  });

  it("renders the Send reset link button", async () => {
    renderAt(forgotPath);

    await waitFor(
      () => {
        expect(
          screen.queryByRole("button", { name: /send reset link/i }) ||
            screen.queryByText(/send reset link/i),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });
});

describe("Callback route renders the loading state", () => {
  it(`renders the verifying state at ${AUTH_CALLBACK_PATH}`, async () => {
    // Navigate to the callback path with no hash — the component will immediately
    // show "invalid" because there's no token. That's the correct behaviour.
    renderAt(AUTH_CALLBACK_PATH);

    await waitFor(
      () => {
        const verifying = screen.queryByText(/verifying your reset link/i);
        const invalid = screen.queryByText(/link unavailable/i);
        const noToken = screen.queryByText(/no reset token found/i);
        expect(verifying || invalid || noToken).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("does NOT render the admin login form at the callback path", async () => {
    renderAt(AUTH_CALLBACK_PATH);

    await new Promise((r) => setTimeout(r, 500));

    expect(screen.queryByRole("form", { name: /administrator sign-in/i })).toBeNull();
  });
});

// ── Route-tree correctness: index route id ────────────────────────────────────

describe("Route tree: index vs layout ids", () => {
  it("login path resolves to the index route (id ends with /)", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });
    const matches = router.matchRoutes(ADMIN_LOGIN_PATH);
    const leafId = matches.at(-1)?.routeId ?? "";
    // The index route id is '/j1s30MRp_geRZtdPP860Rw/' (with trailing slash)
    // NOT '/j1s30MRp_geRZtdPP860Rw' (the layout shell)
    expect(leafId).toBe(`${ADMIN_LOGIN_PATH}/`);
  });

  it("forgot-password path resolves to the forgot-password route id", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });
    const matches = router.matchRoutes(`${ADMIN_LOGIN_PATH}/forgot-password`);
    const leafId = matches.at(-1)?.routeId ?? "";
    expect(leafId).toBe(`${ADMIN_LOGIN_PATH}/forgot-password`);
  });

  it("both routes share the same parent layout shell", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const loginMatches = router.matchRoutes(ADMIN_LOGIN_PATH);
    const forgotMatches = router.matchRoutes(`${ADMIN_LOGIN_PATH}/forgot-password`);

    const loginParentId = loginMatches.at(-2)?.routeId;
    const forgotParentId = forgotMatches.at(-2)?.routeId;

    // Both should have the same layout parent: '/j1s30MRp_geRZtdPP860Rw'
    expect(loginParentId).toBe(ADMIN_LOGIN_PATH);
    expect(forgotParentId).toBe(ADMIN_LOGIN_PATH);
    expect(loginParentId).toBe(forgotParentId);
  });
});

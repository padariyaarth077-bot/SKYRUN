/**
 * Private admin login page — /j1s30MRp_geRZtdPP860Rw (exact / index)
 *
 * This is the ONLY publicly reachable admin page. It is not linked from any
 * public navigation. Knowing this URL does not grant access; Supabase Auth +
 * ADMIN/SUPER_ADMIN role enforcement in the _authenticated guard is the real
 * security boundary.
 *
 * This file is the INDEX child of the j1s30MRp_geRZtdPP860Rw layout shell.
 * Route id: /j1s30MRp_geRZtdPP860Rw/
 * Full path: /j1s30MRp_geRZtdPP860Rw (index routes match the parent path exactly)
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";
import heroImg from "@/assets/skyrun-executive.jpg";

export const Route = createFileRoute("/j1s30MRp_geRZtdPP860Rw/")({
  head: () => ({
    meta: [
      { title: "Skyrun Limo — Administration" },
      { name: "robots", content: "noindex, nofollow, noarchive, nositelinkssearchbox" },
      { property: "og:robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

// ─── Derived forgot-password path stays relative to login ──────────────────
const FORGOT_PATH = `${ADMIN_LOGIN_PATH}/forgot-password` as const;

// ─── The dashboard lives at /admin (the _authenticated layout is pathless) ─
const DASHBOARD_TO = "/admin" as const;

// ─── Safe generic error messages ────────────────────────────────────────────
const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "The email or password you entered is incorrect.",
  "Email not confirmed": "Please confirm your email address before signing in.",
  "Too many requests": "Too many sign-in attempts. Please wait a moment and try again.",
};

function humaniseAuthError(raw: string): string {
  for (const [key, msg] of Object.entries(AUTH_ERRORS)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return msg;
  }
  return "Sign-in failed. Please check your credentials and try again.";
}

// ─── Component ──────────────────────────────────────────────────────────────
function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Clearing a field error: omit the key rather than setting to undefined
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const emailRef = useRef<HTMLInputElement>(null);

  // If already authenticated + authorised, skip login silently.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .limit(1);
      if (roles?.length) navigate({ to: DASHBOARD_TO, replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline validation ────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(humaniseAuthError(authError.message));
        return;
      }

      // Role check before redirecting — gives a clear denied message without
      // flashing the dashboard for non-staff authenticated users.
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .in("role", ["SUPER_ADMIN", "ADMIN", "MANAGER", "DISPATCHER", "SUPPORT", "CONTENT_MANAGER"])
        .limit(1);

      if (!roles?.length) {
        await supabase.auth.signOut();
        setError("Your account does not have access to the administration portal.");
        return;
      }

      navigate({ to: DASHBOARD_TO, replace: true });
    } finally {
      setBusy(false);
    }
  }

  // ── Password toggle ───────────────────────────────────────────────────────
  function togglePassword(e: React.MouseEvent | React.KeyboardEvent) {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    setShowPw((v) => !v);
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[var(--brand-charcoal)]">
      {/* ── Ambient vehicle photograph ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <img
          src={heroImg}
          alt=""
          className="h-full w-full object-cover object-center opacity-25"
          style={{ filter: "saturate(0.4)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.12_0.01_75)] via-[oklch(0.12_0.01_75/90%)] to-[oklch(0.12_0.01_75/55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.01_75/80%)] via-transparent to-transparent" />
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        {/* Left brand panel */}
        <div className="flex flex-col justify-between px-8 py-10 lg:w-[52%] lg:px-16 lg:py-14">
          <div>
            <div className="brand brand-light" aria-label="Skyrun Limo">
              <span className="brand-name" style={{ fontSize: "clamp(28px, 3vw, 36px)" }}>
                SKYRUN
              </span>
              <span className="brand-sub" style={{ fontSize: "9px", marginTop: "8px" }}>
                LIMO · CHICAGO
              </span>
            </div>
          </div>

          <div className="hidden py-8 lg:block">
            <p
              className="text-[oklch(0.74_0.065_78)] text-[10px] font-semibold tracking-[0.22em] uppercase"
              aria-hidden
            >
              Operations Centre
            </p>
            <h1
              className="mt-4 font-[var(--font-display)] text-[clamp(52px,5.5vw,80px)] font-normal leading-[0.88] text-[var(--brand-paper)]"
              aria-hidden
            >
              Private
              <br />
              <em className="text-[var(--brand-gold)] not-italic">Access.</em>
            </h1>
            <p
              className="mt-6 max-w-[360px] text-[14px] leading-[1.85] text-[oklch(0.85_0.01_80/75%)]"
              aria-hidden
            >
              This portal is restricted to authorised Skyrun Limo staff. Credentials are verified
              against your Skyrun account.
            </p>
          </div>

          <div className="hidden items-center gap-2.5 lg:flex" aria-hidden>
            <ShieldCheck className="size-4 text-[var(--brand-gold)]" strokeWidth={1.5} />
            <span className="text-[11px] tracking-wider text-[oklch(0.65_0.02_80)]">
              Protected · Encrypted · Role-verified
            </span>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex flex-1 items-center justify-center px-5 pb-14 pt-4 lg:px-12 lg:py-14">
          <div
            className="w-full max-w-[420px]"
            style={{ animation: "adm-in 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <div className="rounded-2xl border border-[oklch(1_0_0/10%)] bg-[oklch(0.97_0.008_85)] px-8 py-9 shadow-2xl shadow-black/50">
              {/* Card header */}
              <div className="mb-7">
                <h2 className="font-[var(--font-display)] text-[28px] font-normal leading-tight text-[var(--brand-charcoal)]">
                  Administration
                </h2>
                <p className="mt-1.5 text-[13px] text-[var(--brand-muted)]">
                  Sign in with your Skyrun staff account.
                </p>
              </div>

              <div className="mb-7 h-px w-10 bg-[var(--brand-gold)]" aria-hidden />

              <form onSubmit={handleSubmit} noValidate aria-label="Administrator sign-in">
                {/* Global error */}
                {error && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-lg border border-[oklch(0.55_0.18_28/35%)] bg-[oklch(0.55_0.18_28/8%)] px-4 py-3"
                    style={{ animation: "adm-in 0.25s ease both" }}
                  >
                    <span className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.18_28)]" aria-hidden>
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0V5zm-.75 6.25a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75z" />
                      </svg>
                    </span>
                    <p className="text-[13px] text-[oklch(0.45_0.14_28)]">{error}</p>
                  </div>
                )}

                {/* Email */}
                <div className="mb-4">
                  <label
                    htmlFor="admin-email"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
                  >
                    Email address
                  </label>
                  <input
                    ref={emailRef}
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors(({ email: _removed, ...rest }) => rest);
                    }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "email-err" : undefined}
                    placeholder="you@skyrunlimo.com"
                    className={[
                      "w-full rounded-lg border bg-white px-4 py-3 text-[14px] text-[var(--brand-charcoal)] outline-none transition-shadow placeholder:text-[var(--brand-muted)]/60",
                      "focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/25",
                      fieldErrors.email
                        ? "border-[oklch(0.55_0.18_28)] ring-2 ring-[oklch(0.55_0.18_28)]/20"
                        : "border-[var(--border)]",
                    ].join(" ")}
                  />
                  {fieldErrors.email && (
                    <p
                      id="email-err"
                      role="alert"
                      className="mt-1.5 text-[12px] text-[oklch(0.55_0.18_28)]"
                    >
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="mb-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="admin-password"
                      className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
                    >
                      Password
                    </label>
                    <a
                      href={FORGOT_PATH}
                      className="text-[12px] text-[var(--brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] rounded"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors(({ password: _removed, ...rest }) => rest);
                      }}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? "pw-err" : undefined}
                      placeholder="••••••••"
                      className={[
                        "w-full rounded-lg border bg-white px-4 py-3 pr-12 text-[14px] text-[var(--brand-charcoal)] outline-none transition-shadow placeholder:text-[var(--brand-muted)]/60",
                        "focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/25",
                        fieldErrors.password
                          ? "border-[oklch(0.55_0.18_28)] ring-2 ring-[oklch(0.55_0.18_28)]/20"
                          : "border-[var(--border)]",
                      ].join(" ")}
                    />
                    <button
                      type="button"
                      onClick={togglePassword}
                      onKeyDown={togglePassword}
                      tabIndex={0}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--brand-muted)] hover:text-[var(--brand-charcoal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p
                      id="pw-err"
                      role="alert"
                      className="mt-1.5 text-[12px] text-[oklch(0.55_0.18_28)]"
                    >
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className={[
                    "button-gold flex w-full items-center justify-center gap-2.5 rounded-lg text-[13px]",
                    "min-h-[50px] font-semibold tracking-[0.08em] uppercase transition-all",
                    busy ? "opacity-70 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-[11px] text-[var(--brand-muted)]">
                Authorised personnel only.{" "}
                <a
                  href="/"
                  className="text-[var(--brand-gold)] underline-offset-2 hover:underline"
                  tabIndex={0}
                >
                  Return to website
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

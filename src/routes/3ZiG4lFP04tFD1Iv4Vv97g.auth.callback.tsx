/**
 * Password-reset callback — /3ZiG4lFP04tFD1Iv4Vv97g/auth/callback
 *
 * Supabase sends users here after they click the password-reset link in their
 * email. The client is initialised with flowType: 'implicit' (see client.ts),
 * so Supabase appends the recovery session as a URL hash fragment:
 *
 *   /callback#access_token=xxx&refresh_token=yyy&type=recovery&...
 *
 * ── How the implicit recovery flow works ─────────────────────────────────────
 * 1. The SDK (detectSessionInUrl: true) sees the hash on initialisation and
 *    begins processing it automatically.
 * 2. It first fires onAuthStateChange with event = "SIGNED_IN" carrying the
 *    recovery session. We must NOT act on this event alone — a normal login
 *    session would look identical at this point.
 * 3. Immediately after, the SDK fires a second event: "PASSWORD_RECOVERY".
 *    This is the authoritative signal that the session is a recovery session.
 *    Only at this point do we show the new-password form.
 *
 * ── Security notes ────────────────────────────────────────────────────────────
 * - We never read or trust the raw token; the SDK handles extraction and
 *   verification against Supabase servers.
 * - We only show the password form after PASSWORD_RECOVERY is confirmed.
 * - A lone SIGNED_IN event is given a brief grace window for the expected
 *   PASSWORD_RECOVERY follow-up. If it doesn't arrive, we reject. This prevents
 *   a pre-existing normal login session from granting form access.
 * - We sign out after a successful password update so the recovery session
 *   cannot be reused to access the admin dashboard without a fresh login +
 *   role-check.
 * - The post-success redirect is hardcoded — no open redirect.
 *
 * ── Do NOT call exchangeCodeForSession() here ─────────────────────────────────
 * That function is for the PKCE flow (authorization code). With implicit flow
 * the SDK processes the hash automatically; calling exchangeCodeForSession()
 * will always fail with "invalid grant" or "code verifier not found".
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";

export const Route = createFileRoute("/3ZiG4lFP04tFD1Iv4Vv97g/auth/callback")({
  // Must be client-side only — the recovery token is in the URL hash fragment,
  // which is never sent to the server.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set New Password — Skyrun Limo" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ResetPasswordPage,
});

const FORGOT_PATH = `${ADMIN_LOGIN_PATH}/forgot-password` as const;

// Password policy: minimum 8 chars, at least one letter and one number.
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number.";
  return null;
}

type Stage =
  | "loading" // Waiting for PASSWORD_RECOVERY event from the SDK
  | "form" // PASSWORD_RECOVERY confirmed — show the new-password form
  | "submitting" // updateUser in flight
  | "success" // Password updated
  | "invalid" // No valid recovery session (expired, reused, direct navigation)
  | "error"; // Unexpected server error during updateUser

// How long (ms) to wait for the PASSWORD_RECOVERY event before giving up.
const RECOVERY_TIMEOUT_MS = 10_000;

// How long (ms) to wait after a lone SIGNED_IN before concluding that
// PASSWORD_RECOVERY is not coming (i.e. it is a regular session, not recovery).
// Supabase fires both events in quick succession; 1 s is more than enough.
const SIGNED_IN_GRACE_MS = 1_500;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState("");

  const pwRef = useRef<HTMLInputElement>(null);
  // Tracks whether a genuine PASSWORD_RECOVERY event has been received.
  const hasRecoverySession = useRef(false);
  // Timer used for the SIGNED_IN grace period.
  const signedInGraceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Wait for the SDK's PASSWORD_RECOVERY event ───────────────────────────
  useEffect(() => {
    // Fast-fail: if the URL has neither a hash nor a ?code param, this is a
    // direct navigation — show the invalid state immediately without waiting.
    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : "");
    const searchParams = new URLSearchParams(search);

    const hasHashToken =
      hashParams.get("access_token") || hashParams.get("token_hash") || hashParams.get("type");
    const hasCodeParam = searchParams.get("code");

    if (!hasHashToken && !hasCodeParam) {
      setTokenError(
        "No reset token found in this URL. Please use the link from your reset email, or request a new one.",
      );
      setStage("invalid");
      return;
    }

    // Overall timeout — if nothing useful fires within RECOVERY_TIMEOUT_MS,
    // the link is considered expired or malformed.
    const overallTimeout = setTimeout(() => {
      if (!hasRecoverySession.current) {
        setTokenError(
          "This reset link has expired or has already been used. Please request a new one.",
        );
        setStage("invalid");
      }
    }, RECOVERY_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        // ✅ This is the event we need. Clear all timers and show the form.
        clearTimeout(overallTimeout);
        if (signedInGraceTimer.current) {
          clearTimeout(signedInGraceTimer.current);
          signedInGraceTimer.current = null;
        }
        hasRecoverySession.current = true;
        // Remove the token from the URL bar now that the session is established.
        window.history.replaceState({}, "", window.location.pathname);
        setStage("form");
        setTimeout(() => pwRef.current?.focus(), 100);
      } else if (event === "SIGNED_IN" && !hasRecoverySession.current) {
        // Supabase fires SIGNED_IN before PASSWORD_RECOVERY for a recovery
        // link. We give it a brief grace window to see if PASSWORD_RECOVERY
        // follows. If it doesn't, this must be a regular session restoration
        // (e.g. the user was already logged in), which we must reject.
        signedInGraceTimer.current = setTimeout(() => {
          if (!hasRecoverySession.current) {
            clearTimeout(overallTimeout);
            setTokenError(
              "This link could not be verified as a password-reset link. Please request a new one.",
            );
            setStage("invalid");
          }
        }, SIGNED_IN_GRACE_MS);
      } else if (event === "SIGNED_OUT") {
        // A sign-out that arrives while we're still loading means the recovery
        // session was already consumed or a previous session was cleared.
        if (!hasRecoverySession.current) {
          clearTimeout(overallTimeout);
          setTokenError(
            "This reset link has expired or has already been used. Please request a new one.",
          );
          setStage("invalid");
        }
      }
    });

    return () => {
      clearTimeout(overallTimeout);
      if (signedInGraceTimer.current) clearTimeout(signedInGraceTimer.current);
      subscription.unsubscribe();
    };
  }, []);

  // ── Form validation ──────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: { password?: string; confirm?: string } = {};
    const pwErr = validatePassword(password);
    if (pwErr) errs.password = pwErr;
    if (!confirm) errs.confirm = "Please confirm your new password.";
    else if (confirm !== password) errs.confirm = "Passwords do not match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit new password ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Double-check that we genuinely have a recovery session before calling
    // updateUser — guards against race conditions or direct form submissions.
    if (!hasRecoverySession.current) {
      setServerError("Your session is no longer valid. Please request a new reset link.");
      return;
    }

    setStage("submitting");
    setServerError("");

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setServerError(
          error.message.toLowerCase().includes("same password")
            ? "Your new password must be different from your current password."
            : "Failed to update your password. Please try again.",
        );
        setStage("form");
        return;
      }

      // Sign out after update — forces a clean login with the new password
      // through the full authentication + role-check flow. Prevents the
      // recovery session from being reused to access the admin dashboard.
      await supabase.auth.signOut();
      setStage("success");

      // Redirect to login after a brief success display.
      setTimeout(() => navigate({ to: ADMIN_LOGIN_PATH, replace: true }), 3000);
    } catch {
      setServerError("An unexpected error occurred. Please try again.");
      setStage("form");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-ivory)] px-4 py-16">
      <div
        className="w-full max-w-[420px]"
        style={{ animation: "adm-in 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--brand-paper)] px-8 py-9 shadow-lg shadow-black/5">
          {/* ── Loading ─────────────────────────────────────────────────── */}
          {stage === "loading" && (
            <div
              className="flex flex-col items-center gap-4 py-4 text-center"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="size-8 animate-spin text-[var(--brand-gold)]" />
              <p className="text-[14px] text-[var(--brand-muted)]">Verifying your reset link…</p>
            </div>
          )}

          {/* ── Invalid / expired token ──────────────────────────────────── */}
          {(stage === "invalid" || stage === "error") && (
            <div className="text-center" role="alert">
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[oklch(0.55_0.18_28/10%)]">
                <AlertTriangle className="size-7 text-[oklch(0.55_0.18_28)]" strokeWidth={1.5} />
              </div>
              <h1 className="font-[var(--font-display)] text-[26px] font-normal text-[var(--brand-charcoal)]">
                Link unavailable
              </h1>
              <p className="mt-3 text-[13px] leading-[1.8] text-[var(--brand-muted)]">
                {tokenError}
              </p>
              <div className="mt-7 flex flex-col items-center gap-3">
                <a
                  href={FORGOT_PATH}
                  className="button-gold inline-flex items-center justify-center rounded-lg text-[13px] min-h-[48px] px-8 font-semibold tracking-[0.08em] uppercase"
                >
                  Request a new link
                </a>
                <a
                  href={ADMIN_LOGIN_PATH}
                  className="text-[12px] text-[var(--brand-gold)] underline-offset-2 hover:underline"
                >
                  Back to sign in
                </a>
              </div>
            </div>
          )}

          {/* ── Success ─────────────────────────────────────────────────── */}
          {stage === "success" && (
            <div
              className="text-center"
              role="status"
              aria-live="polite"
              style={{ animation: "adm-in 0.35s ease both" }}
            >
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[oklch(0.6_0.14_155/12%)]">
                <CheckCircle2 className="size-7 text-[oklch(0.6_0.14_155)]" strokeWidth={1.5} />
              </div>
              <h1 className="font-[var(--font-display)] text-[26px] font-normal text-[var(--brand-charcoal)]">
                Password updated
              </h1>
              <p className="mt-3 text-[13px] leading-[1.8] text-[var(--brand-muted)]">
                Your password has been changed successfully. You'll be redirected to sign in in a
                moment.
              </p>
              <a
                href={ADMIN_LOGIN_PATH}
                className="mt-6 inline-block text-[13px] font-semibold text-[var(--brand-gold)] underline-offset-2 hover:underline"
              >
                Sign in now →
              </a>
            </div>
          )}

          {/* ── New password form ────────────────────────────────────────── */}
          {(stage === "form" || stage === "submitting") && (
            <>
              <h1 className="font-[var(--font-display)] text-[28px] font-normal leading-tight text-[var(--brand-charcoal)]">
                Set new password
              </h1>
              <p className="mt-2 text-[13px] leading-[1.7] text-[var(--brand-muted)]">
                Choose a strong password for your Skyrun staff account.
              </p>

              <div className="my-6 h-px w-10 bg-[var(--brand-gold)]" aria-hidden />

              {serverError && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-[oklch(0.55_0.18_28/35%)] bg-[oklch(0.55_0.18_28/8%)] px-4 py-3 text-[13px] text-[oklch(0.45_0.14_28)]"
                >
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate aria-label="Set new password">
                {/* New password */}
                <div className="mb-4">
                  <label
                    htmlFor="new-password"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <input
                      ref={pwRef}
                      id="new-password"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors(({ password: _r, ...rest }) => rest);
                      }}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? "new-pw-err" : "pw-hint"}
                      disabled={stage === "submitting"}
                      className={[
                        "w-full rounded-lg border bg-white px-4 py-3 pr-12 text-[14px] text-[var(--brand-charcoal)] outline-none transition-shadow",
                        "focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/25",
                        "disabled:opacity-60 placeholder:text-[var(--brand-muted)]/60",
                        fieldErrors.password
                          ? "border-[oklch(0.55_0.18_28)] ring-2 ring-[oklch(0.55_0.18_28)]/20"
                          : "border-[var(--border)]",
                      ].join(" ")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      tabIndex={0}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--brand-muted)] hover:text-[var(--brand-charcoal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p id="pw-hint" className="mt-1 text-[11px] text-[var(--brand-muted)]">
                    At least 8 characters, including a letter and a number.
                  </p>
                  {fieldErrors.password && (
                    <p
                      id="new-pw-err"
                      role="alert"
                      className="mt-1 text-[12px] text-[oklch(0.55_0.18_28)]"
                    >
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="mb-6">
                  <label
                    htmlFor="confirm-password"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value);
                        setFieldErrors(({ confirm: _r, ...rest }) => rest);
                      }}
                      aria-invalid={!!fieldErrors.confirm}
                      aria-describedby={fieldErrors.confirm ? "confirm-pw-err" : undefined}
                      disabled={stage === "submitting"}
                      className={[
                        "w-full rounded-lg border bg-white px-4 py-3 pr-12 text-[14px] text-[var(--brand-charcoal)] outline-none transition-shadow",
                        "focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/25",
                        "disabled:opacity-60 placeholder:text-[var(--brand-muted)]/60",
                        fieldErrors.confirm
                          ? "border-[oklch(0.55_0.18_28)] ring-2 ring-[oklch(0.55_0.18_28)]/20"
                          : "border-[var(--border)]",
                      ].join(" ")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={0}
                      aria-label={
                        showConfirm ? "Hide confirmation password" : "Show confirmation password"
                      }
                      aria-pressed={showConfirm}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--brand-muted)] hover:text-[var(--brand-charcoal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirm && (
                    <p
                      id="confirm-pw-err"
                      role="alert"
                      className="mt-1.5 text-[12px] text-[oklch(0.55_0.18_28)]"
                    >
                      {fieldErrors.confirm}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={stage === "submitting"}
                  aria-busy={stage === "submitting"}
                  className="button-gold flex w-full items-center justify-center gap-2.5 rounded-lg text-[13px] min-h-[50px] font-semibold tracking-[0.08em] uppercase transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {stage === "submitting" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Updating password…
                    </>
                  ) : (
                    "Update password"
                  )}
                </button>

                <p className="mt-5 text-center text-[12px] text-[var(--brand-muted)]">
                  <a
                    href={ADMIN_LOGIN_PATH}
                    className="text-[var(--brand-gold)] underline-offset-2 hover:underline"
                  >
                    Back to sign in
                  </a>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

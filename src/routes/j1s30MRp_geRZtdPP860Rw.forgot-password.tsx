/**
 * Forgot-password route — /j1s30MRp_geRZtdPP860Rw/forgot-password
 *
 * Sends a Supabase password-reset email pointing at the approved callback URL.
 * The response is intentionally neutral — we never reveal whether an email
 * address is registered in the system (prevents user-enumeration attacks).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LOGIN_PATH, AUTH_CALLBACK_PATH } from "@/lib/admin-routes";

export const Route = createFileRoute("/j1s30MRp_geRZtdPP860Rw/forgot-password")({
  // Must be client-side only so window.location.origin is available when
  // constructing the redirectTo URL for resetPasswordForEmail.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Password Recovery — Skyrun Limo" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ForgotPasswordPage,
});

type Stage = "idle" | "busy" | "sent" | "error";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  // We keep a generic error message — never leak success/failure per address.
  const [serverError, setServerError] = useState("");

  function validateEmail(): boolean {
    if (!email.trim()) {
      setEmailError("Email address is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail()) return;

    setStage("busy");
    setServerError("");

    try {
      // redirectTo must be an exact URL listed in your Supabase project's
      // Authentication → URL Configuration → Redirect URLs allowlist.
      // We build it from window.location.origin so it automatically uses the
      // correct host in both development (http://localhost:8080) and production.
      // This route has ssr: false, so window is always defined here.
      const redirectTo = `${window.location.origin}${AUTH_CALLBACK_PATH}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });

      if (error) {
        // Rate-limit is the only safe error to surface specifically.
        if (error.message.toLowerCase().includes("rate limit")) {
          setServerError("Too many requests. Please wait a few minutes and try again.");
          setStage("error");
          return;
        }
        // For all other errors we still show the neutral confirmation to
        // prevent enumeration — but log for debugging.
        console.error("[forgot-password] Recovery request failed");
      }

      // Always show the neutral confirmation regardless of whether the address exists.
      setStage("sent");
    } catch {
      setStage("error");
      setServerError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-ivory)] px-4 py-16">
      <div
        className="w-full max-w-[420px]"
        style={{ animation: "adm-in 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Back link */}
        <a
          href={ADMIN_LOGIN_PATH}
          className="mb-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)] transition-colors hover:text-[var(--brand-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] rounded"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </a>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--brand-paper)] px-8 py-9 shadow-lg shadow-black/5">
          {stage === "sent" ? (
            /* ── Success state ─────────────────────────────────────────── */
            <div
              className="text-center"
              role="status"
              aria-live="polite"
              style={{ animation: "adm-in 0.35s ease both" }}
            >
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--brand-gold)]/15">
                <MailCheck className="size-7 text-[var(--brand-gold)]" strokeWidth={1.5} />
              </div>
              <h1 className="font-[var(--font-display)] text-[26px] font-normal text-[var(--brand-charcoal)]">
                Check your inbox
              </h1>
              <p className="mt-3 text-[13px] leading-[1.8] text-[var(--brand-muted)]">
                If an account with that address exists, you'll receive a password-reset link
                shortly. The link expires in 1 hour.
              </p>
              <p className="mt-2 text-[12px] text-[var(--brand-muted)]">
                Check your spam folder if it doesn't arrive within a few minutes.
              </p>
              <a
                href={ADMIN_LOGIN_PATH}
                className="mt-7 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] rounded"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Return to sign in
              </a>
            </div>
          ) : (
            /* ── Request form ──────────────────────────────────────────── */
            <>
              <h1 className="font-[var(--font-display)] text-[28px] font-normal leading-tight text-[var(--brand-charcoal)]">
                Password recovery
              </h1>
              <p className="mt-2 text-[13px] leading-[1.7] text-[var(--brand-muted)]">
                Enter your staff email address and we'll send you a secure reset link.
              </p>

              <div className="my-6 h-px w-10 bg-[var(--brand-gold)]" aria-hidden />

              {/* Server error (rate-limit etc.) */}
              {stage === "error" && serverError && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-[oklch(0.55_0.18_28/35%)] bg-[oklch(0.55_0.18_28/8%)] px-4 py-3 text-[13px] text-[oklch(0.45_0.14_28)]"
                >
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate aria-label="Password recovery">
                <div className="mb-5">
                  <label
                    htmlFor="recovery-email"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
                  >
                    Email address
                  </label>
                  <input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    inputMode="email"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "recovery-email-err" : undefined}
                    placeholder="you@skyrunlimo.com"
                    disabled={stage === "busy"}
                    className={[
                      "w-full rounded-lg border bg-white px-4 py-3 text-[14px] text-[var(--brand-charcoal)] outline-none transition-shadow placeholder:text-[var(--brand-muted)]/60",
                      "focus:border-[var(--brand-gold)] focus:ring-2 focus:ring-[var(--brand-gold)]/25",
                      "disabled:opacity-60",
                      emailError
                        ? "border-[oklch(0.55_0.18_28)] ring-2 ring-[oklch(0.55_0.18_28)]/20"
                        : "border-[var(--border)]",
                    ].join(" ")}
                  />
                  {emailError && (
                    <p
                      id="recovery-email-err"
                      role="alert"
                      className="mt-1.5 text-[12px] text-[oklch(0.55_0.18_28)]"
                    >
                      {emailError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={stage === "busy"}
                  aria-busy={stage === "busy"}
                  className="button-gold flex w-full items-center justify-center gap-2.5 rounded-lg text-[13px] min-h-[50px] font-semibold tracking-[0.08em] uppercase transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {stage === "busy" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

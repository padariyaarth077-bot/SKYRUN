# Deliverable I — Verification Record

## Commands run

| Command | Result |
|---|---|
| `npm test -- --reporter=dot` | **PASS:** 3 test files, 43 tests. React/jsdom emitted non-fatal warnings (empty href, `<html>` nested under test div, unwrapped state updates). Recovery tests mock Supabase and explicitly disclaim real email/token verification. |
| `npm run build` | **PASS:** Vite/Nitro production build completed. Warnings: `vite-tsconfig-paths` redundant according to Vite; `createServerFn().inputValidator()` deprecated; one image reference did not resolve at build time and remains runtime-resolved. |
| `npx tsc --noEmit` | **NOT RUN:** `npx` returned “This is not the tsc command you are looking for”; no dependency installation attempted. |
| `git status --short`, `git log -1 --oneline` | **UNAVAILABLE:** workspace has no Git repository metadata (`fatal: not a git repository`). |
| `Get-Command supabase`, `Get-Command bun` | No executable was available in the environment. No CLI/database command was attempted. |
| Source/migration inspection (`rg`, `Get-Content`) | Completed for route tree/source, tests, Supabase client/types/config, all local migration files, and public/admin UI flows. `.env` contents were not displayed/read. |

## Password recovery status

**Code present and local tests pass; live email flow not independently verified.** Current source constructs an absolute redirect URL from browser origin and `AUTH_CALLBACK_PATH`, normalizes email, has neutral response handling, waits for `PASSWORD_RECOVERY` before showing the password form, updates password, then signs out. `auth-recovery.test.ts` and `route-rendering.test.tsx` pass within the suite. The recovery test file explicitly states its Supabase mocks do not prove delivery or token validity. The task context reports owner manual success, but this audit has no independent evidence and does not claim live verification.

## Environment and manual checks outstanding

- Verify Supabase dashboard project reference is `cudisqrugjupstgdeqac`; local CLI config is `xahvwghacqbapfrgazxh`.
- Check applied migration ledger, deployed schema/policies/functions, auth redirect allowlist and email provider in the intended project.
- Owner/operator live password recovery check remains the only evidence of real delivery unless separately recorded; this audit did not repeat it.
- Verify public endpoint deploy/runtime supplies server-only `SUPABASE_URL` and service role key; do not print secrets.
- Confirm privacy wording/consent, abuse protection and relevant operational business rules.
- No live database queries, mutations, emails, customer communications, account changes, or external notifications were performed.

## Scope assurance

No application source, migration, schema, environment configuration or existing documentation file was intentionally edited. Audit documents were newly created under `docs/audits/`. Build output went to ignored/generated `.output` and `.wrangler` paths.

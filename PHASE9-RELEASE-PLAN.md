# Phase 9 — reviewed release candidate and approval scope

26 October 2026. **Ready for a controlled release decision; not deployed.** This document does not itself authorize production changes.

## Candidate

Base: released `20c1e99` (email redirect correction retained). Isolated candidate: `F:/SKYRUN/skyrun-phase9-release-check-20261026`. Archive excluded `.env` before extraction; 25 approved Phase9 source/test/schema/template overlays applied. Existing original checkout/user changes preserved. Candidate contains no `.env`. It reuses installed dependencies, without installation or services.

Overlay manifest: `F:/DockerData/phase9-release-overlay.json`. Source consists of scoped admin/status/profile/error/header/rate-limit changes and their tests; `.env.example`; pending migration. Do not publish unrelated screenshots, CLI link metadata, fixture exports or historical personal artifacts. Include reviewed release/security/team documentation as appropriate. Stop tracking `.env` in the release commit while preserving the owner's local file. Historical credential removal/retirement is not implied by this file change; owner reports rotation complete, independently unverified here.

Migration: `supabase/migrations/20261024090000_phase9_security_hardening.sql`.

Canonical LF SHA256: `c1f07f9def8c1888ecbb4518ef97f77d9581ce710a80c10c58a8ecd4039111ce`.

Hosted preflight: `PHASE9-HOSTED-COMPATIBILITY-PREFLIGHT.md`. All checked dependencies/targeted policies present; no Phase9 objects/partial installation. All26hosted public tables have RLS. Read-only project verified as `cudisqrugjupstgdeqac`; no legacy project relink.

## Checks executed for this candidate

| Check | Result |
|---|---|
| Full unit/component suite |452/452,32files,67.19seconds |
| TypeScript | exit0 |
| Full lint | exit0;0errors,10existing Fast Refresh warnings |
| Production build without.env | exit0 |
| Configured server secrets supplied to build | None; only three client-safe Supabase variables supplied |
| Build project | Intended public project/URL checked; key classified public/anon rather than service |
| Read-only public Auth settings GET |200; provided client key accepted; no login/user mutation |
| Npm manifest root vs lockfile dependencies/devDependencies | Both match |
| Public output known-secret comparison |74files,1known private value,0matches |
| Public output server-code name scan | No SUPABASE_SERVICE_ROLE_KEY/phase9_budget/phase9_contact/createHmac match |
| Compiled adapter/request chain | cf metadata preserved into real TanStack handler; concurrent synthetic request isolation passed; IP header alone not trusted;0network requests/0services |
| Diff whitespace | Passed |

First archive lint encountered Windows CRLF materialization. Normalized only the isolated candidate's text line endings; resumed lint/build. No rules disabled or semantics weakened. Source/framework checks used actual installed code; the in-memory test attaches synthetic cf metadata and does not claim a native production Workers execution. Keep targeted postflight/runtime monitoring after release.

Earlier isolated Supabase security/concurrency/rollback/browser checks remain as recorded in PHASE9-VERIFICATION.md; no migration or new database integration run during this preparation, because SQL/controlled operations have not changed. Final corrected whole migration has not been freshly replayed on an empty database. No reset/deletion performed.

Commands/evidence:

- `node F:/DockerData/phase9-prepare-release.cjs`
- `node F:/DockerData/phase9-clean-check.cjs` (unit/types passed, first lint CRLF failure)
- Normalize candidate checkout line endings, then `node F:/DockerData/phase9-clean-check.cjs --finish` (lint/build passed).
- `node F:/DockerData/phase9-request-chain.mjs` (in-memory compiled adapter probe; no server started).
- Logs: `F:/DockerData/phase9-clean-unit.log`, `phase9-clean-types.log`, `phase9-clean-lint.log`, `phase9-clean-build.log`.

## Confirmed Cloudflare CI problem and proposed settings

Read-only dashboard inspection of historical build af3e9c7b shows auto `bun install --frozen-lockfile` fails before configured `npm ci && npm run build`: package.json added Supabase since Bun lock was saved. Current Build settings independently show no build variables configured. Existing runtime SKIP_DEPENDENCY_INSTALL does not establish a build variable.

Proposed **build-only** variables (values must stay out of reports/chat):

1. `SKIP_DEPENDENCY_INSTALL=true`.
2. `VITE_SUPABASE_URL` from the verified public configuration.
3. `VITE_SUPABASE_PROJECT_ID` from the verified public configuration.
4. `VITE_SUPABASE_PUBLISHABLE_KEY` from the verified public configuration, checked to be public/anon, never service-role.

Keep build command `npm ci && npm run build`. Do not delete/replace lockfiles merely to force green; do not place server/provider secrets into build configuration. Npm dependency installation itself has not been freshly executed in this preparation. Actual Cloudflare CI success must be checked after the separately approved settings change.

Cloudflare documents SKIP_DEPENDENCY_INSTALL as a build variable accepting1/true: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/ . Runtime and build environment configuration are distinct. No settings changed yet.

The CI deploy command should explicitly retain the intended Worker, existing compatibility date and variables: `npx wrangler deploy --config .output/server/wrangler.json --name skyrun --compatibility-date 2026-10-20 --keep-vars`. Verify logging/bindings after any CI deployment as well as manual release. Do not print runtime secret values.

## Exact coordinated rollout proposed for approval

1. Temporarily pause Git-triggered Worker builds before publishing, so an app cannot activate before its required migration. Existing Worker continues serving; do not disconnect repository/delete builds.
2. Configure only the four build variables above and reviewed deploy-command flags; preserve runtime secrets/modes, bindings, routes, compatibility and observability. General email automation remains disabled.
3. Prepare a clean release commit on latest remote main with the reviewed Phase9 source, migration, safe template/docs and tracked.env removal. Preserve the original local file and unrelated working-tree changes. Confirm no concurrent remote changes, unexpected files or secret values.
4. Reverify intended hosted target and object absence read-only immediately before action. Apply only the approved migration, retaining its transaction/timeouts. No db push, reset, backfill, deletion, role/user change or migration-ledger repair.
5. Read-only postflight: RLS, signatures, new helper grants, direct-write/TRUNCATE restrictions, trigger/index/column existence and quote audit replacements. Compare source metadata and business aggregate invariants. If an operation fails, verify rollback/actual state before retry.
6. Deploy reviewed clean artifact to Worker skyrun, retaining all runtime secrets/settings and existing compatibility date. No real messages, financial actions or new test fixtures. Staff should refresh open tabs: old direct-update clients will fail safely after migration until refreshed.
7. Check public/login/protected route responses, browser data access and response headers without operational mutations. Native per-client budget behaviour remains a monitored release/runtime check, not retroactively proven by unit tests. Keep all email automation off.
8. Resume Git builds only once schema/app match and the configuration is reviewed. Inspect the next actual CI outcome. Do not repeatedly trigger deployment to mask a failure; a fresh CI run is not already certified by the local build.

No unconditional rollback to broad ACLs/forgeable generic audit writes. Prefer reviewed source/forward correction if deployment fails. A failed coordinated rollout may temporarily block old-client lead/profile actions; report that honestly and keep changes fail-closed. Do not restore the exposed credential or automatically send queued messages.

## Other remaining boundaries

- Two queued synthetic confirmation/cancellation messages must remain unattempted until a separately approved queue/automation plan. Do not clear them during this release.
- Preserve the live email fix and verified enquiry→acceptance→booking flow.
- Existing all-staff quote policy/scoped audit reads are preserved; changing those business policies needs separate agreement.
- Final all-role/device/accessibility/load/recovery checks belong to subsequent QA. No Phase10 work or production certification claimed here.

## Current production status for this task

Read-only checks only: metadata, public Auth settings and dashboard CI inspection. No migration, production writes, deploy/publication, settings change, email, staff account change or destructive cleanup. Team manual: `SKYRUN-TEAM-OPERATIONS-MANUAL.md`.

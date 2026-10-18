# Phase 1 verification — updated 18 October 2026

**Later hosted update:** following the owner's instruction to proceed and Supabase login, the specific Phase 1 migration was applied to cudisqrugjupstgdeqac. Actual public Worker submissions and concurrent duplicate retries passed; two labelled enquiries were retained. See [HOSTED-VERIFICATION.md](HOSTED-VERIFICATION.md) for the current results, references and remaining authenticated staff UI limitations. Statements below about hosted application being pending describe the earlier local verification stage.

## 1. Overall status

**Local Phase 1 verification complete; hosted application remains pending approval.** The customer ride-enquiry workflow was verified locally, including real Supabase concurrency, rollback, permissions, RLS and browser tests. The subsequently authorized maintenance pass resolved all ten TypeScript errors and all 398 lint errors. Hosted deployment was outside the authorized work.

### Subsequent maintenance verification — 18 October 2026

| Command | Current result | Log |
|---|---|---|
| node node_modules/typescript/bin/tsc --noEmit | Passed, zero errors | quality-typecheck.log |
| npm run lint | Passed, zero errors, nine existing Fast Refresh warnings | quality-lint.log |
| npm test -- --maxWorkers=1 | Passed, 162 tests in ten files | quality-tests.log |
| node node_modules/vitest/vitest.mjs run src/test/chat.functions.test.ts --maxWorkers=1 | Passed, six tests | quality-chat-tests.log |
| npm run build | Passed | quality-build.log |

The full test suite was rerun separately after an initial concurrent build/test run stalled. Only the completed run above is counted. Database and browser integration were not repeated for this maintenance pass; their earlier results below remain historical results.

Behavioral changes were limited to fixing two malformed chat session validators, replacing deprecated chat validator calls with the existing validator API, specifying the chat RPC response types, adding the two schema-confirmed conversation foreign-key relationships to the TypeScript model, guarding optional realtime conversation selection, and making the preview storage timer constant. Redundant widget type assertions were removed. Six new tests cover valid load/handoff, invalid sessions before database access, hashed session mapping and safe database errors. ESLint autofixes applied formatting across existing source files and removed an unused suppression; no lint rules were weakened.

## 2. What was implemented

The public form validates calendar dates and passenger values, blocks rapid duplicate clicks, preserves values and the submission key after failure, resets only after a confirmed reference, and offers an explicit new-enquiry reset. Confirmation accurately says the enquiry awaits review and the ride is not confirmed.

Customer matching respects the seeded Skyrun Limo business unit and existing unique email/phone indexes. The RPC creates a NEW/RIDE_ENQUIRY lead, a linked SUBMITTED ride request and two creation activities in one transaction. Email matching takes precedence over an exact trimmed-phone match; existing customer details are preserved. Hourly chauffeur requests use HOURLY; other supported services default to ONE_WAY. Vehicle preference, service and luggage notes remain in the existing notes fields.

Admin lead details display the linked customer and structured trip. Existing Ride Enquiries and Ride Requests references now open those details. Contact Messages remains filtered to CONTACT_FORM. Lead-list failures display a safe retry action. The /book form uses the existing dark theme so its fields, select placeholder and date/time controls remain readable.

## 3. Files changed

All paths below are relative to F:/SKYRUN/skyrun.

| File | Change |
|---|---|
| src/lib/ride-enquiry.shared.ts | Real calendar validation; reject boolean/object passenger coercion. |
| src/lib/leads.functions.ts | Validate RPC confirmation; scope generic-contact customer lookup to the limo business unit. |
| src/lib/admin-data.ts | Distinguish failed lead reads from successful empty results. |
| src/components/skyrun-site.tsx | Client validation, in-flight guard, retry/reset handling, accurate confirmation, explicit new enquiry. |
| src/components/inner-page.tsx | Apply the existing dark form panel on /book. |
| src/styles.css | Readable service placeholder and native date/time controls. |
| src/routes/_authenticated/admin.leads.index.tsx | Safe load failure and retry state. |
| src/routes/_authenticated/admin.leads.$id.tsx | Structured trip details and meaningful missing/error states. |
| src/routes/_authenticated/admin.index.tsx | Handle the shared lead-read failure on the dashboard. |
| src/routes/_authenticated/admin.m.$module.tsx | Link existing lead/request references to the related lead detail. |
| supabase/migrations/20261016090000_phase1_ride_enquiries_pending_approval.sql | Null guards, scoped phone/email conflict handling, secure UUID generation, explicit privilege revocation, hourly trip type; hosted application remains pending. |
| src/test/ride-enquiry.shared.test.ts | Invalid calendar dates and leap-year regression cases. |
| src/test/booking-form.test.tsx | Actual form mapping, duplicate-click, failure/retry, confirmation/reset and new-key tests. |
| src/test/leads.functions.test.ts | Actual validator/handler tests with mocked transport/database; tenant and generic-contact regression tests. |
| src/test/admin-enquiries.test.tsx | Actual lead list/detail component rendering, filtering, trip/customer display and safe error/retry states. |
| src/test/admin-data.test.ts | Shared lead-read error and empty-result behavior. |
| scripts/phase1-integration.mjs | Thirteen real, strictly local Supabase integration scenarios. |
| scripts/phase1-browser.mjs | Six real browser checks using bundled Playwright, local-only networking and in-memory credentials. |
| scripts/phase1-gateway.mjs | Separate authenticated local gateway using a fresh image; one worker for the available RAM. |
| PHASE1-VERIFICATION.md, phase1-*.log, phase1-public-confirmation.png, phase1-admin-enquiry.png | This report, command evidence and verified workflow screenshots. |

The existing Supabase types were inspected; Phase 1 RPC arguments and submission_key agree with the tested schema. The types file was not regenerated or edited in this work. No unrelated modules were implemented. Normal build outputs were generated.

## 4. Database changes and tested environment

All six migrations applied successfully to a fresh local application schema: the three October 6 bootstrap migrations, October 7 base schema, October 15 chat migration and October 16 ride-enquiry migration. The final hourly-type correction was then applied non-destructively by reapplying the additive Phase 1 SQL to the same isolated database. Existing test records remained. All six migration copies in the final workspace match the repository.

- Workspace: F:/SKYRUN/skyrun-phase1-core.
- Local project: skyrun-phase1-core.
- API: http://127.0.0.1:56341; database port: 56342.
- Database container: supabase_db_skyrun-phase1-core, verified by Docker project/workdir labels.
- Tested versions: Supabase PostgreSQL 17.6 (image 17.6.1.136), GoTrue 2.186.0, PostgREST 14.1 and Kong 2.8.5.
- Docker storage: F:/DockerData/DockerDesktopWSL, verified after the owner moved it.

The earlier disk-full failure damaged cached images. Fresh official images were used in a separate local project. Existing named user containers and retained volumes were preserved. The CLI automatically removed its own new temporary setup artifacts on failed initialization; no manual database reset, volume deletion or prune command was issued.

Realtime, Storage, Studio, mail testing and other unrelated services were excluded from this Phase 1 environment. Auth, JWT validation, API-key authentication, authorization and RLS remained enabled. The native CLI's startup gateway probe was bypassed because the separate gateway was created afterwards. Authenticated readiness, an unauthenticated 401 check, integration tests and browser tests supplied the actual verification evidence.

Representative initialization commands actually executed:

    $env:SUPABASE_PROJECT_ID = 'skyrun-phase1-core'
    & 'F:/SKYRUN/skyrun/node_modules/@supabase/cli-windows-x64/bin/supabase.exe' start --workdir F:/SKYRUN/skyrun-phase1-core --ignore-health-check --exclude kong,studio,postgres-meta,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,mailpit
    node scripts/phase1-gateway.mjs

The separate gateway uses the fresh official Kong 2.8.5 image without replacing an existing cache tag. Automatic approval review rejected an earlier combined image-retag/start command with only 'blocked by policy'; that operation was abandoned. The successful approach created a separate container and preserved the previous artifacts.

An early local startup inherited a hosted-looking project name through automatic environment loading. Docker labels and the local bound port established it was local; it was stopped before database initialization. Subsequent commands ran from the isolated workspace with an explicit local project ID. Neither hosted project link/reference was changed. The original supabase/config.toml still contains xahvwghacqbapfrgazxh.

The final test containers and Docker Desktop were stopped after verification to release RAM; their successful local database and synthetic fixtures were retained. Hosted migration status: **not applied, pending separate review and approval**.

## 5. Test results

| Command | Final result | Evidence |
|---|---|---|
| npm test -- --maxWorkers=1 | 156 passed, 9 files, 0 failures | phase1-tests-single-worker.log |
| npm test -- --maxWorkers=1 src/test/ride-enquiry.shared.test.ts src/test/leads.functions.test.ts src/test/booking-form.test.tsx src/test/admin-enquiries.test.tsx src/test/admin-data.test.ts | 109 passed, 5 files, 0 failures | phase1-focused.log |
| node --test scripts/phase1-integration.mjs | 13 passed, 0 failures | phase1-integration.log |
| node scripts/phase1-browser.mjs | 6 end-to-end checks passed, exit 0 | phase1-browser.log |
| node node_modules/typescript/bin/tsc --noEmit | Failed, exit 2, 10 errors in untouched chat files | phase1-typecheck.log |
| npm run lint | Failed, exit 1, 398 errors and 10 warnings | phase1-lint.log |
| npm run build | Passed, exit 0 | phase1-build.log |
| Targeted ESLint for core changed helpers/routes/tests and the three infrastructure scripts | Passed, exit 0 | phase1-changed-lint.log; phase1-integration-lint.log |
| Built client artifact scan | 52 client files scanned, 0 privileged tokens found | phase1-client-secret-scan.log |

The targeted lint command excluded older minified website/module files that still have formatting findings; full lint above includes them. No lint rules were disabled. The earlier default-worker test retry ran out of memory; the final single-worker suite passed. Early failed setup/browser attempts were resolved and are not counted as passing verification.

Database checks include twelve simultaneous retries with one customer/lead/request and two activities; six concurrent distinct enquiries sharing one customer; email/phone matching; consistent retry references; a new key creating a new enquiry; invalid/null tenant and malformed values leaving no writes; unique-index enforcement independent of locking; and a late activities-insert failure rolling back all four tables under service_role. The failure-injection trigger and transaction were rolled back.

Browser checks cover the unauthenticated admin redirect, failed public submission preserving values, real form/server/RPC persistence and successful reset, source-filtered admin lists and detail links, real local staff login/review, and absence of the service-role key in loaded scripts. Browser requests were restricted to the local app and local Supabase origins.

## 6. Security verification: executed versus static

Executed against local Supabase: RLS flags on customers/leads/ride_requests/activities; RPC grants denying anon and authenticated while allowing service_role; SECURITY DEFINER and empty search_path; signed-in staff business-unit isolation; denial for another business unit and a roleless user; anonymous denial; invalid bearer token returning 401; gateway denial without an API key; and rejection of unauthorized/null RPC business units.

Executed through the application: independent shared validation/handler tests, server-selected tenant mapping, safe public failure feedback, confirmed success before reset, real authenticated admin access and review. Loaded browser scripts and built client artifacts were checked for privileged credentials. No authentication, RLS or authorization was disabled.

Reviewed statically: fully qualified table references, migration dependencies, the server-only privileged-client import, the unchanged generic-contact behavior apart from tenant scoping, and the absence of customer email/SMS/payment integrations. Complete hosted configuration, every staff-role permutation, opaque hosted API keys, Realtime/Storage behavior and unrelated admin modules were not tested.

## 7. Remaining errors and limitations

The previously recorded ten TypeScript and 398 lint errors are resolved by the authorized maintenance pass. Nine Fast Refresh export warnings remain; they do not fail lint. The older results in section 5 describe the original verification, not the current maintenance results above.

Build warnings remain for vite-tsconfig-paths, an unresolved executive image asset reference and large chunks. Deprecated chat validator warnings are resolved. The generated Supabase type model is manually narrowed; full schema/type parity beyond the reviewed relationships and tested Phase 1 fields is not established.

This checkout has no .git directory. The final patches, callers, SQL, source files and screenshots were manually reviewed; a historical Git diff was unavailable. Local tests do not prove hosted schema/configuration equivalence. C: remained low on free space during testing; Docker data is now on F: and the test stack was shut down.

## 8. Production safety confirmation

**No hosted database was accessed or modified.** No db push, remote migration/SQL, project relinking, production reset, truncate, drop or user-data cleanup was performed. Integration and browser tests used only local credentials and synthetic fixtures. No passwords, tokens or key values were printed or placed in source, tests, reports or terminal logs. Local gateway credentials exist only in its runtime container configuration.

## 9. Manual verification and reproduction

To replay the automated local journey without exposing fixture credentials, start Docker Desktop, then resume the retained containers:

    docker start supabase_db_skyrun-phase1-core
    docker start supabase_auth_skyrun-phase1-core supabase_rest_skyrun-phase1-core supabase_kong_skyrun-phase1-core
    node --test scripts/phase1-integration.mjs
    node scripts/phase1-browser.mjs

The browser script starts the app at http://127.0.0.1:56500 with local credentials held in memory and stops that app afterwards. It creates a synthetic local staff account and keeps its credentials out of output. For a manual session, configure the existing app with only the local Supabase URL/keys and use a local staff account through the existing authentication setup; do not reuse production credentials.

1. Open /book, fill name/email/phone/service/pickup/drop-off/date/time/passengers and optional vehicle/luggage notes.
2. Submit and confirm an SR reference plus the pending-review message. The fields should clear only after that confirmation.
3. On a failed request, confirm all values remain; retry the same enquiry. Use Start a new enquiry only when intentionally starting a new logical submission.
4. Sign in locally; open /admin/leads/?status=NEW, search the reference and open its detail.
5. Confirm NEW/RIDE_ENQUIRY, the linked customer, structured trip, SUBMITTED request and creation activity.
6. Open /admin/m/ride-enquiries and /admin/m/ride-requests; their reference links should open the same detail. /admin/m/contact-messages should exclude it.
7. Mark Genuine through the confirmation dialog. The lead should become GENUINE while the request remains SUBMITTED, with no customer confirmation email.

Verified screenshots: [public confirmation](F:/SKYRUN/skyrun/phase1-public-confirmation.png) and [admin enquiry](F:/SKYRUN/skyrun/phase1-admin-enquiry.png).

## 10. Single next recommended action

Review the hosted migration and deployment plan before seeking separate production approval. Local Phase 1 verification and the authorized TypeScript/lint maintenance pass are finished; no hosted application has been performed.

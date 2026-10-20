## Hosted release update — 21 October 2026

The owner subsequently approved Phase 5 hosted compatibility review, migration, source publication and deployment. The targeted migration has now been applied after compatibility checks, source commit 3878993 published, and Worker skyrun deployed as version ae1fa17b-cde6-4197-98ba-f9611d3478ed. Live read-only browser/asset checks confirmed all 14 fleet photos load. Broader manual/live operational testing remains deferred. See PHASE5-RELEASE.md for release evidence; the local-stage statements below describe that earlier isolated testing only.

# Phase 5 — customers, internal configuration and fleet photos

Date: 21 October 2026 (Asia/Calcutta).

Status: **IMPLEMENTED AND VERIFIED LOCALLY — 345 unit/component tests and isolated database regressions passed. NOT DEPLOYED. Phase 5 manual/live browser verification remains deferred.**

## Approved isolated migration and verification — latest continuation

The owner explicitly approved starting Docker, applying the named Phase 5 migration only to the existing isolated Supabase environment and running its database tests. Verified project_id skyrun-phase1-core, all four preserved container project labels, database port 56342, API origin http://127.0.0.1:56341, existing Phase 4 operation and absence of the new catalogue before application. Applied only 20261021090000_phase5_customers_configuration.sql with psql ON_ERROR_STOP=1; its transaction committed successfully. SHA256: 646A1C58377A7852051EC60272EFB0594624B1D220F91D4CBDD5BF41CBEED43A. No reset, database creation, volume removal, installation, project relink or hosted operation occurred.

| Executed command | Final result | Evidence |
|---|---|---|
| Get-Content -Raw supabase/migrations/20261021090000_phase5_customers_configuration.sql piped to docker exec -i supabase_db_skyrun-phase1-core psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 | COMMIT | phase5-local-migration.log |
| $env:SKYRUN_PHASE5_LOCAL_APPROVAL='skyrun-phase1-core'; node --test scripts/phase5-operations.integration.mjs | **11 passed**, zero failed/skipped | phase5-integration.log |
| node --test scripts/phase1-integration.mjs | **13 passed**, zero failed/skipped | phase5-phase1-regression.log |
| $env:SKYRUN_PHASE3_LOCAL_APPROVAL='skyrun-phase1-core'; node --test scripts/phase3-drafts.integration.mjs | **8 passed**, zero failed/skipped | phase5-drafts-regression.log |
| $env:SKYRUN_PHASE3_ACCEPTANCE_APPROVAL='skyrun-phase1-core'; node --test --test-name-pattern='^(?!real local browser)' scripts/phase3-acceptance.integration.mjs | **8 passed**, including the local browser scenario; zero skipped according to actual runner output | phase5-acceptance-database.log |
| $env:SKYRUN_PHASE4_LOCAL_APPROVAL='skyrun-phase1-core'; node --test --test-name-pattern='^(?!real isolated staff browser)' scripts/phase4-bookings.integration.mjs | **16 passed**, including the local staff browser scenario; zero skipped according to actual runner output | phase5-bookings-database.log |
| npm run lint (rerun after adding the eleventh database scenario) | Zero errors; nine existing Fast Refresh warnings | phase5-lint.log |

Phase 5 coverage now includes actual JWT role/tenant enforcement, trusted SUPER_ADMIN, ADMIN/MANAGER, lesser/roleless/mixed roles, concurrent identical retries with one audit, stale versions, uniqueness rejection, direct-write denial, image assignment protection, forged-activity rejection, catalogue deactivation, and a late audit-trigger failure that rolls back the preceding contact update. The temporary fault trigger was created within a transaction and rolled back; a read-only postcheck confirmed it is absent. Seven metadata checks in total confirmed catalogue RLS, authenticated SELECT-only customer/catalogue access, authenticated controlled RPC execution and denied anon/service-role RPC execution.

An initial Phase 3 acceptance run reached seven database successes then ended with Windows native process failure (-1073741819) before reporting completion. C: had approximately 0.17 GB free and memory was constrained; causation was not established. The subsequent command above actually executed all eight scenarios, including its browser case, and passed. The Phase 4 run also actually executed all sixteen scenarios. Counts above reflect logs, not the intended name-filter exclusions. No tests/assertions were disabled or weakened.

The local browser cases use local test accounts and synthetic acceptance/delivery evidence, not real emails. They do not clear Phase 3 LIVE VERIFICATION or Phase 4 hosted operational verification. No new Phase 5 manual browser session was run. Existing synthetic fixtures were retained; the older Phase 4 authorization test itself creates and removes one synthetic role assignment as part of its existing permission assertion, without touching user-owned records or volumes.

The local test stack and Docker Desktop were stopped afterward, retaining the migrated database and fixtures. C: free space then measured approximately 5.85 GB; no files were cleaned up or deleted to obtain that space. No hosted database connection, production data/schema operation, real email, GitHub push or deployment occurred. Only the new integration test and this report changed during this continuation; application code/migration stayed unchanged from the 345-test/TypeScript/build baseline below. The earlier verification section records those executed source checks.

## Audit and scope

Started on main at d75264f. Existing modified supabase/.temp/cli-latest, local link metadata, hosted exports, screenshots and the hosted-check script were preserved. No applicable AGENTS.md was found in the repository or its parent directories. Read existing Phase 2/3 verification documents, Phase 4 release report, base schema, later migrations, types, protected route, role helpers, logger, customer/module pages, server intake and test harnesses.

Actual gaps:

- Customers already had searchable/paginated lists and lead/ride history. They lacked contact editing, duplicate suggestions, quote/booking history and customer-specific audit display.
- The Customer History sidebar entry led to an unavailable placeholder rather than the existing customer directory.
- Services and Service Areas had no tables or persistence; their screens were placeholders. Public enquiry service options are currently a fixed server-validated list; public service-area content is static.
- Vehicles/categories already had real records but no image columns or image selection. Their old list queries also stopped at the API row cap.
- F:/SKYRUN/SKYRUN-VEHICLES contains 14 JPG/WebP files. All were copied unchanged to public/vehicle-images with safe filenames. Originals remain intact. No vehicle, capacity or ownership information was inferred from a picture or filename.
- Existing role/RLS architecture supports scoped staff reads and trusted global SUPER_ADMIN. Phase 4 established strict ADMIN/MANAGER mutation semantics. These are reused in a purpose-named operations helper.

Implementation sequence: extend existing customer pages; prepare minimal scoped/audited persistence; replace configuration placeholders and add explicit photo selection; add focused tests and isolated test harness; run regression checks; review diff. No Phase 6, dispatch, invoice, payment or public redesign work was undertaken.

## Implemented application behavior

- Customer search/refresh/pagination retains existing behavior. Possible duplicate warnings compare name, case-insensitive email or normalized phone inside the same business unit. They are suggestions, never automatic merges or updates.
- Profiles load lead, ride request, quote, booking and customer activity history. Related reads explicitly filter both customer/entity and business unit, with stable ordering and range reads. Failures are displayed as errors rather than empty history. Route changes invalidate obsolete loading responses.
- Contact editor validates name, optional email/phone, company and notes. UI permission check fails closed; backend independently checks identity and scope. Failed saves preserve input and retry the same operation ID. Pending controls and a synchronous guard prevent rapid duplicate submission. Success refreshes persisted data. Price/trip/quote/booking snapshots are not edited.
- Customer History navigation redirects to the working customer directory, where each profile exposes the connected history.
- Services/Service Areas provide scoped internal catalogue creation, review/edit, search, status filter, pagination and deactivation without deletion. Business unit is explicit; none is hardcoded. No fake or seeded service records are added.
- **Catalogue scope is internal staff reference only.** These records do not alter the public form's accepted service values, pricing, geographic eligibility, quote snapshots or booking rules. Connecting public configuration requires a separately agreed behavior and is deferred with public-site work.
- Vehicles and categories display real records, search/pagination, current capacity/status information and image pickers. Staff explicitly selects and saves a matching reference photo; photos never auto-create or auto-match vehicles. The 14-photo gallery works independently of assignments. No vehicle CRUD, driver or assignment workflow was introduced.

## Files changed

| File | Purpose |
|---|---|
| src/lib/phase5.ts | Contact/configuration validation and same-unit duplicate suggestions |
| src/lib/operations-hooks.ts | Fail-closed permission checks, guarded saves, stable retries and safe errors |
| src/components/operations-editor.tsx | Customer contact editor |
| src/components/service-configuration.tsx | Internal service and service-area management |
| src/components/fleet-images.tsx | Existing fleet records, photo preview/selection and catalogue |
| src/lib/vehicle-images.ts | Explicit manifest of the 14 supplied photographs |
| public/vehicle-images/* | Unchanged copies of the supplied images with safe filenames |
| src/routes/_authenticated/admin.customers.tsx | Refresh and duplicate review warnings |
| src/routes/_authenticated/admin.customer.$id.tsx | Linked quote/booking/audit history, editor, duplicates and stale-response protection |
| src/routes/_authenticated/admin.m.$module.tsx | Existing navigation integrates new components; removes replaced fleet queries |
| src/integrations/supabase/types.ts | Proposed table, image columns and controlled operation signatures |
| src/test/phase5.test.tsx | 22 validation/component scenarios, including real image-file existence |
| src/test/customer-history.test.tsx | Four linked history, scope, empty/failure and missing-record scenarios |
| src/test/phase2-operations.test.tsx | Updates existing mocks for the expanded read/permission contract and adds a scope assertion; preserves prior assertions |
| scripts/phase5-operations.integration.mjs | Eleven executed local database scenarios; no migrations or emails executed by the script |
| supabase/migrations/20261021090000_phase5_customers_configuration.sql | Unapplied proposal described below |
| PHASE5-VERIFICATION.md | This report |

## Migration design — applied locally only

20261021090000_phase5_customers_configuration.sql depends on the existing Phase 1–4 schema. It has been applied to the approved isolated stack; hosted application still requires separate review and authorization:

1. One service_configuration table for service/service_area records, scoped to existing business units, with name/description/active flag, timestamps and per-unit/kind normalized-name uniqueness. No prices, map coordinates, new booking statuses, default catalogue entries or automatic data backfill.
2. Nullable image_path on existing vehicles and vehicle_categories, constrained to local JPG/WebP paths. A trigger protects only these new image fields from ordinary direct writes.
3. Extends the activities entity-type check to service_configuration, retaining every existing entity type. Adds a unique Phase 5 operation ID index for retry protection.
4. can_manage_operations and phase5_save: authenticated identity required; trusted SUPER_ADMIN or scoped ADMIN/MANAGER without conflicting lesser roles. Explicit payload allowlists, validation, entity scope, optimistic version checks, operation/entity locks and atomic authoritative audit writes. Ordinary roles cannot directly write the new catalogue; service role is not accepted as a staff identity.
5. Removes ordinary direct customer mutation privileges and restores authenticated SELECT. Existing trusted server intake and SECURITY DEFINER enquiry creation remain intact by static caller/grant review. Fleet CRUD policies outside the new image field remain unchanged.
6. Preserves the Phase 4 generic logger implementation and additionally rejects forged PHASE5_* events and phase5_operation_id metadata. No new generic logger entity-resolution paths are introduced.

All operations are inside one transaction with 5-second lock timeout and 60-second statement timeout. Existing customer/quote/booking values are not backfilled, merged or deleted. The migration committed and real Phase 5 rollback, grants/RLS and concurrency checks passed as recorded above. A full fresh-database migration replay was not run. Component mocks alone are not the evidence for those database claims.

Rollback policy: do not drop tables/columns or delete catalogue/audit data automatically. Hold deployment if local tests fail. After a future release, use a reviewed forward correction or retain the additive schema while reverting application code; privilege restoration would need its own security review. The absent hosted migration ledger is not repaired or touched.

## Executed checks

| Exact command | Result |
|---|---|
| npm run test -- src/test/phase5.test.tsx --maxWorkers=1 --pool=threads | Initial 21 focused tests passed; later final suite includes the added phone-validation scenario |
| npm run test -- src/test/customer-history.test.tsx --maxWorkers=1 --pool=threads | Four passed |
| npm run test -- --maxWorkers=1 --pool=threads | **345 passed, 22 files, zero failures**, final phase5-tests.log |
| node node_modules/typescript/bin/tsc --noEmit | Passed, exit 0, phase5-typecheck.log |
| npm run lint | Passed, zero errors, **nine existing Fast Refresh warnings**, phase5-lint.log |
| npm run build | Passed, exit 0, phase5-build.log; existing unresolved image references/code-splitting/configuration warnings remain. Generated Worker name is not the live Worker name; build is not a deployment |
| node --check scripts/phase5-operations.integration.mjs | Passed syntax check only, **not database coverage** |
| git diff --check | Passed for the changed source |
| In-memory configured-credential/JWT scan over changed source and built public text | Passed: 16 source/report files and 62 public text assets; one configured privileged value available for exact comparison, no exposure found. No values printed |
| SHA256 comparison of copied images against the supplied folder | All 14 copies match their originals |

An intermediate full run found two old customer-test mocks returning a single object where the expanded paginated query requires an array, and one timing-sensitive success assertion. Updated the mocks to reflect real API contracts, retained old behavior assertions, added explicit tenant-scope assertion, and awaited the refreshed form. Formatting and a stale-request cleanup warning were fixed only in scoped files. Final checks above passed.

## Database tests and production boundary

Docker was initially stopped. After approval, it was started with only the four preserved local core services, the migration was applied locally and tests above executed. The stack was stopped afterward. No database creation/reset, volume deletion, package installation, hosted connection, real email, GitHub publication or deployment occurred.

Approved command, **executed successfully**:

`$env:SKYRUN_PHASE5_LOCAL_APPROVAL='skyrun-phase1-core'; node --test scripts/phase5-operations.integration.mjs`

The harness verifies the preserved local project config, exact Docker label and API origin http://127.0.0.1:56341, and refuses requests to other origins. It requires the reviewed migration to be already applied; it never applies migrations. Fixture accounts and records are synthetic and retained, with credentials kept in memory and diagnostics suppressed. The eleven scenarios cover role matrix/mixed-role denial, tenant isolation, concurrent retries/audit uniqueness, contact persistence/stale edits, duplicate rollback, direct-write denial, malformed inputs, photo assignment, forged audit prevention and catalogue deactivation/versioning.

Phase 5 database permissions, transaction rollback and concurrent retry behavior were actually tested as recorded above. Local automated Phase 3/4 browser regressions passed; Phase 5 manual/live browser testing remains deferred, as requested. Phase 3 live email/acceptance and Phase 4 live booking checks remain pending from the earlier task; this phase does not clear them.

## Local command record and next approval boundary

The following local sequence was approved and completed, with target/readiness checks. Do not rerun the already-applied migration. The next release step is a separately approved read-only hosted compatibility review, followed by explicit hosted migration/publication/deployment approval. No such release actions are authorized by this local-test approval.

Executed local sequence (with readiness and target checks; retained for review, not automatic re-execution):

```powershell
Start-Process -FilePath 'C:/Users/padar/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe' -WindowStyle Hidden
docker start supabase_db_skyrun-phase1-core
# Verify database readiness and all preserved container project labels first.
docker start supabase_auth_skyrun-phase1-core supabase_rest_skyrun-phase1-core supabase_kong_skyrun-phase1-core
Get-Content -Raw supabase/migrations/20261021090000_phase5_customers_configuration.sql | docker exec -i supabase_db_skyrun-phase1-core psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
$env:SKYRUN_PHASE5_LOCAL_APPROVAL='skyrun-phase1-core'
node --test scripts/phase5-operations.integration.mjs
```

Real isolated database verification is now complete. Production compatibility inspection, migration, publication and deployment still require separate explicit authorization. Browser/live QA remains on the deferred checklist.

## Later manual checklist

After approved local migration, use only local synthetic staff/customers:

1. Open Customers; search by name/email/phone, page/refresh, inspect same-unit duplicate suggestions.
2. Open a profile; verify lead/request/quote/booking links and actual statuses. Check no-history and loading-failure states separately.
3. As ADMIN/MANAGER edit contact details; confirm persistence/audit on reload. Reject invalid/duplicate/stale updates. Verify lesser roles remain read-only.
4. Open Services and Service Areas; select an authorized unit, create/edit/deactivate records, search/filter/page, verify persistence and audit. No public service/pricing behavior should change.
5. Open Vehicles and Vehicle Categories; inspect the 14-photo catalogue, explicitly select a matching picture for an existing record and save. Reload to verify persistence. Do not infer capacity or create vehicles from photos.
6. Verify cross-tenant reads/mutations, forced save failure, rapid clicks and safe retry using the isolated integration harness.
7. Retest Phase 1 enquiry, Phase 2 lead management, Phase 3 acceptance and Phase 4 deposits against the isolated stack.

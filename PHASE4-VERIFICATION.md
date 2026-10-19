## Approved hosted release — 19 October 2026

This section supersedes earlier local-only release status below; earlier results are retained as historical evidence. The owner explicitly approved these two targeted hosted migrations, GitHub publication and Worker deployment, plus one labelled live test/email. At 10:42 UTC both migrations committed successfully to verified project cudisqrugjupstgdeqac in order: 20261019080000_phase4_authorization_hardening.sql, then 20261019090000_phase4_booking_deposits.sql. No reset, deletion, relink or migration-ledger repair was executed.

Read-only postflight verified all ten checks: deposit column and controlled RPC present; receipt RLS enabled; membership-only role-write policy absent; authenticated booking UPDATE/TRUNCATE and activity TRUNCATE denied; anonymous logger execution denied; authenticated and service-role direct receipt INSERT denied. These are metadata checks, not production adversarial mutation tests.

Deployment and live email/acceptance/booking verification are pending at this report revision. Phase 3 LIVE VERIFICATION remains UNVERIFIED until separately recorded. Local regression results below remain the executed baseline: 319 unit/component tests, 16 Phase 4 integration/browser tests, 13 Phase 1 database tests, eight draft tests, eight acceptance tests and ten browser regression checks; TypeScript/build passed and lint passed with nine existing warnings.

# Phase 4 — isolated implementation and verification

## Approved local security hardening — 19 October 2026

The owner approved local-only corrections for the hosted preflight findings. **Production was not contacted or changed during this hardening task; no deployment or real email occurred. Phase 3 LIVE VERIFICATION remains UNVERIFIED.** The hosted preflight report remains unchanged as a historical record; its production HOLD is not cleared by these local results.

Changes in this continuation:

- Added `supabase/migrations/20261019080000_phase4_authorization_hardening.sql`. It removes the membership-only `user_roles_admin` write policy, preserves own-role reads and existing trusted SUPER_ADMIN role management, and adds an authenticated scoped staff-read policy for existing team screens. ADMIN/MANAGER and lesser roles cannot assign, replace or delete role rows. Only the existing SUPER_ADMIN policy permits role mutations.
- Removed all ordinary-role privileges from bookings/activities and restored only authenticated SELECT, including removal of TRUNCATE, REFERENCES, TRIGGER and MAINTAIN. Role-table privileges likewise exclude non-row operations; its authenticated row-write grants are subject to the SUPER_ADMIN RLS policy. Trusted server/owner access is retained.
- Explicitly revoked PUBLIC/anon execution of log_activity while retaining authenticated legitimate notes/audits. Unrelated chatbot/helper grants were not changed.
- Tightened the same booking/activity and logger grant blocks in `20261019090000_phase4_booking_deposits.sql`, so a fresh Phase 4 application does not reintroduce the unwanted permissions.
- Extended `scripts/phase4-bookings.integration.mjs` with three hosted-profile security scenarios, covering all five restricted staff roles, same/cross-tenant role changes, trusted SUPER_ADMIN CRUD, team reads and metadata assertions for every unwanted privilege.
- Updated `scripts/phase3-acceptance.integration.mjs` to assert the appropriate anonymous read-denial behavior for the actual schema profile: explicit 42501/null-data denial when SELECT is revoked, or an empty RLS-filtered result on an earlier Phase 3 schema. No positive acceptance/concurrency assertions were removed.

Local application: verified exact Docker project label skyrun-phase1-core and port 56342. Inside one local transaction, simulated the verified hosted broad grants on bookings/activities/user_roles plus direct anonymous logger EXECUTE, then applied the new hardening migration. ON_ERROR_STOP was enabled. The transaction committed successfully. The preserved database already had Phase 4, so the earlier-numbered hardening migration was applied afterward locally without replaying/dropping Phase 4 objects. For a fresh release, apply 20261019080000 before 20261019090000. No database reset, volume deletion, production link change or global default-privilege alteration occurred.

Executed checks for this continuation:

| Command | Result | Evidence |
|---|---|---|
| Local hosted-grant simulation + hardening transaction | Committed successfully in isolated skyrun-phase1-core | phase4-hardening-migration.log |
| SKYRUN_PHASE4_LOCAL_APPROVAL=skyrun-phase1-core node --test scripts/phase4-bookings.integration.mjs | **16 passed**, zero failed: 15 database/security scenarios plus actual staff browser workflow | phase4-hardening-integration.log |
| node --test scripts/phase1-integration.mjs | **13 passed**, zero failed | phase4-hardening-phase1.log |
| SKYRUN_PHASE3_LOCAL_APPROVAL=skyrun-phase1-core node --test scripts/phase3-drafts.integration.mjs | **8 passed**, zero failed | phase4-hardening-drafts.log |
| SKYRUN_PHASE3_ACCEPTANCE_APPROVAL=skyrun-phase1-core node --test scripts/phase3-acceptance.integration.mjs | **8 passed**, zero failed, including concurrent acceptance and actual customer browser | phase4-hardening-acceptance.log |
| Existing phase1-browser.mjs evaluated via node --input-type=module with isolated Phase 3 flag and local-only runtime environment | **10 browser checks passed**; screenshot filenames replaced in memory with new phase4-hardening-* names | phase4-hardening-browser-regression.log |
| npm run test -- --maxWorkers=1 --pool=threads | **319 passed** in 20 files | phase4-hardening-tests.log |
| node node_modules/typescript/bin/tsc --noEmit; npm run lint; npm run build | All passed, exit 0; lint has zero errors and nine existing Fast Refresh warnings; build retains known image/config warnings | phase4-hardening-typecheck.log, phase4-hardening-lint.log, phase4-hardening-build.log |

An initial overlapping browser run was rerun sequentially to avoid sharing its test port. A prior anonymous-read assertion failed because the new policy correctly denied SELECT; the profile-specific assertion above corrected the test expectation without restoring access. Final logs above contain the successful executions. No tests were skipped or disabled.

The original CLI metadata, hosted exports, existing screenshots, Phase 4 application changes and hosted compatibility report were preserved. Only the security migration, Phase 4 grant blocks, two integration test files and this related report were changed in this continuation. Local services were stopped afterward with volumes/fixtures retained. No commit or push was performed. Final diff checks passed; a scan of five changed security files/report and 58 public text assets found no configured privileged credential values (phase4-hardening-secret-scan.log).

Remaining gates: a full fresh-database replay was not run; the real preserved database hardening and workflow regressions were executed. Repeat read-only hosted preflight before release, review both migration files and approve the targeted hosted migration/deployment separately. Hosted authorization/privileges are **not fixed yet**. Do not automatically repair the absent hosted migration ledger or push unrelated migrations. Real Phase 3 email/acceptance verification remains outstanding.

Earlier implementation results below are historical context.

Date: 19 October 2026 (Asia/Calcutta).

Status: implemented locally; NOT RELEASED. Phase 3 LIVE VERIFICATION remains **UNVERIFIED**. No production database connection, hosted operation, real email, deployment, commit or push occurred during this task.

## Inspection and implementation plan

Started on main at 9b23cb4. Existing CLI metadata changes, hosted verification exports, screenshots and the untracked hosted-check script were preserved. No applicable repository AGENTS.md was found in the earlier read-only audit. Rechecked booking/quote types, schema, staff/tenant helpers, RLS, generic logger, admin routes and existing isolated test harnesses before editing.

The quote schema has no deposit policy. The solution stays booking-level. Existing booking statuses and Phase 3 acceptance remain unchanged. The initial local legacy-status inspection found eleven PENDING bookings; no existing local dispatch-state behavior was altered. Hosted records were not inspected.

Plan executed: add exact booking deposit requirement and protected evidence; implement a locked, authorized, audited operation; extend existing booking screens; exercise isolated database/browser/regression tests; run source checks and review the diff.

## Files changed

| File | Purpose |
|---|---|
| supabase/migrations/20261019090000_phase4_booking_deposits.sql | Nullable requirement, receipts, reversals, scoped reads, controlled mutations, idempotency and write/audit protections |
| src/integrations/supabase/types.ts | Matching column, table and RPC types |
| src/lib/booking-deposits.ts | Exact-input validation and integer-cent presentation totals |
| src/components/booking-deposits.tsx | Evidence/history, permission-gated forms, blocking reasons, retry preservation and payment exception |
| src/routes/_authenticated/admin.booking.$id.tsx | Integrates operations; displays authoritative event, actor and cancellation/reversal reason |
| src/routes/_authenticated/admin.m.$module.tsx | Honest all-status booking copy and required-deposit column |
| src/test/booking-deposits.test.tsx | Fifteen input, total, UI, permission/failure/retry/pending/terminal/exception tests |
| scripts/phase4-bookings.integration.mjs | Guarded isolated fixtures, twelve database scenarios and one actual browser workflow |
| PHASE4-VERIFICATION.md | This report |

## Database design and execution boundary

Migration applied only to the existing preserved skyrun-phase1-core environment. Docker label was checked as exactly skyrun-phase1-core; database loopback port was 56342 and API was http://127.0.0.1:56341. Local psql used ON_ERROR_STOP and the migration's transaction committed. A subsequent local CREATE OR REPLACE of the same action function tightened payload validation/reference normalization during development; final checked-in function was exercised successfully afterward. No reset, volume deletion, new database or data cleanup occurred. Containers and Docker were stopped after tests; fixture rows and volumes remain.

- required_deposit_amount: nullable numeric(10,2), nonnegative; no backfill, formula or default deposit. Explicit authorized zero is allowed. Requirement changes lock after any receipt exists or status leaves PENDING.
- booking_deposit_receipts: exact positive amount, booking currency, normalized tenant-unique transaction reference, received date, recording actor/time and verification actor/time. Unverified evidence never counts. Receipt input rejects URLs, future/nonfinite dates, excessive precision and currency mismatch. No card/bank fields or public evidence URLs are provided.
- booking_deposit_reversals: append-only original-receipt reference, reason, actor and time; one reversal per receipt. Original evidence remains. Only verified, matching-currency receipts without reversal count.
- can_manage_booking(uuid): authenticated authorization; trusted SUPER_ADMIN global access; ADMIN/MANAGER only in the booking's business unit. Lesser roles in that same unit cause mixed-role denial. A higher role in another unit cannot elevate access. Service role alone is not a staff identity.
- phase4_booking_action(uuid,uuid,text,jsonb,timestamptz): requirement, receipt, verify, reverse, confirm, cancel and complete actions. One booking lock serializes state/evidence changes; expected updated_at rejects stale actions. Exact operation retries return the previous result without a second activity. Changed payload/actor/booking cannot reuse an operation identifier. Unknown payload keys are rejected.
- Each successful operation and authoritative event commits atomically. Authority comes from auth.uid(), not caller-provided actor data. Confirmation checks acceptance proof and saved amount/currency/trip fields. No ordinary path edits agreed terms.
- Direct authenticated booking INSERT/UPDATE/DELETE, evidence writes and activity writes are revoked. Existing Phase 3 SECURITY DEFINER acceptance still creates one PENDING booking. Generic log_activity retains legitimate Phase 1–3 behavior, but rejects reserved workflow types/metadata and permits only NOTE events for bookings. The controlled function has explicit authorization, empty search_path and restricted execution grants. New evidence tables have RLS and scoped SELECT only.

## Lifecycle and financial semantics

| Action | Gate and result |
|---|---|
| Quote acceptance | Existing capability creates exactly one PENDING booking; requirement starts NULL |
| Set requirement | Authorized, explicit amount; PENDING with no receipts |
| Record receipt | Authorized; explicit requirement exists; PENDING/CONFIRMED; starts unverified |
| Verify | Authorized explicit attestation of externally received funds; once per receipt |
| Reverse receipt | Verified receipt, mandatory reason; preserve booking status and original evidence |
| Confirm | PENDING, explicit requirement, sufficient eligible receipts, accepted snapshot proof; sets confirmed_at |
| Cancel | PENDING/CONFIRMED, nonblank reason; records actor/time and cancelled_at |
| Complete | CONFIRMED, explicit staff attestation; sets completed_at |

COMPLETED/CANCELLED are terminal for lifecycle changes. Financial reversal can still record the truth without reopening the trip. Post-confirmation reversal raises a visible detail-page exception even when trip status is terminal; it does not cancel/refund. ASSIGNED, DRIVER_ASSIGNED, IN_PROGRESS and NO_SHOW have no new Phase 4 transitions.

## Tests actually executed

All database/browser commands used the fixed isolated environment; no hosted credentials or .env values were used in the integration harness. No packages were installed. Earlier failing browser selectors/format/type checks were corrected; use the final result logs below, not early runs.

| Command | Final result | Evidence |
|---|---|---|
| SKYRUN_PHASE4_LOCAL_APPROVAL=skyrun-phase1-core node --test --test-name-pattern '^(?!real isolated)' scripts/phase4-bookings.integration.mjs | Runner reported 13 passed, 0 failed: 12 database scenarios and 1 actual browser workflow | phase4-database.log |
| SKYRUN_PHASE4_LOCAL_APPROVAL=skyrun-phase1-core node --test --test-name-pattern '^real isolated' scripts/phase4-bookings.integration.mjs | Focused repeat: 1 browser test passed | phase4-browser.log |
| node --test scripts/phase1-integration.mjs | 13 passed, 0 failed | phase4-phase1-regression.log |
| SKYRUN_PHASE3_LOCAL_APPROVAL=skyrun-phase1-core node --test scripts/phase3-drafts.integration.mjs | 8 passed, 0 failed | phase4-drafts-regression.log |
| SKYRUN_PHASE3_ACCEPTANCE_APPROVAL=skyrun-phase1-core node --test --test-name-pattern '^(?!real local browser)' scripts/phase3-acceptance.integration.mjs | Runner reported 8 passed, 0 failed, including its browser check | phase4-acceptance-regression.log |
| Existing scripts/phase1-browser.mjs evaluated through node --input-type=module with SKYRUN_PHASE3_LOCAL_APPROVAL=skyrun-phase1-core, NODE_OPTIONS=--max-old-space-size=384 | 10 actual browser regression checks passed | phase4-browser-regression.log |
| npm run test -- --maxWorkers=1 --pool=threads | 319 passed in 20 files | phase4-tests.log |
| node node_modules/typescript/bin/tsc --noEmit | Passed, exit 0 | phase4-typecheck.log |
| npm run lint | Passed: zero errors, nine existing Fast Refresh warnings | phase4-lint.log |
| npm run build | Passed, exit 0; image-resolution and build-configuration warnings | phase4-build.log |

The existing browser regression source was read in memory and its three screenshot names replaced with new phase4-regression-* names before stdin execution. Original source and existing screenshots were not overwritten. New regression screenshots are local evidence only.

Coverage: explicit zero/missing requirement; partial/unverified/reversed/wrong-currency evidence; duplicate reference; frozen requirements; actual local JWTs for ADMIN/MANAGER and restricted roles; roleless/anonymous/service-role-without-staff denial; SUPER_ADMIN cross-unit behavior; mixed roles/tenant isolation; direct booking/evidence/activity bypasses; ordinary notes; confirmation/reversal and cancellation/completion races; terminal/dispatch statuses; changed-payload idempotency; late-audit rollback; accepted snapshot/one-booking protection. The browser exercised requirement, unverified receipt, verification, confirmation, manual completion, reload and five authoritative actor-attributed events.

Source credential scan passed across eight changed source/test/migration files without printing values (phase4-secret-scan.log). Public text assets were independently scanned after the successful build (phase4-bundle-scan.log); no configured privileged credential values were found. Final tracked diff reviewed; unrelated CLI metadata and existing artifacts were left in place. No tests or lint rules were disabled.

## Limitations and release gates

- Phase 3 LIVE VERIFICATION remains UNVERIFIED; no PHASE3-LIVE-VERIFICATION.md exists.
- Manual verification is staff attestation of funds received externally, not independent bank/payment-provider validation. Failed/pending attempts are not payment-processor records; unverified evidence cannot count.
- No payment collection, refunds, automated customer messages, driver/vehicle assignment or dispatch was implemented.
- Full fresh-database migration replay was not executed; compatibility was exercised on the preserved isolated Phase 1–3 schema. No hosted schema/legacy-record inspection occurred in this task.
- Existing unsupported dispatch states remain read-only. Existing bookings have no automatic deposit requirement. Staff must explicitly set one on eligible PENDING bookings.
- No production confirmation, cancellation, completion, deposit verification or reversal was performed. No deploy/production migration is authorized by this task.

## Manual local check and next approval

Start the preserved isolated stack and an app configured only for its loopback API; use a local ADMIN/MANAGER session. Open a synthetic accepted PENDING booking: confirm is blocked for missing requirement. Explicitly set an amount, record partial receipts, observe unverified evidence excluded, attest verification and confirm only after the eligible total is sufficient. Reverse a verified receipt after confirmation: status must stay CONFIRMED and a payment exception must appear. Cancel with a reason or complete with attestation; reload and check actor/time/history. Restricted staff must see read-only controls and direct requests must fail.

Next requires separate owner approval: review this migration and local evidence; authorize a read-only hosted compatibility/legacy-record preflight, then separately authorize the hosted migration and application deployment. Do not run db push/reset, delete data or silently apply old migrations. Preserve the new write protections on rollback; use a reviewed forward correction rather than dropping audit/evidence data. After approved release, authorize labelled live verification separately. Phase 3 live delivery/acceptance still needs its own evidence.

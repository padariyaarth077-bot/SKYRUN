# Phase 9 hosted compatibility preflight — 26 October 2026

## Decision

**Schema appears compatible; RELEASE REMAINS CONDITIONAL / NOT AUTHORIZED.** No conflicting Phase 9 installation or checked dependency drift found. This metadata/static review is not a production migration rehearsal, authenticated adversarial test or guarantee of deployment safety.

User authorized this read-only check and a team manual. No production mutation, migration, deployment, secret/settings change, send, operational RPC or cleanup occurred during this inspection. Earlier approved email releases/live tests are separate historical actions.

## Target and method

- Intended project verified via authenticated Management API GET: `cudisqrugjupstgdeqac`.
- Local `supabase/config.toml` still names legacy `xahvwghacqbapfrgazxh`. No relink/config change. Did not use that reference as a target.
- Existing Supabase CLI management credential read into process memory from Windows Credential Manager. No service-role bypass, passwords, .env values or credentials printed.
- Metadata/aggregate queries sent exclusively to `/v1/projects/cudisqrugjupstgdeqac/database/query/read-only`. Both SELECT responses verified `transaction_read_only=on`.
- Tables, columns, enums, policies, indexes, constraints, triggers, function definitions/security/grants and aggregate counts only. No customer contact/trip/payment-reference export.
- Script: `powershell -NoProfile -File F:/DockerData/phase9-hosted-preflight.ps1`. Evidence: `F:/DockerData/phase9-hosted-preflight/schema.json`, `security.json`, `function-comparison.json`. Function bodies are schema metadata, not operational data.

## Verified hosted findings

-26 public ordinary tables; all 26 RLS enabled.
- Phase 9 functions0; request_budgets absent; leads.submission_key absent; uq_lead_submission and Phase 9 triggers absent. No observed partial installation.
- All 7 policy names targeted by DROP/replace exist: business_units_staff_update, leads_staff, ride_requests_staff, quotes_staff, customers_staff, vehicles_staff, vehicle_categories_staff.
- Fixed public-intake business unit exists. No overlong (>200) profile names counted. Existing booking has a recorded deposit requirement; missing requirements count 0.
- Actual booking enum: PENDING, CONFIRMED, ASSIGNED, DRIVER_ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW. No new enum proposed. Legacy dispatch statuses remain outside Phase 4 controls.
- Booking aggregate: CANCELLED 1; no other statuses currently counted. These are current read-only counts, not a capacity/performance assessment.
- Outbox aggregate: BOOKING_CONFIRMED/QUEUED 1 and BOOKING_CANCELLED/QUEUED 1. These follow the labelled test. Do not enable the general processor until queued test/stale messages are reviewed through an approved plan; this inspection did not cancel/delete/dispatch them.

## Migration compatibility matrix

Pending file: `supabase/migrations/20261024090000_phase9_security_hardening.sql`.

| Change | Hosted evidence | Assessment |
|---|---|---|
| Direct-write ACL revocations | Referenced tables/roles exist; broad grants remain on several tables | Compatible, materially restricts access |
| Replace staff policies with SELECT and remove BU update policy | All targeted policy names present | No name conflict found |
| Profile column grants + name validation trigger | Existing columns/own-profile model present; overlong names0; new trigger absent | Compatible; application must use its reviewed update path |
| Atomic lead-status RPC | lead_status enum, lead columns, can_handle_chat and activity model exist | Compatible; old clients doing direct updates must refresh after coordinated release |
| Atomic contact intake + submission key/index | Existing customer/lead schema and unique matching model present; new key/index absent; fixed unit exists | Compatible; old public ride intake preserved |
| Role audit trigger | user_roles model and activity entity user_role supported; trigger absent | Compatible; no role changes executed |
| Management-access helper | business_units/can_manage_operations available | Compatible, underlying RLS still enforces tenant data |
| Durable request budgets | table/function names absent; pg_catalog date_bin used in locally tested migration | No schema conflict; runtime metadata propagation remains unverified |
| Restrict generic log_activity to NOTE | Current signature/result exactly matches replacement | Compatible only together with trusted quote replacements |
| Four trusted quote function replacements | Existing signatures/results compatible; every current generic logger caller covered | No unhandled hosted generic logger caller found |

## Function/security comparison

13 critical function sources normalize to known pre-Phase 9 migration history: is_staff, is_super_admin, current_user_business_unit_ids, can_handle_chat, can_manage_operations, can_manage_booking, log_activity, save_quote_draft, prepare_quote_acceptance, revoke_quote_acceptance, begin_quote_delivery, customer_quote_acceptance, phase4_booking_action. This is a known-history comparison, not proof of an independently reexecuted migration chain.

Checked elevated functions are postgres-owned with empty search_path. customer_quote_acceptance remains service-only. Ordinary anon cannot call staff quote/booking/audit operations. Shared read-helper grants are existing intentional policy helpers. Service execution is not a staff identity; sensitive bodies still validate auth.uid/roles.

Effective authenticated grants currently include broad INSERT/UPDATE/DELETE/TRUNCATE on profiles, organizations, business_units, leads, ride_requests, vehicles and vehicle_categories; quotes retains TRUNCATE. Table privileges alone do not prove a publicly exposed exploit; RLS restricts ordinary row writes and PostgREST is not a general SQL endpoint. However RLS does not protect TRUNCATE, so unused grants are genuine hardening targets. No destructive operation was attempted. Bookings, activities, deposits, acceptance/delivery and communication tables already deny ordinary direct writes checked here.

Generic log_activity callers found: exactly save_quote_draft, prepare_quote_acceptance, revoke_quote_acceptance, begin_quote_delivery. Apply all replacements and logger restriction in the reviewed transaction; do not apply only the logger change.

## Remaining release risks / conditions

1. **Coordinated source/database release:** current live lead updates depend on the old write path. After migration, use the new phase9_lead_status client and profile-save changes. Reload open staff tabs; have a short controlled release window. Database-only deployment would break old-client lead mutations safely rather than allow bypasses.
2. **Rate-budget runtime:** getRequest returns the request held by TanStack/H3, but actual Cloudflare cf metadata propagation through the deployed adapter has not been proven. Missing trusted metadata uses a shared unattributed budget: conservative but can throttle multiple legitimate users together. Do not claim per-client production rate limiting verified. Validate in an approved runtime/release smoke test; do not trust arbitrary forwarded headers to bypass this.
3. **Credential incident:** owner reports replacement complete. This inspection did not retrieve keys or independently verify retirement of the historical exposed service credential. Current tracked-file removal/ignore changes remain pending; history is not erased. Do not print keys or blindly rotate/rewrite history.
4. **Build configuration:** removing tracked.env requires explicit public build inputs in CI; runtime secret presence alone is not proof fresh Git-triggered build configuration is complete. Prior CI failures were observed separately. Use a reviewed build/release path; do not publish a build compiled against the wrong project.
5. **Migration behaviour:** BEGIN/COMMIT and lock/statement timeouts provided. It is not rerunnable after success (CREATE/ALTER/DROP names without universal IF guards). No hosted dry-run, transaction execution or clean final local replay occurred. On error verify rollback/read metadata; never blindly replay/repair/reset.
6. **Policy decisions:** existing all-staff quote actions and scoped audit visibility preserved, rather than silently redefining business permissions. Confirm intended owner policy before claiming narrower finance/audit access.
7. **Rollback:** prefer reviewed forward correction; restoring broad permissions or the generic forgeable audit path is not a safe routine rollback. No rollback SQL executed/prepared automatically.
8. **Queues:** leave email automation disabled. Synthetic/stale queued confirmation/cancellation must be handled before any later activation; no automatic cleanup or sending authorized.

## Next step

Review this report and resolve the runtime/build release conditions. Then obtain exact separate approval for the Phase 9 migration, reviewed source publication and Worker release/postflight. This report grants none of those actions. Phase 10 not started.

## Inspection inventory

Read: pending Phase 9 migration; earlier migration history for source comparison; Phase 9 verification; Phase3 live and email diagnostic reports; admin routes/status/profile paths; deposit controls; quote delivery; request budgets; reports/notification code and installed TanStack request handling; existing Phase8 preflight credential/read-only pattern. Wrote local preflight script/evidence, this report and SKYRUN-TEAM-OPERATIONS-MANUAL.md. Application source and production state unchanged by this task.

## Subsequent release preparation — 26 October

See PHASE9-RELEASE-PLAN.md. A candidate based on released20c1e99 passed452tests, TypeScript, final lint(0errors/10existing warnings) and build without.env/server secrets, using only validated public build values. Built-adapter→real-TanStack in-memory metadata/concurrency test passed with0outbound requests and0services. This improves runtime confidence but is not a native deployed Cloudflare exercise. Read-only public Auth settings returned200 for the client key. No source-code change was necessary during these checks.

Current build settings have no build variables. Historical CI failure confirmed Bun frozen-lockfile installation before npm build. Proposed four build-only variables and exact coordinated release sequence are in the release plan; no remote setting changed. The logging dashboard now displays prior request events: earlier empty views and top-level observability flag were not sufficient to conclude persistent logs could never appear. Preserve existing observability; no toggle needed or performed for this task.

Await separate approval for migration, reviewed source publication, CI settings and Worker release. No operational records, emails, queues, users or roles changed during preparation.

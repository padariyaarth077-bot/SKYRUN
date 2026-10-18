# Secure quote acceptance — review and local approval

## Status: PARTIALLY COMPLETE

The owner approved secure, expiring email links and subsequently explicitly approved applying the acceptance migration and running database/browser tests in the existing isolated local Supabase environment. That migration committed successfully only in `skyrun-phase1-core`. Eight acceptance scenarios (seven database plus one real browser workflow), eight draft database regressions and ten earlier browser checks passed. Production access, hosted application, deployment and emails remain unapproved. Full Phase 3 is still incomplete because durable Resend sending and verified delivery handling are not connected.

## Implemented source

- `src/lib/quote-acceptance.server.ts`: internal 32-byte cryptographically random capability generation and SHA-256 hashing. Raw tokens stay in memory and must travel only in the customer link; no token is written to database/audit/logs by this code. The issuance helper is not exposed as a public endpoint.
- `src/lib/quote-acceptance.shared.ts`: strict 64-hex-character token format and validation of public quote/booking responses. UUID alone is never an acceptance credential.
- `src/lib/quote-acceptance.functions.ts`: POST-only preview/accept server function, service-only database RPC, hashed token only to database, no caller-supplied quote/tenant/customer/price, private/no-store response headers and safe errors. A failed or incomplete acceptance result cannot produce success.
- `src/routes/quote.accept.tsx`: public `/quote/accept#token=[secret]` page, noindex/no-referrer, fragment removed from browser history after loading and retained only in component memory. A GET/page load only previews; accepting requires an explicit checkbox and button. Pending submissions are guarded; ambiguous failures preserve retry capability and allow rechecking the same link. Success includes a saved booking reference and its actual current stored status, including later cancellation. No payment or driver/vehicle assignment occurs.
- `src/integrations/supabase/types.ts`: proposed RPC signatures, not a claim they are installed.
- `src/routeTree.gen.ts`: generated acceptance route registration.
- Two focused test files: 22 mocked logic/component tests. Test credentials/capabilities are synthetic; no provider/database network requests occur.
- `scripts/phase3-acceptance.integration.mjs`: eight executed local scenarios, seven database and one actual Playwright browser workflow; all passed. Additional assertions verify frozen draft repricing denial, original snapshot use after live request edits and actual quote/booking tenant and anonymous read isolation.

## Proposed migration

File: `supabase/migrations/20261018130000_phase3_quote_acceptance_pending_approval.sql`.

Dependencies: existing production base schema and the already locally approved `save_quote_draft` migration. No enum values, quote/booking columns or unrelated workflow tables are altered.

Exact objects:

1. Read-only preflight for duplicate nonnull `bookings.quote_id`. If duplicates exist, abort the transaction without changing/deleting them. Add unique partial index `uq_bookings_accepted_quote`, enforcing one booking per linked quote. Multiple quotes for one request remain permitted: request-level exclusivity has not been decided.
2. New private table `quote_acceptance_links`: issuance ID/version, quote/business-unit relationship, unique SHA-256 token hash, frozen recipient and full actual quote/request JSON snapshot, expiry equal to staff-entered quote validity, issuing staff, provider ID/delivery timestamp, revocation, acceptance timestamp and linked booking. No arbitrary expiry-period business policy is invented. Snapshots retain return/flight/hourly fields and existing notes; luggage/vehicle preferences currently embedded in existing notes are retained, not invented as structured columns.
3. RLS enabled. PUBLIC/anon/authenticated receive no direct table access. service_role has SELECT only; controlled SECURITY DEFINER functions mutate records. Hashes and recipient/contact/tenant/internal notes are never returned by the customer RPC.
4. Staff-only `prepare_quote_acceptance(uuid,uuid,text,timestamptz)`: verify identity, role/business-unit scope, exact draft version, Genuine lead, eligible request/customer and valid price/currency/passenger count; lock request then quote consistently; derive recipient/relationships and snapshot from persisted records; freeze expiry/version and log one preparation activity. Same issuance/hash/actor retries return the same ID. Preparation does not send email or mark SENT. Stored email is not independently verified ownership: staff must review the recipient before delivery.
5. `guard_frozen_quote()` and trigger: prevent commercial/trip/ownership edits or backward status transitions while a nonrevoked version exists. Preserve standard draft-to-sent-to-accepted/cancelled/expired/declined transitions supported by existing enums. Existing unsnapshotted rows remain unaffected.
6. Staff-only `revoke_quote_acceptance(uuid)`: tenant-scoped, audited and idempotent; already accepted versions cannot be revoked to create replacement bookings.
7. Service-only `record_quote_delivery(uuid,uuid)`: internal boundary for a future verified delivery handler; records provider ID and delivery timestamp and transitions DRAFT to SENT atomically with activity. Exact duplicate events remain harmless after acceptance. There is no public webhook endpoint that can assert delivery. These RPC calls are not themselves proof of real delivery.
8. Service-only `customer_quote_acceptance(text,boolean)`: token lookup, expiry/revocation/delivery/current review/status validation; read-only preview or atomic acceptance. Lock request/quote/link consistently. Acceptance copies exact snapshot trip/passenger/amount/currency into one PENDING booking, stores proof/time/book linkage, transitions quote to ACCEPTED and writes quote/booking activities together. The full accepted trip stays in the immutable private snapshot linked via quote. Retries return the existing reference; a legacy conflicting booking raises an error rather than being silently treated as acceptance. No confirmed_at, request/lead conversion status, payment or dispatch transition is invented.

The transaction uses five-second lock and sixty-second statement timeouts. Index creation may briefly lock bookings; this is one reason hosted application needs separate review. New RESTRICT foreign keys preserve proof/quote/booking history and can prevent deleting linked records. No existing rows are rewritten or deleted.

## Acceptance authority and limits

Authority is possession of the single-purpose secret delivered to the reviewed email. This does not prove a human identity beyond that capability and is not a claimed legal electronic signature. Forwarding the email grants its recipient access until expiry/revocation. Acceptance metadata records link version and channel `email_link_possession`; it does not fabricate an authenticated customer actor or collect extra fingerprint/IP data.

Raw secrets are in a URL fragment rather than a query/path, so page GET requests do not send them. Do not enable request-body logging for the acceptance POST or analytics/session recording on this page. Removing the fragment means a full reload may require reopening the original email link; the page explains unavailable links safely and does not persist tokens in localStorage/cookies.

Only exactly GENUINE reviews are eligible. If staff changes a lead to another state, this draft implementation fails closed; eligibility beyond GENUINE needs an explicit business decision. Multiple accepted quotes for the same request remain a separate unresolved exclusivity decision; duplicate bookings for the same quote are prevented by the proposed constraint.

## Delivery remains unfinished

Resend and support@skyrunlimo.com are the selected provider/sender. The owner reports the domain verified and production secret added; neither was read or independently verified. The existing server-only transport is prepared and mocked-tested, but it is not wired to a sending endpoint.

Before enabling Send Quote: provide staff recipient/trip/template review; persist exact delivery payload/key/version; securely retain or reconstruct the capability for consistent retries without plaintext token storage; record provider acceptance separately from actual delivery; and implement signature/replay-safe delivery events or verified provider reconciliation. Ambiguous sends must not blindly create new tokens/delivery IDs. Resend provider idempotency alone is not permanent business idempotency. No real acceptance link, email, provider event or SENT state has been fabricated by this work.

## Approved local execution — recorded commands

Executed after exact Docker project label and database port verification. The SQL transaction completed BEGIN/DDL/grants/COMMIT without errors. No database was created/reset, no volume replaced and no existing data deleted. The command listing below records what was approved and run, not a request to reapply the migration.

Restart only the preserved Docker Desktop/core test services if needed; do not create/reset a database or replace volumes. Verify the exact `com.supabase.cli.project` label is `skyrun-phase1-core`, database port 56342 and API `http://127.0.0.1:56341`. Then execute only:

```powershell
Get-Content -Raw -LiteralPath 'F:/SKYRUN/skyrun/supabase/migrations/20261018130000_phase3_quote_acceptance_pending_approval.sql' |
  docker exec -i supabase_db_skyrun-phase1-core psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
$env:SKYRUN_PHASE3_ACCEPTANCE_APPROVAL = 'skyrun-phase1-core'
node --test scripts/phase3-acceptance.integration.mjs
```

The harness independently verifies fixed local configuration, exact container project label, loopback API and installed RPC. Keys/passwords/capabilities stay in memory; browser requests are restricted to local origins. It never executes migrations. Fixtures use `.example.test` addresses and clearly labelled TEST ONLY records, retained afterward. No Resend calls are made. Synthetic delivery evidence is explicitly recorded through the local service-only boundary; this cannot verify real provider delivery or webhook signatures.

Executed scenarios: undelivered/unknown denial and issuance retry; actual local JWT tenant/role/anonymous/table/RPC restrictions; immutable/read-only preview despite changed live request; eight concurrent accepts producing one pending booking and exactly two acceptance activities; revoked/expired/spam/cancelled denial; late-activity transaction rollback of booking/proof/status; legacy booking conflict; real local browser preview/no automatic acceptance/fragment removal/explicit acceptance/idempotent revisit. Expiry and injected rollback use rolled-back privileged local SQL fixtures; role boundaries are separately tested with actual JWTs. Frozen draft repricing is denied through both the staff RPC and direct privileged quote update; new bookings preserve the snapshot despite changed current request pickup/passenger values. Other-tenant and anonymous clients cannot see the created booking, and other-tenant staff cannot see its quote.

After fixing any failures, rerun the earlier draft integration and Phase 1/2 browser regressions in the same preserved local environment. Stop test services afterward, keeping fixtures/volumes.

Rollback approach: stop issuance/acceptance through application configuration and revoke execution of the new RPCs after explicit approval; preserve links, snapshots, activities, bookings, uniqueness and freeze protections. Do not drop proof/data or automatically restore unsafe writes. Reverting UI source does not require deleting new data. There is no automatic destructive rollback.

## Executed checks for this source change

| Command | Result |
|---|---|
| `npm test -- --maxWorkers=1 src/test/quote-acceptance.functions.test.ts src/test/quote-acceptance-ui.test.tsx` | 22 passed, two files; phase3-acceptance-focused.log |
| `npm test -- --maxWorkers=1` | 267 passed, 16 files; phase3-acceptance-tests.log |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed; phase3-acceptance-typecheck.log |
| `npm run lint` | Passed; same nine existing Fast Refresh warnings; phase3-acceptance-lint.log |
| `npm run build` | Passed; phase3-acceptance-build.log; existing image/chunk/config warnings remain |
| `node --check scripts/phase3-acceptance.integration.mjs` | Passed syntax only |
| Targeted ESLint of the integration harness | Passed |
| In-memory public bundle scan | 71 public files scanned; no configured privileged key, opaque secret or service-role JWT found; phase3-acceptance-bundle-scan.log |
| `git diff --check` | Passed |
| `SKYRUN_PHASE3_ACCEPTANCE_APPROVAL=skyrun-phase1-core node --test scripts/phase3-acceptance.integration.mjs` | 8 passed, 0 failed, exit 0; phase3-acceptance-integration.log |
| `SKYRUN_PHASE3_LOCAL_APPROVAL=skyrun-phase1-core node --test scripts/phase3-drafts.integration.mjs` | 8 passed, 0 failed, exit 0; phase3-acceptance-draft-regression.log |
| `SKYRUN_PHASE3_LOCAL_APPROVAL=skyrun-phase1-core NODE_OPTIONS=--max-old-space-size=384 node scripts/phase1-browser.mjs` | 10 browser checks passed, exit 0; phase3-acceptance-browser-regression.log |

The initial mock validator threw synchronously unlike the framework's async server call; the mock was corrected without weakening assertions. Component tests additionally verify that an accepted booking later marked CANCELLED is displayed honestly, rather than always labelled pending. No dependency, global lint rule or existing test was removed/disabled. Concurrency/rollback/RPC restrictions and scoped reads now have the real local evidence above; real delivery/webhook verification does not. The existing Docker Desktop/core services were started under approval for these tests. Application source did not change during this migration/test run, so the previously passing 267-test/TypeScript/lint/build results were not needlessly rerun; only the expanded integration harness changed. Earlier dirty source and user-owned artifacts were preserved; Phase 1 form/server files and package/config files are unchanged by this work.

## Manual checks after local approval

Use only synthetic fixtures. Prepare a Genuine draft and snapshot, verify no acceptance before synthetic delivered evidence. Open the generated loopback fragment link; check exact stored price/trip, no contact/tenant/hash disclosure and no booking from page load. Check the box and accept, confirm saved PENDING reference and one booking after repeat visits. Expire/revoke/change review and verify a safe refusal. Inject an activity failure and verify no partial booking/proof/status. Follow the booking's existing admin/customer/request/quote links. These are local checks; do not test against hosted records without separate authorization.

## Production safety and next step

No hosted database/API access, hosted migration, production configuration changes, deployment or real email send occurred. Only the approved local acceptance migration was applied. The four core test containers and Docker Desktop were stopped afterward; local volumes/fixtures were preserved. Regression screenshots from this run are retained as phase3-acceptance-regression-public.png and phase3-acceptance-regression-admin.png, without overwriting earlier Phase 3 evidence. Phase 3 is still PARTIALLY COMPLETE and not deployed. The next safest step is to implement durable Resend quote sending and signature-verified delivery handling, with a concrete proposal for any further schema/configuration changes before applying them. The local evidence uses synthetic delivery fixtures and cannot be represented as proof of real email delivery.

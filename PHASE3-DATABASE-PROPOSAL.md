# Phase 3 database and dependency proposal

## Approval request 1: atomic quote drafts, isolated local only

Status update: the owner explicitly approved this local migration and its database/browser tests. The migration committed successfully in the preserved `skyrun-phase1-core` database. All eight database tests and all ten local browser checks passed; see PHASE3-VERIFICATION.md and phase3-database-tests.log / phase3-browser-tests.log. Hosted application and deployment remain unapproved.

File: supabase/migrations/20261018110000_phase3_quote_drafts_pending_approval.sql.

Verified need: current staff RLS permits arbitrary direct quote creation/updates, without Genuine eligibility checks, expiry/draft immutability, retry consistency or atomic activities. Separate browser calls cannot enforce these properties reliably. There is no existing draft-save RPC.

Exact affected objects:

- Add public.save_quote_draft(uuid,uuid,numeric,text,timestamptz,text,timestamptz).
- SECURITY DEFINER, empty search_path, verified auth.uid()/is_staff(), explicit tenant check and server-derived request/customer relationships. Only authenticated may execute; anonymous/PUBLIC execution is revoked.
- Lock request/lead/customer/quote consistently; lock stable draft UUID for retries. Use updated_at for optimistic draft edits. Store DRAFT only; reject frozen/elapsed quotes and non-GENUINE leads. Atomic log_activity writes roll back failed draft saves.
- Revoke authenticated INSERT/UPDATE/DELETE on quotes; preserve SELECT and all existing RLS policies. Authorized draft changes go through the reviewed RPC. Existing service_role privileges are not changed; staff status does not grant secret access.
- No new table/column/index, no existing-row rewrite or deletion, no booking mutation, no delivery/acceptance transition. Amount validation follows numeric(10,2), permits zero, rejects negative/over-precision values and performs no price/tax calculation. Currency input is constrained to a three-uppercase-letter code; the base column is unrestricted text and supported currencies still require an owner decision. USD is the existing schema default. No currency conversion or new pricing policy is supplied.

Compatibility: existing quote rows remain readable. Only draft mutation entry points change; no quote-write caller exists in the inspected repository. External tools relying on direct authenticated quote writes would require review before any hosted application. Drafts with elapsed validity or non-DRAFT status remain read-only. Multiple distinct quotes for one request are not prohibited, because no active-quote exclusivity rule exists in source.

Rollback approach: retain all quote/activity data; revoke authenticated execution of the new RPC and restore the prior authenticated quote DML grants if the owner explicitly chooses to restore the previous authorization model. No destructive rollback or automatic deletion is proposed. Existing quote records created through the function remain compatible with the base schema.

Proposed execution, ONLY after approval and local container-label verification:

```powershell
docker inspect --format '{{index .Config.Labels "com.supabase.cli.project"}}' supabase_db_skyrun-phase1-core
Get-Content -Raw -LiteralPath 'F:/SKYRUN/skyrun/supabase/migrations/20261018110000_phase3_quote_drafts_pending_approval.sql' |
  docker exec -i supabase_db_skyrun-phase1-core psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
$env:SKYRUN_PHASE3_LOCAL_APPROVAL = 'skyrun-phase1-core'
node --test scripts/phase3-drafts.integration.mjs
node scripts/phase1-browser.mjs
```

The SQL file wraps its changes in BEGIN/COMMIT, with a five-second lock timeout and sixty-second statement timeout. Target is the preserved isolated database only; no Supabase project link is changed, no db push is used and no hosted SQL is authorized. Starting preserved local containers remains separate from applying this new migration. The database test harness validates loopback API, fixed Docker project labels and installed function before creating synthetic fixtures. Neither harness applies migrations itself. The browser harness retains eight Phase 1/2 checks and, only with the explicit local Phase 3 approval flag, adds two quote save/edit/failure/retry/actor/audit checks; no delivery/acceptance/booking is fabricated.

Executed eight real database scenarios: server-derived draft relationships/actor/activity, concurrent same-ID retry consistency, exact-version edits and stale-write rejection, malformed amount/currency/expiry rejection, NEW/SPAM eligibility rejection, authenticated tenant/role/anonymous/direct-write restrictions, frozen accepted-fixture immutability without creating a booking, and a late activity-trigger failure rolling back draft creation. All passed. The last test creates a temporary failure trigger inside a rolled-back local transaction with simulated SQL auth context; other authorization scenarios use real JWTs. Synthetic fixtures are retained; passwords/keys stay in memory.

## Separate decisions required: delivery, acceptance and booking

No application quote-email provider, approved quote template or customer-facing acceptance ownership mechanism exists. Auth password-recovery email must not be repurposed as quote delivery.

Owner decisions needed:

1. Which approved email/messaging provider and sender should deliver quotes, and which exact template/content is approved? Define verified send success versus provider acceptance, failure/retry handling and delivery-event tracking. No credentials should be pasted into chat.
2. Customer authentication linked to a verified customer record, or an approved single-purpose link delivered to the customer's verified contact? A public quote UUID alone is insufficient.
3. May more than one quote for a request be active or accepted? Which existing statuses beyond exactly GENUINE are eligible? Which currencies and zero-price rules are allowed? No exclusivity or minimum-price assumption has been added.

Once the acceptance model is approved, prepare a separate reviewed migration covering:

- Immutable quote version and full accepted trip snapshot. The existing quote table copies pickup/drop-off/date/time but lacks passenger/luggage/return/flight/hourly snapshots; pulling those mutable request fields during booking would not preserve the exact accepted trip.
- Verified acceptance time/context tied to that exact version. For approved capability links: cryptographically random high-entropy secret, only its hash stored, single purpose, explicit expiry bounded by quote validity, revocation/consumption and retry semantics. Do not expose secrets or claim legal electronic signatures.
- Unique booking linkage per accepted quote, with read-only duplicate preflight against existing bookings before adding a constraint. Never clean up legacy duplicates automatically. Request-level exclusivity depends on the owner's decision.
- An atomic acceptance/booking RPC that verifies eligibility, locks the quote/request, records proof, copies immutable agreed trip/amount/currency and creates one linked booking/activity under concurrent retries. Decide the booking confirmation policy explicitly; no invented CONFIRMED transition, driver assignment or payment.
- Delivery/acceptance/version privilege boundaries, exact grants, RLS compatibility, rollback and real isolated tests.

No speculative acceptance-table/column migration is supplied before those decisions, because choosing customer ownership, token issuance or confirmation semantics without them would invent business/security policy. Booking conversion remains unavailable; an existing ACCEPTED status by itself is not treated as verified customer acceptance.

# Phase 8 hosted compatibility preflight

Inspection completed: **2026-10-21 15:12 UTC**. Target verified through authenticated Management API GET: **cudisqrugjupstgdeqac**. Repository `F:/SKYRUN/skyrun`, branch main. Only read-only hosted inspection was authorized by the request to continue the proposed next step.

## Result

**Appears compatible with the inspected hosted dependencies. Not a production migration execution test or live operational verification.** Phase 8 is absent, not partially installed. Production migration, source publication/deployment, communication activation and real email testing remain separate approval gates.

## Method and evidence

Executed `& 'F:/DockerData/phase8-preflight.ps1'`. Uses the existing Supabase CLI credential in memory, no secret output, no project relink. HTTP methods:

- GET `https://api.supabase.com/v1/projects/cudisqrugjupstgdeqac` to verify target.
- POST to `/v1/projects/cudisqrugjupstgdeqac/database/query/read-only` containing only SELECT metadata/aggregate queries; **transaction_read_only=on** verified each time.

No write-capable SQL endpoint, migration operation, operational RPC, email endpoint or deployment command used. Queries inspect schema, function definitions/grants and aggregate booking statuses, without exporting customer records or private tokens. Function bodies were compared in memory to existing migrations after whitespace/comment normalization; only match booleans retained in comparison evidence.

Evidence retained on F: in `F:/DockerData/phase8-verification/hosted-preflight.json`, `hosted-function-comparison.json`, `hosted-security-metadata.json`. Legacy config reference was neither used nor changed. The inspection principal has auth.users read access but no public-schema CREATE privilege; this is not evidence of migration execution privileges for a future release principal.

## Compatibility matrix

| Dependency/object | Hosted fact | Assessment |
|---|---|---|
| Leads/customers/bookings/activities/business units/user roles | Present; required selected trip/customer/event/role columns present | Source-trigger dependencies compatible |
| Conversations/messages | Present, channel/sender/conversation relationships available | Chat event dependencies compatible |
| Quote acceptance links | Present, accepted_at/booking_id/quote_id available | Combined acceptance/pending-booking event supported |
| New four Phase 8 tables | All absent | No partial table installation found |
| Functions with phase8_ prefix | None returned | No conflicting new function installation found |
| Five proposed named indexes | None present | No name conflicts found |
| Proposed source trigger names | Absent; inspected source tables have existing lead updated_at trigger | Additive trigger names do not conflict |
| RLS on existing nine operational/acceptance tables | Enabled | Existing RLS retained; new Phase 8 RLS still requires approved application/postflight |
| Activity entity constraint | Includes profile and supported operational entities | Preference/communication activities compatible |
| Current booking status groups | Aggregate returned no groups | No existing booking population identified in aggregate inspection; no backfill proposed |

Nine hosted function bodies match reviewed pre-Phase 8 migration history: `is_staff`, `is_super_admin`, `can_manage_booking`, `current_user_business_unit_ids`, `log_activity`, `phase4_booking_action`, `customer_quote_acceptance`, `chat_send_message`, `chat_request_handoff`.

The authorization helpers and existing quote delivery functions use SECURITY DEFINER with empty search_path. Actual grants: visitor chat/acceptance and quote delivery-event functions are service-only, denied to anon/authenticated; Phase 4 booking actions allow authenticated and service, denied anon. This preserves the existing trusted-server capability boundary. No authentication, RLS or business workflow was exercised live.

## Migration review and release limits

Reviewed `supabase/migrations/20261023090000_phase8_communications.sql`: transaction/timeouts, additive tables/indexes/triggers, explicit function grants, own/scoped RLS, safe search paths, controlled queue leases and frozen message body, and reserved generic-audit prefixes. The existing log_activity body matches history, so replacing it with the reviewed added guards does not overwrite an unidentified hosted custom implementation.

Reviewed migration SHA256: `96C26C1678690CB9F904A88E69AE8B26FC5702859775A930A7005676486DAD61`.

Isolated evidence remains 430 unit/component tests, 11 Phase 8 integration/browser scenarios, 84 prior regressions and passing TypeScript/lint/build. Final corrected complete migration was not replayed on a fresh database; local corrections were applied to new Phase 8 objects. Local evidence does not prove production locking/load/provider behavior. Migration is transactional, not blindly replayable over an already partially installed schema. Recheck absence immediately before any approved application; fail rather than repair/drop existing objects automatically.

Keep customer/staff email automation disabled for the initial release. Do not set COMMUNICATION_EMAIL_MODE=live, add a scheduler or invoke the dispatch route. A later approved activation must validate provider sender/webhook configuration, dedicated dispatch authentication, scheduling, reconciliation and a single labelled test recipient. Do not flush queued envelopes blindly. Phase 3 LIVE VERIFICATION remains UNVERIFIED.

## Concrete proposed release, pending approval

1. Apply **only** `20261023090000_phase8_communications.sql` to verified project cudisqrugjupstgdeqac through the reviewed management migration method, preserving the migration's transaction/timeouts. No resets, deletion, backfill or operational RPCs.
2. Read-only postflight verifies all four new tables/RLS, function/grant/search-path definitions, trigger/index presence and retained existing authorization.
3. Publish only reviewed Phase 8 source/docs/tests to GitHub; exclude existing CLI metadata, screenshots and hosted fixture artifacts.
4. Deploy the reviewed build explicitly to existing Worker **skyrun**, preserving variables/secrets/compatibility date. Generated automatic Worker name must not be used accidentally.
5. Read-only HTTP/asset checks. No sign-in as another user, business-record creation, dispatch, real email or configuration activation under this release proposal.

These production actions require explicit approval under the owner's Phase 8 safety boundary. The generic request to continue does not replace the named migration/release approval.

## Safety confirmation

Production inspected: **Yes, read-only metadata/aggregate checks only**.

Production writes: **No**. Migrations: **No**. GitHub publication: **No**. Deployment: **No**. Real emails: **No**. Production workflows: **No**. No secrets printed, no system/software changes, no data reset/deletion.

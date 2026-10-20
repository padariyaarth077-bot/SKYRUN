# Phase 6 — chat inbox and manual catalogue sharing

21 October 2026. **LOCALLY VERIFIED; PRODUCTION RELEASE PENDING.** Overall delivery remains partially complete until a separately approved hosted compatibility review and release. Branch `main`, starting HEAD `f678fc9`. No commit or publication performed in this task.

## Audit and implementation

The existing public widget/server calls, admin chat route, base and chat migrations, Phase 4 authorization/activity restrictions, Phase 5 operations, generated types and tests were inspected before changes. Existing chat used separate message/status writes, lacked visitor refresh for staff replies, exposed fragile stale-selection behavior, and did not have dependable shared-team unread state. Existing answers are preset FAQ responses, not an external AI provider. Existing lifecycle status values are preserved.

- Visitor and staff message operations now have stable retry UUIDs and controlled transactional RPCs. The prepared database implementation locks conversations, rejects changed retry payloads, saves message/status/audit together, enforces assignment, and suppresses preset replies during handoff/human handling.
- Visible chat and staff inbox poll saved records every five seconds without overlapping polling requests. Hidden tabs pause polling. Distinct load/mutation errors preserve history and failed drafts; acknowledgments clear saved drafts. Selection guards reject stale responses. History uses cursor paging and ID deduplication; a disconnected client can reopen paging if more than one page arrived.
- Inbox filters/search/pagination, linked customer/lead navigation, staff takeover/reply/resolve, and shared team unread markers are implemented. An observed-message marker cannot clear a later message. This is deliberately not per-agent unread tracking. There is no staff reassignment feature in this phase.
- Contact capture remains a CHATBOT lead, matching scoped customer email/phone and retaining history. It does not create a ride request, quote or booking.
- Public `/catalogue` uses only the supplied static photo manifest: **13 model/configuration groups, 14 photos**, with no inferred quantities, capacities, prices or availability. The pre-existing uncommitted fleet grouping improvement is retained and reused.
- Fleet, customer profile and selected chat can copy the public catalogue URL or open a prepared WhatsApp draft. A known customer requires an explicit international phone number; no country code is guessed. Staff sends manually. No WhatsApp API, send/delivery state or automatic communication was added. Official click-to-chat behavior: https://faq.whatsapp.com/5913398998672934.

## Files

- `supabase/migrations/20261021120000_phase6_chat_inbox.sql`: prepared atomic operations, authorization/grants, capability-safe reads, paging, shared unread, retry indexes, contact matching and reserved audit protection.
- `src/lib/chat.functions.ts`, `src/lib/chat.shared.ts`: validated atomic server path and cursor/message contracts; preset FAQ wording.
- `src/lib/use-polling.ts`: visible-tab polling with no overlapping polls.
- `src/components/chat-widget.tsx`: persisted staff replies, retries, history, handoff and terminal-state feedback.
- `src/components/chat-inbox.tsx`, `src/routes/_authenticated/admin.chat-conversations.tsx`: protected inbox and controlled staff operations.
- `src/lib/catalogue-sharing.ts`, `src/components/catalogue-share.tsx`: public-only share URLs, international phone validation, clipboard and manual WhatsApp controls.
- `src/components/vehicle-catalogue.tsx`, `src/routes/catalogue.tsx`: view-only searchable model catalogue.
- `src/components/fleet-images.tsx`, `src/lib/vehicle-images.ts`, `src/routes/_authenticated/admin.customer.$id.tsx`: integrate existing images/grouping and sharing.
- `src/integrations/supabase/types.ts`, generated `src/routeTree.gen.ts`: new view/RPC types and generated catalogue route.
- `src/test/chat.functions.test.ts`, `src/test/chat.shared.test.ts`, `src/test/chat-widget.test.tsx`, `src/test/chat-inbox.test.tsx`, `src/test/use-polling.test.tsx`, `src/test/catalogue-sharing.test.tsx`, `src/test/phase5.test.tsx`: validation, safe retries, selection, polling, error/draft preservation, sharing and grouping coverage.
- `scripts/phase6-chat.integration.mjs`: executed local-only guarded database scenarios and real local Chromium journey; repeatable synthetic phone fixtures and hydration-aware UI assertions.
- `PHASE6-PLAN.md`, this report: scope, implementation and verification boundary.

## Database status and static security review

**Migration applied successfully only to the preserved isolated `skyrun-phase1-core` Supabase project, under explicit user approval.** Verified config project ID, Docker database container project label and local API origin `http://127.0.0.1:56341`. The existing local database had zero messages with missing timestamps and no Phase 6 RPC before application. Executed the exact migration through `docker exec -i supabase_db_skyrun-phase1-core psql -U postgres -d postgres -X -v ON_ERROR_STOP=1`, supplied via standard input; transaction committed. Notified the local PostgREST schema cache afterward. No hosted connection or project relinking. No resets, volume deletion, software installation or data cleanup. Local synthetic fixtures remain.

Migration is ordered after Phase 5 and enclosed in one transaction with lock/statement timeouts. Adds two nullable UUID columns, indexes, functions and a security-invoker inbox view. Existing message timestamps become NOT NULL only after an explicit precondition: if legacy messages have NULL timestamps, the migration aborts without inventing dates or modifying those records. No backfill, reset, deletion or status enum changes. Migration is single-application, not a rerunnable repair script; any failure should roll back the transaction. Forward corrections require review rather than blind reapplication. Reverting an eventual release requires coordinated source and privilege review; do not remove retained messages or retry evidence.

Static controls:

- Trusted global SUPER_ADMIN or scoped ADMIN/MANAGER/SUPPORT/DISPATCHER can handle chats. Conflicting lesser roles in the same scope fail closed; CONTENT_MANAGER is read-only. Server service role is not a staff actor.
- Existing table RLS remains enabled. Ordinary direct message/conversation writes are revoked. Explicit staff conversation SELECT excludes `session_token_hash`.
- Visitor RPCs require service-role execution; browsers call validated server functions using a hashed opaque capability. Staff operations require authenticated identity and database role/scope checks. Private paging helper has no ordinary EXECUTE grant.
- SECURITY DEFINER operations use empty search paths and qualified tables. Staff audit actor is `auth.uid()`, not caller input. Generic logger rejects reserved CHAT events/operation metadata and preserves Phase 4/5 guards. Phase 4 direct activity-write revocations are preserved.
- No new dependency, secret, external AI, WhatsApp provider, automatic email, pricing, payment, dispatch or booking behavior.

These source findings were additionally checked against real authenticated local Supabase roles/RLS, RPC privileges, competing operations and injected database failures. This establishes isolated local behavior, **not hosted production verification**. Earlier Phase 3 real email delivery/customer acceptance remains **LIVE UNVERIFIED**.

## Checks actually executed

| Command | Result |
|---|---|
| `npm run test -- --maxWorkers=1 --pool=threads` | 380 passed, 26 files; includes Phase 1–5 regression suites |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS after correcting new test fixture typing |
| `npm run lint` | PASS, 0 errors; 9 existing Fast Refresh warnings |
| `npm run build` | PASS; existing bundler warning that inlineDynamicImports is ignored when codeSplitting is specified |
| `node --check scripts/phase6-chat.integration.mjs` | PASS syntax check only; executes no integration code |
| `git diff --check` | PASS; Git reports LF/CRLF normalization notices |

Initial checks found test fixture typing and formatting errors; corrected without weakening assertions or suppressing rules. Build generated the route tree. Separate real local browser and database checks were executed after approval, as recorded below. Component tests still mock RPC contracts and must not be counted as independent database evidence.

Executed integration coverage includes session/capability permissions, atomic duplicate visitor sends, handoff suppression, competing claims, repeated staff replies/resolution, role and tenant denials, direct-write/audit bypasses, unread races, full history paging, contact linkage, and injected late-write rollback. The script requires an explicit local approval flag, verifies local API origin/container label/config, never applies a migration, and only creates retained synthetic fixtures in the preserved isolated project.

## Manual checks after approved local migration

1. Start the approved isolated stack and local app using local credentials only. Open public chat and staff `/admin/chat-conversations` in separate sessions.
2. Send visitor text, request human support, take over as scoped authorized staff. Reply; visitor should receive saved reply without sending another message. No further preset answer should appear during takeover.
3. Disconnect/reconnect, retry an unacknowledged send and switch inbox selection while requests are pending. Confirm retained text/history, no wrong-conversation reply, and one saved message per retry key.
4. Inspect shared unread before/after viewing and while a new message arrives. Test a long history and an offline gap of over 100 messages.
5. Resolve, verify closed input and explicit new conversation behavior. Check read-only and other-tenant accounts cannot mutate.
6. Open `/catalogue`, search models, inspect 14 photos/13 groups. Copy the link from fleet/customer/chat; verify it contains only the public path. Open WhatsApp and inspect the prepared draft without sending. A missing or ambiguous customer country code must disable direct contact.

## Remaining gates

The approved isolated migration, database tests and browser checks are complete. Existing and new labelled synthetic fixtures are preserved. Docker Desktop was shut down after testing to release memory; no volumes were removed. The next gate is a separately approved read-only hosted compatibility preflight. Do not apply this migration remotely or publish/deploy under the local-only approval.

Production compatibility inspection, migration application, GitHub publication and Worker deployment require separate scoped approval. The deployed site therefore does not yet show these Phase 6 changes. Production access: **No**. Production writes/migrations: **No**. Deployment: **No**. Real emails/WhatsApp sends: **No**.

Unrelated pre-existing CLI metadata, screenshots, verification/fixture exports and `scripts/phase1-hosted-check.mjs` were preserved. No Phase 7 work was started.


## Approved isolated execution results

No `.env` values were printed. Local CLI status credentials were captured only in test-process memory. Database/API calls are guarded by project config, Docker project label and exact loopback API origin. Browser app runs at `http://127.0.0.1:56500` with explicit local environment overrides; browser network interception rejects every other origin. Browser and app processes are closed by test cleanup. No WhatsApp link was clicked.

Commands below were run with the corresponding `SKYRUN_PHASE*_APPROVAL` / `SKYRUN_PHASE*_LOCAL_APPROVAL` environment flags set to the non-secret isolated project name `skyrun-phase1-core`, as required by each existing harness:

| Command | Final result |
|---|---|
| `node --test --test-skip-pattern='isolated browser' scripts/phase6-chat.integration.mjs` | 11/11 database scenarios PASS |
| `node --test --test-name-pattern='isolated browser' scripts/phase6-chat.integration.mjs` | 1/1 real local browser scenario PASS |
| `node --test scripts/phase1-integration.mjs` | 13/13 PASS |
| `node --test scripts/phase3-drafts.integration.mjs` | 8/8 PASS |
| `node --test scripts/phase3-acceptance.integration.mjs` | 8/8 PASS, includes local customer acceptance browser |
| `node --test scripts/phase3-delivery.integration.mjs` | 8/8 PASS, includes local browser with fake provider and signed synthetic webhook; NOT real delivery |
| `node --test scripts/phase4-bookings.integration.mjs` | 16/16 PASS, includes local deposit/confirmation/completion browser |
| `node --test scripts/phase5-operations.integration.mjs` | 11/11 PASS |

Total: **12 Phase 6 isolated database/browser scenarios + 64 earlier-phase isolated regressions passed**, separate from 380 unit/component tests.

Phase 6 browser checks covered visitor contact capture, visitor message, handoff, separate authenticated staff takeover/reply, automatic visitor receipt of staff reply, persistence after staff reload, public-only WhatsApp draft URL, resolution reaching the visitor, 13 catalogue groups, 14 images successfully decoded in the real browser, and model search. It did not open WhatsApp or send anything externally. Database checks covered idempotency, concurrency, rollback, contact matching, authorization, restricted grants, capability separation, tenant isolation, shared unread races and complete 206-message paging.

Initial combined run passed all 10 then-prepared database scenarios but failed the final catalogue UI assertion. The harness was corrected to wait for hydration/rendering before search assertions, and a repeatable unique phone fixture was used. No application or migration change was needed. Final separate runs pass; the failing attempt is not represented as a pass. No SQL migration repair or second migration application occurred.

Logs: `phase6-database.log`, `phase6-browser.log`, `phase6-regression-*.log`, `phase6-tests.log`, `phase6-types.log`, `phase6-lint.log`, `phase6-build.log` (local ignored logs, no credentials intentionally emitted). Final source/diff review preserves unrelated existing user files and metadata.


## Approved hosted release — 21 October 2026

Owner explicitly approved the single Phase 6 migration, GitHub publication, Worker deployment and read-only postflight. Target reverified through Management API GET. Read-only drift check found the migration absent and zero invalid legacy timestamps. Only `20261021120000_phase6_chat_inbox.sql` was executed through the authenticated Management API query endpoint, once, with its own transaction. All 11 read-only postflight assertions passed: view/RPC/indexes exist, RLS remains enabled, legacy visitor RPCs no longer allow anon/authenticated execution, staff RPC allows authenticated but not anon, capability hashes are not directly selectable and ordinary chat writes are denied. No operational RPC, customer test record, email or WhatsApp send occurred. Source publication and deployment are pending as of this entry; a later entry records actual outcome. Earlier local-only/no-production statements are historical boundaries before this explicit release approval.


## Release completed — 21 October 2026

Approved source commit `228b9fa` published to GitHub main. Worker `skyrun` successfully deployed using the existing cached Wrangler 4.136.2, preserving runtime variables/secrets (`--keep-vars`). Worker version: `ae94b8eb-5ff9-428b-9e1a-de1694da97de`. Live URL: https://skyrun.padariyaarth077.workers.dev .

The initial deployment attempt using an older cached Wrangler uploaded assets but was rejected before Worker activation because generated compatibility date 2026-10-21 was ahead of Cloudflare's current UTC date. Retried successfully with the newer already-cached Wrangler and explicit `--compatibility-date 2026-10-20`. No software installation or secret change. No need to rerun the applied migration.

Read-only live checks: authenticated Vehicles displays 0 actual saved vehicles, 13 catalogue groups and 14 reference photos; Cadillac filtering works and clears correctly. Authenticated Chat Conversations loads its honest empty state with no error. Public /catalogue and a supplied image return HTTP 200 and expected content. No visitor chat was opened, no staff mutation was performed, no production test fixtures were created and no real email/WhatsApp message was sent. The live workflow remains tested end-to-end only in the isolated environment; Phase 3 real delivery/acceptance remains LIVE UNVERIFIED. Screenshot: phase6-live-fleet.png. Separate postflight metadata evidence remains local in phase6-release-postflight.json.

Production schema change: YES, only the explicitly approved Phase 6 migration. GitHub publication: YES. Worker deployment: YES. Reset/deletion/communications: NO. Existing unrelated CLI metadata and screenshots/exports remain outside this commit.

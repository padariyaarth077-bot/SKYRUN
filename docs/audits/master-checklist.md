# Deliverable H — Prioritized Master Checklist

Complexity is a broad planning label, not an estimate of elapsed time. All work below is **not started by this audit**; no app behavior changed.

## P0 — Security, data loss, and critical integrity

| Task | Why / dependencies | Affected files/tables | Acceptance criteria | Test required | Complexity | Status |
|---|---|---|---|---|---|---|
| Confirm and align Supabase project targeting | Prevent any future migration/CLI operation reaching wrong project; requires owner verification of intended project | `supabase/config.toml`, deployment config | CLI and runtime references verified to `cudisqrugjupstgdeqac`; no legacy/demo project touched | Read-only project identity check and deployment config review | Small | **BLOCKED** |
| Verify deployed schema, migration ledger, RLS and function grants | Local migration is not evidence of production state; depends on correct target/read-only access | 4 migration files; 14 tables/policies/functions | Remote snapshot confirms expected migration versions, columns, FK, policies and RPC privileges | Schema diff + authorized/unauthorized role matrix, no writes | Medium | **UNVERIFIED** |
| Add abuse protection to public lead endpoint | Anonymous service-role path can grow records without bound; depends on hosting/runtime rate-limit design | `src/lib/leads.functions.ts`, server runtime, `customers`, `leads` | Enforced per-IP/session throttling, honeypot or equivalent, bounded payload, privacy-safe abuse logs | Rate limit, invalid payload, bot and burst tests | Medium | **NOT STARTED** |
| Make customer/lead/activity creation atomic and idempotent | Races and partial records; depends on schema-approved RPC/constraints | `leads.functions.ts`, `customers`, `leads`, `activities` | Duplicate/retry behavior documented; no orphan/duplicate under concurrent submits; errors return clear safe result | Concurrency and fault-injection integration tests | Large | **NOT STARTED** |
| Define role-to-action policy and verify tenant isolation | All roles currently see same UI; schema policies need live verification | auth guard, admin shell, RLS policies, `user_roles` | Server/database enforces least privilege; cross-BU reads/writes denied; super-admin behavior explicitly verified | Role and cross-business-unit RLS tests | Large | **NOT STARTED** |

## P1 — Core enquiry, ride, quote and booking flows

| Task | Why / dependencies | Affected files/tables | Acceptance criteria | Test required | Complexity | Status |
|---|---|---|---|---|---|---|
| Create structured ride requests from public form | Current form only stores generic lead text; depends on target schema and approved field mapping | `BookingForm`, `leads.functions.ts`; `customers`, `leads`, `ride_requests` | Validated request links customer + lead, preserves trip fields in typed columns, confirms unambiguously, duplicate-safe | Public form + server validation + persistence/RLS integration tests | Large | **NOT STARTED** |
| Add robust lead/customer list states and paging | Current full-table client filtering and swallowed errors | `admin-data.ts`, dashboard, lead/customer pages | Server-side filters/order/pagination, loading/error/empty states and actionable errors | Query behavior tests + larger fixture test | Medium | **NOT STARTED** |
| Complete lead review/audit actions | Current mutations can ignore update/activity failures | lead list/detail, `admin-data.ts`, `activities` | All changes have verified affected row and atomic activity; reason/reviewer semantics persist | Mutation failure and audit consistency tests | Medium | **NOT STARTED** |
| Define and build quote workflow | No quote UI/API; pricing/expiry/sending policy undecided | quote module; `quotes`, `ride_requests`, `customers` | Create/edit/send/expire/accept behavior and status transitions approved and persisted | Quote lifecycle, authorization, pricing validation tests | Large | **BLOCKED by business policy and P1 ride flow** |
| Define and build booking lifecycle | No booking CRUD/confirm/cancel/reschedule; no availability conflict model | booking module; `bookings`, `quotes`, `ride_requests` | Approved lifecycle, links, conflict behavior and confirmation persisted | Lifecycle/concurrency/authorization tests | Large | **BLOCKED by policy and fleet decisions** |
| Add customer history/detail | Current customer table only displays linked lead count | customer routes; `customers`, `leads`, later requests/quotes/bookings/activities | Authorized staff can see permitted related timeline, search and contact | RLS and joined-history tests | Medium | **NOT STARTED** |

## P2 — Chat, staff messaging, alerts, automation

| Task | Why / dependencies | Affected files/tables | Acceptance criteria | Test required | Complexity | Status |
|---|---|---|---|---|---|---|
| Approve chatbot scope and privacy/lifecycle | Existing widget is only scripted lead capture; must decide FAQ/live chat/AI and transcript/consent | chatbot, privacy policy, `conversations`, `conversation_messages`, `leads`, `customers` | Product decisions document identity, persistence, retention, escalation and ownership | Product acceptance + privacy/security review | Medium | **BLOCKED** |
| Persist conversations and staff history/replies | Existing chat transcript disappears on refresh; staff route is placeholder; depends on scope and RLS | `chat-widget.tsx`, module page, conversation tables | Visitor can resume per chosen design; staff can view/reply under tenant access | Persistence, RLS, reconnect, abuse tests | Large | **NOT STARTED** |
| Add notifications and realtime only for approved events | Bell currently decorative route; no notification table/publication/subscription | schema decision, module page, realtime configuration | Per-event persistence, unread/read, authorized recipient, dedup and reconnect behavior | Realtime integration/failure/replay tests | Large | **NOT STARTED** |
| Select and integrate email provider for approved events | No provider or delivery code found | server functions/edge function, quote/booking flows | Server-side secrets, templates, delivery state, retry and duplicate safeguards | Provider sandbox tests; do not send live mail in tests | Medium | **BLOCKED by provider/event decisions** |

## P3 — Reporting and operational polish

| Task | Why / dependencies | Affected files/tables | Acceptance criteria | Test required | Complexity | Status |
|---|---|---|---|---|---|---|
| Build analytics and date filters | Dashboard only derives lead counts from loaded set | analytics module; indexed operational tables | Defined metrics match SQL and chosen date/time zone | Metric query tests with boundary dates | Medium | **NOT STARTED** |
| Build fleet/category admin and public data integration | Public fleet is static; schema supports categories and vehicles | fleet/category modules, public pages, `vehicles`, `vehicle_categories` | Staff CRUD and public visible/active output agree | RLS and public visibility tests | Medium | **NOT STARTED** |
| Decide driver and availability data model | Approved 14-table schema has neither table | future schema and UI | Capacity, driver assignment, shift and conflict rules approved | Constraint/conflict tests | Large | **BLOCKED by schema/business decision** |
| Monitoring and retention policy | 500 MB is only a target; no live metrics or lifecycle | Supabase monitoring, possible ops docs | Quota dashboards/alerts and approved export/retention schedule established | Alert and retention dry-run; no destructive test data | Medium | **NOT STARTED** |

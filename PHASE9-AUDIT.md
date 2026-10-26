# Phase 9 audit before fixes — 24 October 2026

Starting branch main, commit 605f1d4. Existing CLI metadata/untracked hosted artifacts are unrelated and must remain unchanged. Full master prompt read. No production access/change, email activation, credential rotation or Phase 10 work authorized. Preserved local Supabase only; no resets/deletion/software installation. Prior Phase 8 evidence is historical, not proof of the current run.

| Area | Initial classification | Evidence and action |
|---|---|---|
| Authentication/routes | PARTIAL | Layout verifies live getUser + staff membership; all staff share admin shell. DB RLS, not shell, protects data. Financial routes lack early role-specific denial. Add fail-closed current-role gate for management-only pages, preserve personal settings. |
| Roles | PARTIAL | Six enum roles; trusted exclusive SUPER_ADMIN; scoped management helpers reject mixed roles. Existing user_roles super-admin writes lack automatic change audit. Add append-only role-change trigger, no new staff-management UI. |
| Lead status | INSECURE / HIGH | Browser supplies reviewed_by and timestamp via direct update; status and activity separate; generic log can forge lead STATUS_CHANGE. Replace with atomic caller-derived scoped locked RPC; deny direct writes and forged status activity. |
| Generic contact lead | INSECURE / HIGH reliability | Service-role handler has separate customer/lead/activity requests, ignores activity failure; Date.now reference collision; no active frontend caller found. Replace with atomic service-only contact RPC and stable optional request UUID, no ride pipeline. |
| Booking/deposit | PARTIAL | Controlled Phase 4 RPC, row locks, stored amount/currency, append-only receipts/reversal, explicit zero/missing rule. Prior tests strong; rerun real local negative/concurrency regressions. |
| Quote/acceptance | PARTIAL | Controlled draft/link/delivery RPC; public acceptance hashes secure link, stored snapshot, expiry/revoke, unique booking. Rerun; do not change existing supported staff quoting policy without owner decision. |
| Legacy direct grants | INSECURE / HIGH | Ride-request, fleet, business-unit authenticated writes can bypass scoped management/audit UI. No legitimate direct application write caller found for those tables; use existing controlled Phase5 RPC and retain reads/public catalogue. Revoke unused write grants. |
| RLS isolation | PARTIAL | Per-BU policies in base; controlled newer tables; all currently require real local negative inspection/test across read/insert/update/delete. Historical policies are permissive OR composition; inspect effective state. |
| Chat/notifications | PARTIAL | Capability hashes/service-only visitor RPCs; dynamic staff/RLS reads, Phase8 per-recipient scope and polling. No frontend realtime subscriptions. Rerun tests; do not claim WebSocket security. |
| Communication | PARTIAL | Dedicated dispatcher secret, server-only provider credentials, frozen message/retry lease, signed webhook; mode disabled. Audit/regress only, no real emails. |
| Reports/exports/docs | PARTIAL | Invoker report filters by management helper, caps paging, CSV formula escaping, drafts/previews only. Add direct-page management gate; verify invalid filters and cross-tenant exports locally. |
| Settings/profile | PARTIAL | Personal profile upsert distinct from audited scoped document profile. Restrict personal writable columns and name length; no business settings escalation. |
| Audit log | INSECURE / HIGH lead gap | Booking/deposit/finance/chat events protected; lead STATUS_CHANGE remains caller-forgeable and separate write. Add authoritative lead/role events and guard. Keep legitimate quote CREATED/UPDATED use inside existing trusted draft RPC. |
| Public abuse | INSECURE / MEDIUM | Honeypot/input validation exist; no distributed rate guard for public server functions. Add service-only atomic database budgets with HMAC subjects, fixed server policies; no raw IP/token retention. Provider Auth limits remain independent. |
| Logs/errors | POTENTIAL RISK / MEDIUM | Global describeError expands arbitrary cause/stack; sensitive arbitrary errors may reach output. Sanitize known credentials/bearer URLs and use generic production SSR failure logging; never store raw request bodies. |
| Headers | PARTIAL | Server wrapper has generic error handling but no shared frame/MIME/referrer protections. Add narrow compatible headers, no broad CSP redesign. |
| Secrets | UNVERIFIED | No values printed. Inspect tracked env/history paths and public bundle; public Supabase publishable key is not privileged. Never rotate automatically. |
| HTML/storage | PARTIAL / NOT APPLICABLE | React escapes operational text; chart uses static generated CSS. No financial file-upload/storage caller found; on-demand protected views, no issued public document URL. |
| Destructive actions | PARTIAL | No active application hard-delete controls; cancel/reversal preserve history. Revoke unused direct table grants without deleting records. |
| Performance | POTENTIAL RISK | Polling5s, paginated report caps/indexes. New budget PK serializes same subject only. No speculative operational indexes. Retention and distributed abuse beyond per-subject limits require later operational policy. |

## Implementation checklist

1. Audit effective isolated policies/grants/function signatures; preserve Phase1–8 semantics.
2. One additive Phase9 migration: atomic lead/contact operations, unused direct-write lockdown, role audit/profile controls, rate budget RPC, existing log_activity guard correction.
3. Connect callers; shared server abuse guard + safe headers/logging; management page guard.
4. Negative JWT/RLS/role/tenant/concurrency/rollback tests, public endpoint guard tests and local direct URL browser checks.
5. Full regressions, TypeScript/lint/build/public secret scan; complete PHASE9-VERIFICATION.md. Stop before production release/Phase10. Keep Phase8 live/email pending.

No matrix row above is labelled VERIFIED SECURE based only on source inspection. Local empirical results and remaining limitations will be recorded separately.

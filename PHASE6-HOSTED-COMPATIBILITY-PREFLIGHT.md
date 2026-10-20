# Phase 6 hosted compatibility preflight

Inspected 2026-10-21T03:35:32.445033+05:30 (Asia/Calcutta). Target independently verified through Management API GET: `cudisqrugjupstgdeqac`.

**Decision: appears structurally compatible with the reviewed Phase 6 migration. HOLD production release until explicit migration/publication/deployment approval.** Local test success is not production execution evidence. Phase 3 real delivery and acceptance remain LIVE UNVERIFIED.

## Method and boundary

Existing Supabase CLI Management API credential read from established Windows credential storage (`Supabase CLI:supabase`) into process memory only. No service-role access or database password was used. Project metadata GET verified the exact project ID. Two SELECT-only metadata/aggregate queries used exclusively `POST /v1/projects/cudisqrugjupstgdeqac/database/query/read-only`. Both reported `transaction_read_only=on`; initial query confirmed `current_user=supabase_read_only_user`. No application RPC was invoked. Normal platform request telemetry may be recorded.

No connection relink, remote SQL mutation, migration command, DDL, operational action, email, deployment or cleanup occurred. Legacy config.toml project mismatch was preserved. Local artifacts `phase6-hosted-metadata.json` and `phase6-hosted-dependencies.json` contain schema metadata/helper definitions and aggregate counts, not customer records or credentials. Inspection was conducted with inline Python ctypes credential access and urllib HTTPS requests; no package installation.

## Compatibility matrix

| Dependency | Verified hosted result | Phase 6 effect |
|---|---|---|
| Conversations, messages, customers, leads and activities | All referenced existing columns present | Reuses actual columns |
| Conversation states | All eight existing states supported | No new states |
| Sender states | CUSTOMER/BOT/ADMIN/SYSTEM supported | No change |
| Timestamp precondition | Zero messages with NULL created_at | NOT NULL guard can validate current snapshot |
| Existing conversation data | 0 conversations; no status groups | No current chat rows require legacy adaptation |
| New columns | staff_read_message_id/client_operation_id absent | Additive migration required |
| New RPC/view objects | Phase 6 RPCs/chat_inbox absent | Application must not deploy before migration |
| Retry/customer indexes | New Phase 6 indexes absent; existing session hash/inbox/assignment indexes present | No observed naming collision |
| Helper defaults | is_staff/is_super_admin default to auth.uid(); BU helper present | Existing zero-argument calls supported |
| SUPER_ADMIN semantics | Trusted global role requires NULL business_unit_id | Matches reviewed authorization architecture |
| Crypto dependency | pg_catalog.sha256(bytea) exists | Payload audit hashing supported |
| RLS | Enabled on conversations/messages/customers/leads/activities | Migration preserves RLS |

No partial Phase 6 application was found among inspected objects. This is a point-in-time snapshot; a release should recheck drift and execute only the reviewed migration, not a catch-up push. No hosted migration ledger was modified or used as proof.

## Security findings

**Existing legacy visitor RPCs currently have EXECUTE for anon and authenticated as well as service_role.** Verified for chat_start_conversation, chat_load_conversation, chat_append_visitor_message, chat_append_bot_message, chat_request_handoff and chat_capture_contact. The prepared Phase 6 migration explicitly revokes PUBLIC/anon/authenticated access and grants only service_role. Capability-dependent operations still require their existing session hash; this finding does not itself establish disclosure of any visitor session. No exploit or operational call was attempted.

Current generic log_activity denies anon execution. Existing staff helpers use SECURITY DEFINER with empty search paths. The hosted helper definitions match the intended scope resolution: global SUPER_ADMIN, explicit staff roles, business-unit IDs from the authenticated actor's scoped role rows. Source review confirms new controlled mutations add their own role/scope/assignment checks and reserve CHAT audit metadata, while ordinary chat writes and capability-hash reads are removed for browser roles. These new controls passed isolated authenticated Supabase tests; they have NOT been exercised or installed in production.

## Release risks and next step

1. Apply the reviewed migration only after explicit production approval. Never deploy the new callers alone: they require the new RPCs/view and grants.
2. Existing public chat sessions on old assets can use retained service-only server operations; use coordinated deployment and postflight checking rather than removing old functions.
3. The migration is transactional and single-application. No reset, deletion or backfill is proposed. NULL message timestamps cause a clean abort instead of invented dates; recheck immediately before application.
4. Do not run an automatic migration catch-up or blindly change project links. The snapshot does not establish production concurrency/rollback/RLS behavior; local tests establish only local behavior.
5. Safest next step: request approval to apply only `20261021120000_phase6_chat_inbox.sql`, publish the reviewed source, deploy Worker `skyrun`, and perform scoped read-only postflight checks. Real email or customer workflow tests remain separately gated.

Production writes: **No**. Migration operations: **No**. Deployment: **No**. Emails/customer contact: **No**.

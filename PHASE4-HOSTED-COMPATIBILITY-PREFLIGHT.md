
## Hosted release update — 19 October 2026

The two reviewed fixes were applied with explicit owner approval; the ten targeted read-only postflight checks passed. Worker deployment succeeded (8bf14ff7-464b-4022-8f0d-9e056669b181). The earlier HOLD findings below are historical, corrected by this release. End-to-end live verification remains blocked by unconfirmed provider delivery; see PHASE4-LIVE-VERIFICATION.md. No reset, deletion, project relink or ledger repair occurred.

# Phase 4 hosted compatibility preflight

**Decision: HOLD — structurally compatible, but incompatible with the required release-security guarantees as written.**

Inspection: 19 October 2026, approximately 15:40–15:45 IST (Asia/Calcutta). First metadata snapshot: 2026-10-19T10:10:37.4989469Z. Verified hosted project: `cudisqrugjupstgdeqac`. PostgreSQL: 17.11.

Scope: authenticated READ-ONLY hosted metadata and aggregate inspection, plus local static review. **Phase 3 LIVE VERIFICATION remains UNVERIFIED.**

## 1. Target and safety boundary

The local link metadata identifies the intended project. The authenticated Management API GET of that exact project identifier succeeded and its returned identifier was checked. supabase/config.toml still has the legacy project_id xahvwghacqbapfrgazxh. This mismatch was recorded, not changed; all requests explicitly targeted cudisqrugjupstgdeqac. No project switch/relink occurred.

Used the existing Supabase CLI Management API credential from its established Windows credential store, held only in memory. No service-role key, database password, .env value or acceptance capability was used or printed.

The usual CLI database path was deliberately avoided: it can initialize a temporary login role, which is outside this task. Hosted SQL went exclusively through the dedicated endpoint:

`POST https://api.supabase.com/v1/projects/cudisqrugjupstgdeqac/database/query/read-only`

Successful inspection verified:
- current_user = supabase_read_only_user;
- transaction_read_only = on;
- the supplied read-only role has BYPASSRLS and row_security_active(public.bookings) = false. Consequently the aggregate counts below are not merely empty RLS-filtered customer/staff results.
- Only SELECT statements against catalogs/information_schema and aggregate counts were submitted. No application RPC was invoked.

The first larger metadata SELECT had a SQL syntax error in a qualified position expression; it was corrected to pg_catalog.strpos using the same read-only endpoint. No write-capable fallback, session-role initialization, privilege change or alternate database connection was used.

Read-only data access can produce ordinary platform request/audit telemetry; this report's no-write statements refer to no submitted business-data/schema mutations or configuration operations.

## 2. Repository state and local evidence

Branch main, HEAD 9b23cb4. Existing Phase 4 working-tree changes, CLI metadata change, hosted-check script, screenshots and exports were preserved. This audit creates only this report; it does not edit Phase 4 source or migrations. No packages/services/test databases were installed or started and no tests were rerun.

PHASE4-VERIFICATION.md and existing local logs record 319 unit/component tests and 13 Phase 4 database/browser scenarios passing. These remain prior LOCAL evidence, not production execution. Existing Phase 2/3 reports were reviewed. PHASE3-LIVE-VERIFICATION.md is absent; no real quote send, provider delivery or acceptance was tested.

No supabase_migrations.schema_migrations relation exists in the inspected hosted database. There is therefore no hosted CLI migration ledger to use as proof of application order. Actual catalog objects, signatures and body fingerprints were inspected instead. Do not run an automatic catch-up push or migration repair on the basis of local filenames.

## 3. Hosted schema facts

| Table | Present | RLS | Owner |
|---|---|---|---|
| activities | Yes | Enabled | postgres |
| bookings | Yes | Enabled | postgres |
| business_units | Yes | Enabled | postgres |
| customers | Yes | Enabled | postgres |
| leads | Yes | Enabled | postgres |
| quote_acceptance_links | Yes | Enabled | postgres |
| quote_deliveries | Yes | Enabled | postgres |
| quote_delivery_events | Yes | Enabled | postgres |
| quotes | Yes | Enabled | postgres |
| ride_requests | Yes | Enabled | postgres |
| user_roles | Yes | Enabled | postgres |

All listed tables have FORCE ROW LEVEL SECURITY false. This is compatible with existing postgres-owned SECURITY DEFINER workflow functions; their internal authorization remains essential.

Booking statuses, in actual enum order:
PENDING, CONFIRMED, ASSIGNED, DRIVER_ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW.

Quote statuses:
DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED, CANCELLED.

Ride-request and staff-role enum values match the local migration definitions. Booking final_amount is numeric(10,2), currency is text with existing USD default, quote final terms use numeric(10,2), and the existing confirmation/completion/cancellation timestamps are present. No deposit policy is inferred from the default currency or quote total.

Booking fields inspected:
id: uuid; business_unit_id: uuid; customer_id: uuid; ride_request_id: uuid nullable; quote_id: uuid nullable; vehicle_category_id: uuid nullable; booking_number: text; pickup_location: text; dropoff_location: text; travel_date: date; pickup_time: time nullable; passenger_count: int4; status: booking_status; final_amount: numeric, precision 10 scale 2 nullable; currency: text; notes: text nullable; confirmed_at: timestamptz nullable; completed_at: timestamptz nullable; cancelled_at: timestamptz nullable; created_at: timestamptz nullable; updated_at: timestamptz nullable.

Required public customers/leads/ride_requests/quotes/activities/business_units/user_roles columns exist. auth.users, auth.uid() and vehicle_categories dependencies exist. Existing booking/customer/quote/request/category foreign keys and quote-acceptance foreign keys are present.

### Phase 4 objects

All are absent:
- bookings.required_deposit_amount;
- booking_deposit_receipts and booking_deposit_reversals, including their composite types;
- can_manage_booking and phase4_booking_action, including overloads;
- uq_phase4_operation.

No inspected partial Phase 4 application was found. The hosted log_activity body still matches the pre-Phase-4 base migration.

### Existing indexes and triggers

- uq_bookings_accepted_quote is a unique quote_id index for non-null quote_id.
- Acceptance links have unique token hash, provider email, booking reference and one active link per quote.
- Booking number and booking primary-key uniqueness are present.
- Existing activity entity/time, business-unit/time and actor indexes are present.
- Enabled booking trigger: trg_bookings_updated_at, calling set_updated_at.
- Enabled quote triggers: trg_quotes_updated_at and guard_frozen_quote.
- No additional booking status/dispatch trigger appeared in this catalog inspection. External clients, scheduled jobs or private integrations are not proven absent.

Nineteen inspected public function bodies match local migration text fingerprints after CR normalization. This verifies source correspondence, not behavioral/live test success and not equality of ACLs. The user-role exclusivity trigger body was also separately matched.

## 4. Legacy aggregates

These are aggregate-only results; no customer, contact, address, trip, payment-reference, token or row-identifier data was exported.

| Booking status | Count |
|---|---:|
| PENDING | 0 |
| CONFIRMED | 0 |
| ASSIGNED | 0 |
| DRIVER_ASSIGNED | 0 |
| IN_PROGRESS | 0 |
| COMPLETED | 0 |
| CANCELLED | 0 |
| NO_SHOW | 0 |

Total bookings: 0. Total quotes: 0. Acceptance links / delivered links / accepted links: 0 / 0 / 0. Activities: 7.

Booking aggregates for missing quote/request/amount/version, invalid currency, relationship mismatch and missing acceptance proof all returned zero because there are no bookings. They are not evidence that those cases were behaviorally tested.

Duplicate non-null booking quote groups: 0.
Activities containing phase4_operation_id: 0.
Duplicate phase4 operation groups: 0.

Deposit-population inspection is not applicable: the field/tables do not exist yet. A later authorized nullable-column addition would not backfill a policy. Any bookings created between this snapshot and release need a fresh preflight; they would start with a missing deposit requirement.

The empty booking/quote/link counts do not establish that a historical live test never happened, but there is no available surviving evidence/report establishing one. Phase 3 LIVE VERIFICATION stays UNVERIFIED.

## 5. Migration compatibility matrix

| Proposed change | Hosted comparison | Assessment |
|---|---|---|
| Nullable numeric(10,2) booking requirement | Column absent; monetary/currency prerequisites present | Structurally compatible; no automatic backfill |
| Receipt/reversal tables and foreign keys | Names/types absent; bookings/business_units/auth.users exist | Structurally compatible |
| Receipt/reversal RLS and explicit table ACLs | Existing tenant helpers present and body-matched | Compatible in structure; depends on trusted role assignment |
| can_manage_booking role resolution | Role enum/helper/default arguments match | Function can compile; role-assignment security is currently insufficient (R1) |
| phase4_booking_action signature | No name collision; UUID/jsonb/timestamptz/numeric dependencies present | Structurally compatible |
| Acceptance snapshot validation | Matching Phase 3 acceptance source, JSON columns and protected quote terms | Statically compatible; no live acceptance run |
| Booking/activity I/U/D revokes | Broad hosted privileges verified | Insufficient: TRUNCATE/TRIGGER/REFERENCES/MAINTAIN remain (R2) |
| Generic log_activity replacement | Signature/return/body match the expected old implementation | Replaceable; existing explicit anon ACL is retained unless revoked (R3) |
| Operation-id unique expression index | No object collision and no existing reserved-key rows | No present-data conflict; requires lock/window review |
| Booking statuses | Exact existing enum preserved | No enum migration required |
| Terminal and unsupported dispatch statuses | No existing booking rows; no extra booking trigger | No current data conflict; external consumers remain an owner check |
| Phase 3 controlled INSERT | postgres-owned definer acceptance, service-only entry point | Ordinary staff grant revokes should not block it; local regression evidence exists |
| Transaction / repeat execution | BEGIN/COMMIT and timeouts present; unconditional CREATE/ADD | One-time migration only; rerunning after success will fail |
| Migration-history handling | Hosted migration ledger absent | Do not infer pending migrations or use broad push/repair |

DDL was not executed or dry-run against production, even inside a transaction. Local pass results are supporting evidence only.

## 6. Release blockers

### R1 — role-assignment policy permits scoped privilege escalation

**Severity: critical authorization dependency; HOLD release.**

Verified hosted user_roles_admin is FOR ALL with this USING expression:

```sql
business_unit_id = ANY (current_user_business_unit_ids())
```

It has no caller ADMIN/MANAGER/SUPER_ADMIN check and no separate WITH CHECK expression; PostgreSQL uses the USING condition as the default check. Authenticated has INSERT, UPDATE and DELETE privileges on user_roles. user_roles_own lets a caller read their own role row.

The only noninternal role-table trigger is trg_user_roles_exclusivity. Its body matches the source function that enforces SUPER_ADMIN/null-business-unit exclusivity, not authority of the caller to assign roles. The role scope CHECK and user/business-unit foreign keys likewise do not prevent changing a scoped SUPPORT role to a scoped ADMIN role.

Therefore the inspected policies/grants/trigger definitions indicate a restricted staff member can change their own role within their existing business unit. Phase 4 checks would subsequently trust that changed role. Its mixed-role safeguard does not prevent replacement of the original role row. Cross-unit row filtering still exists, but it is not a substitute for role-assignment authorization.

No role was inserted/updated/deleted and no exploit was executed. This is a finding from verified catalog definitions and matching trigger source.

Required before release: approve a local authorization-hardening change to user_roles writes. A minimal policy direction is to retain own/scoped reads and the trusted SUPER_ADMIN management boundary, and remove the membership-only write path; any delegated ADMIN role-management policy requires explicit owner agreement. Retest self-role edits, promotion, adding/removing conflicting roles, editing another user in the same unit, and cross-unit assignments.

### R2 — Phase 4 does not revoke hosted non-row-write privileges

**Severity: high hardening gap; HOLD release.**

Both anon and authenticated currently have these direct privileges on public.bookings and public.activities:

SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN.

No PUBLIC table ACL or relevant column-level INSERT/UPDATE ACL was found for these two tables. The checked-in Phase 4 migration revokes only INSERT, UPDATE and DELETE. It would leave TRUNCATE, REFERENCES, TRIGGER and MAINTAIN available.

RLS does not apply to whole-table TRUNCATE/REFERENCES. In particular, the activity audit table cannot be described as protected from destructive SQL-role operations while TRUNCATE remains granted. Foreign-key dependencies may constrain particular booking truncation operations, but they do not make these leftover privileges acceptable. Ordinary PostgREST row endpoints do not by themselves demonstrate a public HTTP TRUNCATE exploit; no SQL write or exploitation was attempted.

Required before release: explicitly remove unwanted non-read privileges on bookings/activities from ordinary roles (prefer a narrowly reviewed all-privileges revoke followed by the intended SELECT grant), preserve controlled postgres-owned operations and trusted server requirements, and test the actual hosted-default ACL profile locally. Assert absence of TRUNCATE/TRIGGER/REFERENCES/MAINTAIN privileges, not just failed row INSERT/UPDATE.

The new receipt/reversal tables already use REVOKE ALL followed by explicit SELECT; that portion addresses this default-grant behavior.

## 7. Other security and integrity findings

### R3 — explicit hosted function defaults need explicit revocation

Hosted postgres default privileges in public explicitly grant function EXECUTE to anon, authenticated and service_role. REVOKE FROM PUBLIC does not remove a direct anon grant.

Existing log_activity is executable by anon. Its auth.uid()/is_staff checks still reject an unauthenticated caller; no unauthenticated write was established. CREATE OR REPLACE preserves that existing function ACL, so Phase 4's final REVOKE FROM PUBLIC alone does not remove anon execution. Explicitly revoke unintended role grants when locally hardening the replacement.

The source-matched is_staff, is_super_admin and current_user_business_unit_ids helpers also have anon EXECUTE; the first two have auth.uid() defaults. These ACLs differ from assumptions based solely on reading source REVOKE PUBLIC statements. The two discovered chat capability functions also have anon EXECUTE despite service-only intent in their migration. This is an incidental existing ACL finding, not proof of an exploited chatbot issue; no chat call or change occurred.

Actual Phase 1 create_ride_enquiry and Phase 3 customer_quote_acceptance/record_quote_delivery/finish_quote_delivery/store_quote_delivery_event/process_quote_delivery_events deny anon/authenticated execution and allow service_role. Staff draft/preparation/revocation/status/begin functions permit authenticated and contain the expected source authorization. The new Phase 4 functions explicitly revoke anon; a service-role default EXECUTE grant does not create a staff identity because auth.uid()-based checks must still pass.

### R4 — transaction, concurrency and evidence integrity

Static review supports:
- exact decimal, explicit zero and missing-requirement blocking;
- normalized tenant-unique receipt references, matching currency and verified/unreversed-only totals;
- append-only reversal records and ordinary direct evidence-write revocation;
- booking lock shared by evidence/status operations, stale-version checks and unique operation audit identifiers;
- original accepted terms protected from ordinary status-operation edits;
- atomic state/evidence plus activity, including actor attribution;
- mandatory cancellation/reversal reasons and completion attestation;
- preserved terminal lifecycle states and payment exceptions without automatic refund/cancellation.

Caveats: staff verification attests external receipt; it is not bank/provider settlement verification. The existing updated_at trigger sets transaction time, so assigning clock_timestamp inside the RPC does not by itself guarantee a clock_timestamp result. Existing local concurrency tests are evidence, not a production race test. New evidence relations use separate booking/business-unit references; controlled RPC checks enforce agreement, so privileged maintenance must not bypass those invariants.

### R5 — release and rollback sequencing

The UI's booking-list query now selects required_deposit_amount. Deploying this UI before its schema is present will fail the list query. Approved release must coordinate schema first and compatible code afterward.

The migration is transactional but not rerunnable: existing successful/partial objects must be inspected, not skipped blindly. ALTER TABLE takes a strong booking-table lock; the operation index scans/locks activities. Current zero bookings/seven activities suggest low present data volume, not guaranteed lock availability.

Never roll back by dropping receipt/reversal/audit evidence or restoring unrestricted booking writes. Prefer a reviewed forward correction or compatible application rollback while retaining data and safeguards. No migration ledger exists, so release tracking needs an explicitly approved approach.

## 8. Authorization and function evidence

All nineteen functions below are postgres-owned SECURITY DEFINER with an explicit empty search_path. Their body fingerprints match the relevant local pre-Phase-4 migration. A Yes under a role is catalog EXECUTE permission, not proof that internal authorization allows that role to complete an operation.

| Function | Definer | anon EXECUTE | authenticated EXECUTE | service EXECUTE | Normalized body MD5 |
|---|---|---|---|---|---|
| begin_quote_delivery | Yes | No | Yes | Yes | c09d96c0fa7003d6164563d0d4a54d26 |
| chat_capture_contact | Yes | Yes | Yes | Yes | 571a8430f3871c5e83c556fbb5812a7d |
| chat_request_handoff | Yes | Yes | Yes | Yes | 0ea437c9f79a15fa3d58cd766e5a0873 |
| create_ride_enquiry | Yes | No | No | Yes | 55010ee3cb71c0d4eefe262f5034b14c |
| current_user_business_unit_ids | Yes | Yes | Yes | Yes | 021e8f3353b8d205f320cd14426d5a50 |
| customer_quote_acceptance | Yes | No | No | Yes | 18e06f445bb790b03b5e3616ae7f4768 |
| finish_quote_delivery | Yes | No | No | Yes | 934123dc0b16d349d3b15db4dceb776b |
| guard_frozen_quote | Yes | No | No | Yes | 9b76b42d0fa814cbe33be324dc9e6792 |
| is_staff | Yes | Yes | Yes | Yes | 2205c695ab2a5f3eb98efa408fa1d055 |
| is_super_admin | Yes | Yes | Yes | Yes | a358afd4ea031907f1fb2c2fb8cbc92c |
| log_activity | Yes | Yes | Yes | Yes | 8d0b5833fd69c468de78f0793f44f568 |
| prepare_quote_acceptance | Yes | No | Yes | Yes | 6190349e140fea8c7c27fac24c9eacfd |
| process_quote_delivery_events | Yes | No | No | Yes | d7b59ff0483239d39a6fc88124f1d8c8 |
| quote_delivery_status | Yes | No | Yes | Yes | cd4836ba7da1153e282ddb500fe78fe1 |
| record_quote_delivery | Yes | No | No | Yes | 8dce54c203f001f347b0642ba8e1b2a8 |
| revoke_quote_acceptance | Yes | No | Yes | Yes | 7b69e4a9388fcdc9b798f461da9f9b5c |
| save_quote_draft | Yes | No | Yes | Yes | e84b7503d4a72055d6443b80b3142e9e |
| set_updated_at | Yes | Yes | Yes | Yes | 13370ad7cd88365ad8221e14736afc84 |
| store_quote_delivery_event | Yes | No | No | Yes | 804582e05c62f6e43ccfdc89195229ba |

The role trigger enforce_super_admin_exclusivity also matches fingerprint b4b9b61df41ea6b7c9d9ad9bb342a5f3. Its actor-authority gap is described in R1.

The read-only inspection role deliberately bypasses RLS for complete catalog/aggregate visibility. This audit did not impersonate real staff, use customer capabilities or verify behavioral RLS by performing production operations.

## 9. Recommended next steps and approval

1. **Approve local changes only** to fix R1 and R2, and explicitly settle R3's function execution grants.
2. Reproduce hosted default privileges in an isolated test environment; add role self-escalation and non-row-privilege assertions. Preserve all Phase 1–3 regressions and receipt/booking concurrency tests.
3. Repeat this read-only preflight immediately before release. Recheck object absence, counts, ACLs and external booking/role-management consumers.
4. Separately approve a narrowly targeted production migration and coordinated deployment after the fixes pass. Do not issue an automatic migration catch-up or repair.
5. Separately authorize live Phase 3/4 verification with labelled records and the approved recipient. Until then Phase 3 LIVE VERIFICATION stays UNVERIFIED.

No implementation amendment was made during this audit. This report is not approval to release.

## 10. Files read or created and inspection commands

Created: F:/SKYRUN/skyrun/PHASE4-HOSTED-COMPATIBILITY-PREFLIGHT.md only.

Local files read (full files or relevant sections):
- supabase/config.toml; supabase/.temp/linked-project.json;
- all ten SQL files under supabase/migrations, including complete 20261019090000_phase4_booking_deposits.sql;
- src/integrations/supabase/types.ts;
- src/lib/booking-deposits.ts; src/components/booking-deposits.tsx;
- src/routes/_authenticated/admin.booking.$id.tsx; src/routes/_authenticated/admin.m.$module.tsx; src/routes/_authenticated/route.tsx;
- src/lib/admin-data.ts; src/lib/quote-acceptance.functions.ts; src/lib/quotes.functions.ts;
- scripts/phase4-bookings.integration.mjs; src/test/booking-deposits.test.tsx;
- PHASE4-VERIFICATION.md; PHASE3-VERIFICATION.md; PHASE2-VERIFICATION.md;
- phase4-database.log; phase4-tests.log; phase4-build.log; phase4-lint.log;
- node_modules/supabase/dist/supabase.js;
- C:/Users/padar/.codex/plugins/cache/ponytail/ponytail/5.3.2/skills/ponytail/SKILL.md.

Local commands: git status --short; git branch --show-current; Get-Content/Select-String/rg for the paths above; Test-Path for known token-file locations (values never read/printed); Python pathlib/re/hashlib to compare normalized local SQL bodies. A public GitHub API tree listing and official source/documentation reads established CLI credential lookup and login-role behavior. The existing credential was read in memory through Windows CredReadW for the CLI's known namespace; no credentials were created, changed, enumerated broadly or written to a file.

Hosted inspection commands, with credential values redacted:

```powershell
# Existing credential held only in memory; no token in command arguments or logs.
Invoke-RestMethod -Method Get -Uri https://api.supabase.com/v1/projects/cudisqrugjupstgdeqac -Headers @{Authorization='Bearer [REDACTED]'}
Invoke-RestMethod -Method Post -Uri https://api.supabase.com/v1/projects/cudisqrugjupstgdeqac/database/query/read-only -Headers @{Authorization='Bearer [REDACTED]'} -ContentType application/json -Body (@{query=$readOnlySelect}|ConvertTo-Json -Compress)
```

The POST was used for identity/session proof, catalogs/aggregate metadata, ACL/default-ACL/visibility checks, Phase 4 names and role-policy dependencies, and migration-ledger existence. Read-only SELECT statements are reproduced below. No generic write-capable database-query endpoint or CLI database connection was used.

## 11. Explicit safety confirmation

| Action during this audit | Occurred? |
|---|---|
| Production business-data or schema writes | **No** |
| Applying/pushing/repairing migrations, including transaction dry runs | **No** |
| Role/RLS/grant/function/trigger changes | **No** |
| Deployments or production configuration changes | **No** |
| Booking/quote/deposit/activity operational calls | **No** |
| Emails or customer communications | **No** |
| Database reset/recreation/cleanup | **No** |
| Secrets or customer/trip/payment data exported | **No** |

## Sources used to choose a safe inspection method

- [Supabase dedicated read-only query endpoint](https://supabase.com/docs/reference/api/v1-read-only-query)
- [Supabase CLI login-role initialization source](https://github.com/supabase/cli/blob/develop/apps/cli-go/internal/utils/flags/db_url.go)
- [Supabase CLI credential lookup](https://github.com/supabase/cli/blob/develop/apps/cli-go/internal/utils/access_token.go)
- [PostgreSQL 17 RLS limitations and implicit WITH CHECK semantics](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)

## Appendix — successful read-only SQL

Identity query:
```sql
select current_user as database_role, pg_catalog.current_setting('transaction_read_only') as read_only;
```


### Catalogs and booking aggregates

```sql
select pg_catalog.jsonb_build_object(
'session',pg_catalog.jsonb_build_object('user',current_user,'readonly',pg_catalog.current_setting('transaction_read_only'),'version',pg_catalog.current_setting('server_version')),
'columns',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.table_name,'column',c.column_name,'type',c.data_type,'udt',c.udt_name,'nullable',c.is_nullable,'precision',c.numeric_precision,'scale',c.numeric_scale,'default',c.column_default) order by c.table_name,c.ordinal_position) from information_schema.columns c where c.table_schema='public' and c.table_name in ('bookings','quotes','ride_requests','leads','customers','activities','business_units','user_roles','quote_acceptance_links','quote_deliveries','quote_delivery_events','booking_deposit_receipts','booking_deposit_reversals')),
'enums',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',t.typname,'value',e.enumlabel) order by t.typname,e.enumsortorder) from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid=e.enumtypid join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname in ('booking_status','quote_status','ride_request_status','app_role')),
'tables',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('bookings','quotes','ride_requests','leads','customers','activities','business_units','user_roles','quote_acceptance_links','quote_deliveries','quote_delivery_events','booking_deposit_receipts','booking_deposit_reversals')),
'constraints',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.relname,'name',con.conname,'definition',pg_catalog.pg_get_constraintdef(con.oid)) order by c.relname,con.conname) from pg_catalog.pg_constraint con join pg_catalog.pg_class c on c.oid=con.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('bookings','quotes','activities','quote_acceptance_links','booking_deposit_receipts','booking_deposit_reversals')),
'indexes',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',i.tablename,'name',i.indexname,'definition',i.indexdef) order by i.tablename,i.indexname) from pg_catalog.pg_indexes i where i.schemaname='public' and i.tablename in ('bookings','activities','quote_acceptance_links','booking_deposit_receipts','booking_deposit_reversals')),
'policies',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',p.tablename,'name',p.policyname,'roles',p.roles,'command',p.cmd,'using',p.qual,'check',p.with_check) order by p.tablename,p.policyname) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename in ('bookings','quotes','activities','quote_acceptance_links','quote_deliveries','quote_delivery_events','booking_deposit_receipts','booking_deposit_reversals')),
'functions',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',p.proname,'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),'returns',pg_catalog.pg_get_function_result(p.oid),'owner',pg_catalog.pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'body_md5',pg_catalog.md5(pg_catalog.replace(p.prosrc,pg_catalog.chr(13),'')),'auth_uid',pg_catalog.strpos(p.prosrc,'auth.uid')>0,'anon_execute',pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE'),'staff_execute',pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname in ('create_ride_enquiry','save_quote_draft','prepare_quote_acceptance','revoke_quote_acceptance','guard_frozen_quote','record_quote_delivery','customer_quote_acceptance','quote_delivery_status','begin_quote_delivery','finish_quote_delivery','store_quote_delivery_event','process_quote_delivery_events','log_activity','is_staff','is_super_admin','current_user_business_unit_ids','set_updated_at','can_manage_booking','phase4_booking_action') or p.prosrc ~ '(public.bookings|public.activities)')),
'triggers',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_catalog.pg_get_triggerdef(t.oid)) order by c.relname,t.tgname) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and c.relname in ('bookings','quotes','activities')),
'grants',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.relname,'role',r.name,'select',pg_catalog.has_table_privilege(r.name,c.oid,'SELECT'),'insert',pg_catalog.has_table_privilege(r.name,c.oid,'INSERT'),'update',pg_catalog.has_table_privilege(r.name,c.oid,'UPDATE'),'delete',pg_catalog.has_table_privilege(r.name,c.oid,'DELETE')) order by c.relname,r.name) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),('authenticated'),('service_role')) r(name) where n.nspname='public' and c.relname in ('bookings','activities','quotes','quote_acceptance_links','quote_deliveries','quote_delivery_events')),
'status_counts',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('status',b.status,'count',b.n) order by b.status) from (select status::text as status,count(*) as n from public.bookings group by status) b),
'legacy',(select pg_catalog.jsonb_build_object('bookings',count(*),'no_quote',count(*) filter(where b.quote_id is null),'no_request',count(*) filter(where b.ride_request_id is null),'missing_amount',count(*) filter(where b.final_amount is null),'missing_version',count(*) filter(where b.updated_at is null),'invalid_currency',count(*) filter(where b.currency !~ '^[A-Z]{3}$'),'missing_acceptance_proof',count(*) filter(where not exists(select 1 from public.quote_acceptance_links l where l.booking_id=b.id and l.quote_id=b.quote_id and l.accepted_at is not null))) from public.bookings b),
'duplicate_quote_groups',(select count(*) from (select b.quote_id from public.bookings b where b.quote_id is not null group by b.quote_id having count(*)>1) d),
'reserved_activity_rows',(select count(*) from public.activities a where a.metadata ? 'phase4_operation_id'),
'duplicate_operation_groups',(select count(*) from (select a.metadata->>'phase4_operation_id' from public.activities a where a.metadata ? 'phase4_operation_id' group by a.metadata->>'phase4_operation_id' having count(*)>1) d)
) as preflight
```

### Visibility and grants

```sql
select pg_catalog.jsonb_build_object(
'read_visibility',pg_catalog.jsonb_build_object('role',current_user,'readonly',pg_catalog.current_setting('transaction_read_only'),'rls_active_bookings',pg_catalog.row_security_active('public.bookings'::pg_catalog.regclass),'bypass_rls',(select r.rolbypassrls from pg_catalog.pg_roles r where r.rolname=current_user)),
'table_acls',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.relname,'grantee',coalesce(r.rolname,'PUBLIC'),'privilege',a.privilege_type) order by c.relname,r.rolname,a.privilege_type) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join lateral pg_catalog.aclexplode(c.relacl) a left join pg_catalog.pg_roles r on r.oid=a.grantee where n.nspname='public' and c.relname in ('bookings','activities') and (r.rolname in ('anon','authenticated') or a.grantee=0)),
'column_write_acls',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',c.relname,'column',a.attname,'grantee',coalesce(r.rolname,'PUBLIC'),'privilege',acl.privilege_type)) from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join lateral pg_catalog.aclexplode(a.attacl) acl left join pg_catalog.pg_roles r on r.oid=acl.grantee where n.nspname='public' and c.relname in ('bookings','activities') and (r.rolname in ('anon','authenticated') or acl.grantee=0) and acl.privilege_type in ('INSERT','UPDATE')),
'default_acls',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'grantee',coalesce(r.rolname,'PUBLIC'),'privilege',a.privilege_type)) from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace cross join lateral pg_catalog.aclexplode(d.defaclacl) a left join pg_catalog.pg_roles r on r.oid=a.grantee where pg_catalog.pg_get_userbyid(d.defaclrole)='postgres' and (n.nspname='public' or d.defaclnamespace=0) and d.defaclobjtype in ('f','r') and (r.rolname in ('anon','authenticated','service_role') or a.grantee=0)),
'quote_counts',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('status',q.status,'count',q.n)) from (select status::text as status,count(*) as n from public.quotes group by status) q),
'acceptance_counts',(select pg_catalog.jsonb_build_object('links',count(*),'accepted',count(*) filter(where l.accepted_at is not null),'delivered',count(*) filter(where l.delivered_at is not null)) from public.quote_acceptance_links l),
'relationship_mismatches',(select count(*) from public.bookings b left join public.customers c on c.id=b.customer_id left join public.quotes q on q.id=b.quote_id left join public.ride_requests r on r.id=b.ride_request_id where c.business_unit_id is distinct from b.business_unit_id or (b.quote_id is not null and (q.business_unit_id is distinct from b.business_unit_id or q.customer_id is distinct from b.customer_id or q.ride_request_id is distinct from b.ride_request_id)) or (b.ride_request_id is not null and (r.business_unit_id is distinct from b.business_unit_id or r.customer_id is distinct from b.customer_id)))
) as extra
```

### Object names, policies and dependencies

```sql
select pg_catalog.jsonb_build_object(
'phase4_relations',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.relname,'kind',c.relkind)) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('booking_deposit_receipts','booking_deposit_reversals','uq_phase4_operation')),
'phase4_types',(select pg_catalog.jsonb_agg(t.typname) from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname in ('booking_deposit_receipts','booking_deposit_reversals')),
'phase4_functions',(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can_manage_booking','phase4_booking_action')),
'auth_function_defaults',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',p.proname,'defaults',pg_catalog.pg_get_expr(p.proargdefaults,0))) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_staff','is_super_admin')),
'other_policies',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',p.tablename,'name',p.policyname,'command',p.cmd,'using',p.qual,'check',p.with_check)) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename in ('customers','leads','ride_requests','business_units','user_roles')),
'activities_count',(select count(*) from public.activities),
'expected_dependencies',(select pg_catalog.jsonb_build_object('auth_users',pg_catalog.to_regclass('auth.users') is not null,'vehicle_categories',pg_catalog.to_regclass('public.vehicle_categories') is not null,'auth_uid',pg_catalog.to_regprocedure('auth.uid()') is not null))
) as final_checks
```

### Role-assignment checks

```sql
select pg_catalog.jsonb_build_object(
'role_table_grants',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.name,'insert',pg_catalog.has_table_privilege(r.name,'public.user_roles','INSERT'),'update',pg_catalog.has_table_privilege(r.name,'public.user_roles','UPDATE'),'delete',pg_catalog.has_table_privilege(r.name,'public.user_roles','DELETE'))) from (values('anon'),('authenticated')) r(name)),
'role_triggers',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_catalog.pg_get_triggerdef(t.oid),'function',p.proname,'body_md5',pg_catalog.md5(pg_catalog.replace(p.prosrc,pg_catalog.chr(13),'')))) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_proc p on p.oid=t.tgfoid where n.nspname='public' and c.relname='user_roles' and not t.tgisinternal),
'role_constraints',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',con.conname,'definition',pg_catalog.pg_get_constraintdef(con.oid))) from pg_catalog.pg_constraint con where con.conrelid='public.user_roles'::pg_catalog.regclass)
) as role_checks
```

Ledger existence query (returned false; no ledger rows were queried):
```sql
select pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null as ledger_exists;
```


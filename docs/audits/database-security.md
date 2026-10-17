# Deliverable E — Database and Security Findings

## Schema inventory

The production migration `supabase/migrations/20261007021413_skyrun_production_schema.sql` defines the approved 14 tables: `organizations`, `business_units`, `profiles`, `user_roles`, `customers`, `leads`, `conversations`, `conversation_messages`, `ride_requests`, `quotes`, `bookings`, `vehicle_categories`, `vehicles`, `activities`. It contains no approved `services` table, `service_id`, driver, availability, or notification table. No matching code/migration introducing `service_id` was found. Types align broadly with this schema, but types are generated/static artifacts and not proof of deployment.

Vehicle FK ordering is corrected locally: `vehicle_categories` is created before `ride_requests`, `quotes`, `bookings`, `vehicles`. Profile email mismatch is reconciled locally by dropping `profiles.email`; UI displays `user.email` from Supabase Auth, not profile email. Activity logging has a controlled `SECURITY DEFINER` `log_activity` function with entity allowlist and business-unit validation. Role helpers are defined after `user_roles` and policies call helper functions rather than recursively selecting roles directly. Migration text records no publication/realtime setup. All these findings concern local SQL only.

## Findings by severity

### Critical / P0

1. **Wrong Supabase project configured (High confidence).** `supabase/config.toml` has `project_id = "xahvwghacqbapfrgazxh"`; approved target noted in prompt and production migration header is `cudisqrugjupstgdeqac`. Any future CLI command with linked project context could point elsewhere. **Remediation:** verify ownership/reference and align config only through reviewed change; until then do not apply/push migrations.
2. **Anonymous service-role lead ingestion lacks abuse controls (High).** `src/lib/leads.functions.ts` exports a public server function and dynamically uses `supabaseAdmin` (`client.server.ts`), bypassing RLS; input schema has an optional blank-only `website` honeypot, but neither UI call supplies it and no rate limiter/idempotency exists. Repeated submissions can create unbounded customer/lead rows. **Remediation:** add server-side rate limiting/abuse defense and idempotency; keep service credentials server-only; add safe logging and abuse tests.
3. **Cross-entity business-unit consistency not established (Medium).** Tables independently store `business_unit_id` and foreign keys generally do not enforce that customer/ride/quote/booking/category belong to the same BU. Existing UI does not create these operations yet. A future authorized insert could link valid IDs across units unless code/policies enforce same-tenant relationship. **Remediation:** enforce consistent tenant linkage with constraints/secure RPCs and adversarial tests before CRUD workflows.

### High / P1

4. **Customer deduplication race and partial write (High).** `submitLead` does lookup-then-insert by email. Concurrent same-address submissions may collide with `uq_customers_email_bu`; phone uniqueness can also conflict. Customer insert failure returns generic error, with no retry/reselect. Lead/activity are separate operations; activity error is ignored. **Remediation:** atomic upsert/match path keyed by unique constraint and transactional lead/activity creation or explicitly report partial failure; add concurrent tests.
5. **Lead mutation can appear successful when write/log fails (High).** `fetchLeads` drops returned errors; `setLeadStatus` ignores errors from both update and `log_activity`; several detail status handlers also ignore update/RPC result. UI reload can leave stale/ambiguous state. **Remediation:** surface errors, check affected-row counts, and couple status/activity transactionally.
6. **Generic role access, no least-privilege UI (High).** `_authenticated/route.tsx` permits all six roles, then renders every sidebar item. RLS migration restricts rows by business-unit membership but most staff policies use `FOR ALL`, with no role-specific grants. Actual row isolation is unverified remotely. **Remediation:** define role-to-action matrix and enforce it server/database side; verify cross-BU and role-negative cases against target project.
7. **Public trip request data not structured (High).** `BookingForm` sends trip information as lead text; it cannot drive `ride_requests`, quote or booking flow. No duplicate submit guard. **Remediation:** validated server action that creates linked customer + lead + ride request atomically, then staff visibility.

### Medium / P2

8. **Local applied migration state unknown (High confidence on limitation).** Four migration files exist. No `.git`, safe linked-project verification, or remote CLI check. `supabase/config.toml` mismatch makes blind check inappropriate. **Remediation:** verify intended target and obtain read-only migration ledger/schema snapshot before deployment.
9. **Dashboard/list scalability and error states (High).** Leads/customers are fetched without pagination, filtered in browser; errors commonly become empty data. **Remediation:** database filters/order/limits, pagination, explicit loading/error states, bounded activity views.
10. **Activity table only covers selected paths (High).** Lead creation tries an activity write (ignores errors); status/note use `log_activity`. Other CRUD modules do not exist. Activity log is append-only in schema but actor attribution via metadata in one caller and DB actor in RPC differs. **Remediation:** define canonical activity contract and use transactional mutation procedures.
11. **`profiles_staff_select` uses role-table existence subquery (Medium).** Policy calls `public.is_staff()` and `current_user_business_unit_ids()` helpers but also selects `user_roles ur_target`. It is not a direct self-policy recursion because the query is on profiles, yet it depends on separate user_roles RLS/security-definer context; validate on deployed PostgreSQL. No live recursion test was run. **Remediation:** exercise role/profile policies with representative roles; simplify only if a live issue is demonstrated.
12. **Bootstrap migration history warrants review (Medium).** Early migrations create `bootstrap_first_admin()` and grant authenticated execution in the no-arg variant; the next migration revokes both overloads and drops them. The ending state of the full ordered local set removes them, but intermediate deployment history matters. Confirm all migrations run in order and inspect current deployed function privileges before trusting the result.

## RLS / constraints / storage observations

- RLS enabled for all 14 tables in production migration. Policies for leads/customers/conversations/ride requests/quotes/bookings/vehicles/categories scope business unit and call `is_staff`; explicit `is_super_admin()` branches give global access. Public read is limited to visible vehicle categories and active vehicles for the fixed Skyrun BU UUID.
- `user_roles` has own select, super-admin all, and BU-scoped all policies. Actual implications of policy composition and writes require tests on target.
- `activities` allows staff select/insert only, no update/delete policy; RPC has explicit authentication/staff/entity/BU checks.
- Dedup unique indexes: customer lowercased email and exact phone per BU; lead/request/booking identifiers unique. Public lead number generated from millisecond timestamp, so same-millisecond collisions are possible though low frequency; no retry. No application-level idempotency token.
- Storage uploads/buckets are not used in source or migrations. Static imagery is bundled under `src/assets`; no Supabase Storage policy/bucket requirement found.
- No realtime publication or table subscription found.
- Remote FK validity, RLS behavior, applied state, indexes, data, and constraints are **UNVERIFIED**.

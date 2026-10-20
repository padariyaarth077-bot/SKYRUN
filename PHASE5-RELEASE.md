# Phase 5 approved hosted release — 21 October 2026

Status: hosted migration applied; application publication/deployment and fleet image browser verification pending at this revision.

The owner explicitly approved read-only compatibility inspection and, if compatible, applying the Phase 5 migration, publishing reviewed source to GitHub and deploying Worker skyrun. No emails, booking/deposit operations or operational fixture creation are included.

Target verified through repository link metadata and authenticated Supabase Management API GET: cudisqrugjupstgdeqac. Legacy config project reference was not changed or used. Read-only metadata requests used /database/query/read-only with transaction_read_only=on; no customer/contact data exports were requested.

Compatibility: Phase 4 operation present; unsafe role policy absent; catalogue, image columns and Phase 5 RPC absent; existing column names/types and activity check constraint match the reviewed migration. Existing logger body matches local Phase 4 source (normalized MD5 b84ecdee4e60f3d35850d38cf225e3f4). Existing helpers are postgres-owned SECURITY DEFINER with empty search paths. Trusted server customer INSERT is available; ordinary direct activity INSERT is denied. information_schema role_table_grants was not visible to the read-only role, so absence of those rows was not treated as absence of privileges; explicit privilege checks were used.

Aggregate legacy counts: bookings 0, vehicles 0, vehicle categories 0. No vehicle details, capacities or ownership were invented or populated. The supplied 14-photo gallery opens by default so photos are immediately visible even without saved fleet records.

Applied exactly supabase/migrations/20261021090000_phase5_customers_configuration.sql using the authenticated Management API query endpoint after validating target and SHA256. Returned success at 2026-10-20T20:56:53Z (21 October 2026 Asia/Calcutta). SHA256 646A1C58377A7852051EC60272EFB0594624B1D220F91D4CBDD5BF41CBEED43A. The migration uses BEGIN/COMMIT; no reset, deletion, project relink, automatic db push or migration-ledger repair occurred.

Read-only postflight: catalogue RLS true; two nullable image columns present; two protective image triggers; Phase 5 operation unique index present; ordinary customer UPDATE and catalogue INSERT denied; trusted customer intake preserved; anon/service-role controlled RPC execution denied and authenticated execution granted; both elevated functions are postgres-owned with empty search paths. Catalogue contains zero rows, as expected (no backfill/seed).

Release checks: npm run build passed after the gallery-default change; npm run test -- src/test/phase5.test.tsx --maxWorkers=1 --pool=threads passed all 22 focused tests. Previous verified baseline remains 345 full unit/component tests, passing TypeScript/build, lint with nine existing warnings, 11 isolated Phase 5 scenarios and 45 earlier-phase isolated regression scenarios. No new database function change was made after isolated verification. See PHASE5-VERIFICATION.md for commands and limitations.

Production write scope: approved schema/function/grant migration only. No emails, bookings, deposits, customer edits, vehicle records or configuration entries were created or changed operationally. No tests that create synthetic business records were run against production.
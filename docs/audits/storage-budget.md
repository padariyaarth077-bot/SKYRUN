# Deliverable G — Storage Budget Report

## Known and unknown

The 500 MB figure is a planning target only. This audit could not safely access the Supabase dashboard or query the intended project. Current database bytes, index bytes, object storage usage, project plan/quota, log retention, realtime limits and remaining capacity are **UNKNOWN — DASHBOARD VERIFICATION REQUIRED**. Local `supabase/config.toml` points to a different project reference than the approved target, so no remote inspection was attempted.

## Qualitative growth drivers

- **Database rows:** leads, customers and activities are the likely initial growth drivers; every successful lead attempts to create customer+lead+activity. Chat completion contributes a generic lead, not a transcript.
- **Future messaging:** if conversations/messages are implemented, message count can grow faster than customer/lead counts. Current app does not persist message text in the conversation tables.
- **Indexes:** migration includes 21 indexes for status, created/travel dates, business-unit scoping, foreign keys and activity/message access patterns. Indexes consume database disk separately from row payload.
- **Payload size:** lead message can contain all booking form fields and notes; validation caps this path at 4,000 characters. Repeated submissions have no idempotency guard. Customer notes and conversation message size have no visible app-level retention workflow; DB constraints/details are in local migration.
- **Object storage:** no upload API, bucket, document workflow, or Supabase Storage policy found. Public assets are bundled JPG files in `src/assets`, not Supabase object storage.
- **Logs and realtime:** app error reporting writes console logs only; no custom database log table. No realtime usage configured in application or migration.

## Practical monitoring recommendations

1. Verify quotas separately for database, object/file storage, logs, bandwidth and realtime on the intended Supabase plan.
2. Record monthly database/table/index sizes and row counts for leads, customers, activities and (when enabled) conversation messages.
3. Alert on unusual public lead creation rates and growth; consider rate limits and abuse detection before launch.
4. Define retention/export and deletion policies for personal data and chat transcripts only after business/legal review; do not delete or purge as part of this audit.
5. Keep message and activity payloads bounded; avoid storing duplicate full lead text in both messages and metadata.
6. Reassess indexes with real query plans and usage; indexes reduce query cost but add write and storage cost.

No exact usage estimate is stated because no trustworthy live size or traffic data was available.

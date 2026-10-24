# Phase 8 audit and implementation plan — 21 October 2026

Before implementation: main, e30650f; only existing CLI metadata/untracked historical artifacts present. No Phase8 production authorization. Ponytail workflow: smallest complete extension, no new dependencies, preserve earlier workflows.

| Feature | Actual source / finding | Classification / action |
|---|---|---|
| Notification bell/page | admin-shell.tsx links to placeholder module; no storage/count | PLACEHOLDER: replace with scoped durable notifications |
| Realtime | Historical chat publication exists; actual Phase6 inbox/widget uses usePolling, no frontend subscription | PARTIAL: reuse five-second polling with immediate focus/reconnect refresh; explicitly near-real-time, not WebSocket |
| Activities | Restricted direct writes; Phase4 authoritative booking/deposit events; Phase6 handoff; Phase3 acceptance creates one PENDING booking | VERIFIED IN PRIOR LOCAL TESTS: triggers from real source rows/events only |
| Lead events | Actual lead source CONTACT_FORM/RIDE_ENQUIRY; Phase1 transaction handles retry | Reuse AFTER INSERT without generic client event generation |
| Chat | CUSTOMER messages persisted, handoff activity authoritative; staff messages ADMIN | Use customer messages/handoff only; exact conversation deep link and active-conversation suppression |
| Quote email | quote-delivery.functions.ts, quote-email.server.ts, quote_deliveries, signed Resend webhook, durable idempotency and reconciliation | EXISTING: preserve; real customer delivery remains LIVE UNVERIFIED |
| Other email automation | No durable booking/staff communications queue or processor | NOT IMPLEMENTED: additive outbox and signed event tracking, disabled by default |
| Toast/audio | Sonner installed/component exists; no notification audio/preferences | NOT IMPLEMENTED: admin-only provider, short original synthesized tones after explicit interaction |
| Roles | Trusted SUPER_ADMIN; scoped operational ADMIN/MANAGER/SUPPORT/DISPATCHER; finance ADMIN/MANAGER; mixed roles fail closed | Reuse semantics; per-recipient dynamic RLS rechecks access after role changes |
| Preferences | Profile/document settings only | BLOCKED BY SCHEMA: own-user preferences + audited controlled save |
| Financial documents | Phase7 drafts/previews, official numbering/issuance deferred | OUT OF SCOPE: never queue financial documents |
| Scheduler/staff recipients | No approved new cron configuration; verified staff email available from auth.users | EXTERNAL CONFIGURATION: bounded protected processor, manual retry; no deployment/configuration/real sends |

## Implementation order

1. Add migration proposal with notifications (per recipient, unique source event), preferences, communications outbox, signed delivery events; scoped read policies, controlled read/preferences/retry/claim/result functions. No backfill or deletion. Notifications and email envelopes created in source transaction; actual provider I/O outside it.
2. In-app categories: enquiry/contact, customer chat/handoff, combined quote accepted + pending booking created (one logical alert), confirmed/cancelled, verified deposit, reversal exception. Minimal generic previews, no customer PII in toast payload.
3. Bell/recent list, paged center, own read state and race-safe mark-all cutoff, filters, safe related links. Shared admin context with polling/focus/online refresh, duplicate suppression and own/active chat suppression. Sound unlock/test explicit; mute/volume/severity/category controls persisted. Cross-tab lock coordination where supported.
4. Booking confirmed/cancelled customer templates use immutable stored trip/reference snapshots. Optional urgent staff emails require explicit opt-in and confirmed auth email. Existing quote flow unchanged. Provider mode defaults disabled; retries same body/key bounded before provider idempotency expiry, ambiguous old attempts require reconciliation. Signed webhook records delivery independently from business state. Expose safe communication status/retry to authorized managers.
5. Unit/component + guarded isolated DB/browser harness, full regressions, TypeScript/lint/build. Local migration execution/service start requires separate exact approval; no production access/deployment/emails under this task.

Polling transport intentionally reuses deployed architecture: updates without full refresh, RLS rechecked on every request, no subscription payload leak. Not claiming sub-second/WebSocket guarantees. Future scheduler/provider enablement requires explicit approval. Retention proposal: indexed paginated history, no automatic deletion during this phase; owner policy required before pruning notifications, never audit history.
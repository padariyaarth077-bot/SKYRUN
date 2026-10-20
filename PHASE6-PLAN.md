# Phase 6 — reliable chat and staff inbox

21 October 2026. Local implementation and approved isolated database/browser verification completed; see PHASE6-VERIFICATION.md for exact results and remaining production release gates. No hosted inspection, communication or production change was performed for this plan.

## Existing implementation to preserve

- src/components/chat-widget.tsx: public widget, saved visitor session, contact capture, human-support request and local failure feedback.
- src/lib/chat.functions.ts and chat.shared.ts: validated server calls, hashed visitor capability and preset FAQ responses. There is no verified external AI-provider integration here; do not describe preset responses as an AI assistant.
- src/routes/_authenticated/admin.chat-conversations.tsx: actual Supabase inbox, search, handoff filter, selected messages, takeover, replies, resolution and realtime subscriptions.
- supabase/migrations/20261015190000_chat_conversations.sql: session hash, assignment, handoff/read timestamps, allowed lifecycle states and server-called visitor operations.
- src/test/chat.functions.test.ts and chat.shared.test.ts: existing unit coverage. These do not establish hosted behavior or authenticated RLS coverage.

## Smallest useful implementation

1. Make the public widget receive saved staff replies without the visitor sending another message. Reuse its session-validated load operation; simple bounded polling while open is sufficient. Stop polling while closed and prevent overlapping requests. Preserve unsent text and distinguish a failed refresh from an empty conversation.
2. Complete the existing inbox: useful loading/error/empty states, stable selection, message ordering/paging, refresh fallback if realtime is unavailable, and protection against an older conversation response overwriting the newly selected one.
3. Replace fragile staff message/status writes with an authorized, tenant-scoped transaction where necessary. A saved reply and failed status update must not encourage duplicate resends. Use stable retry IDs and disable repeated actions while pending.
4. Make takeover reliable under concurrent staff actions. Validate authorized actor, current assignment and conversation state server-side. No preset bot replies after human takeover. Audit claim, reply and resolve events. Preserve the existing schema states; do not casually rename them.
5. Add honest unread/needs-attention indicators. Audit existing visitor_last_read_at semantics first; that field alone does not establish per-staff unread state. Recommend a shared team unread marker for the first version, rather than a new per-user receipts subsystem. Prepare any required additive migration for review before execution.
6. Preserve customer/lead linkage and collect only necessary contact/trip details. A chat is not a quote, accepted booking or payment. Do not introduce automatic pricing, emailing or booking creation.

## Verification before calling it ready

Test reconnect/history, staff-to-visitor replies, failed sends and safe retry, duplicate clicks, message ordering, takeover conflicts, suppression of bot replies during handoff, unread behavior, closing/resolving, anonymous capability isolation, staff roles and cross-tenant denial. Use isolated Supabase for real transaction/RLS/concurrency checks. Preserve Phase 1–5 regression coverage. Broader live tests remain separately deferred unless authorized.

## Deferred scope and decisions

No external AI subscription/provider, WhatsApp/SMS integration, automatic quotes, email campaigns, dispatch, payments, attachments or broad redesign. Security needed for chat belongs in this phase, rather than waiting for Phase 9. Prepared mutations permit trusted SUPER_ADMIN and scoped ADMIN/MANAGER/SUPPORT/DISPATCHER; conflicting lesser roles fail closed. Team unread is shared. New migrations and deployment require scoped approval; previous Phase 5 release approval is not Phase 6 production authorization.

## Fleet catalogue follow-up

The owner confirmed that supplied photos represent offered models, while quantities remain unknown. Local follow-up groups two Cadillac Escalade ESV photos into one catalogue entry (13 models/groups, 14 photos), retains the supplied shuttle/configuration group label, labels quantity/capacity as unrecorded and allows catalogue search. It creates no vehicle/category records or availability claims and supplies the view-only public /catalogue route. No database migration is needed for this presentation change. This follow-up is local only until separately deployed; the previously released version remains the 14-photo gallery.

Follow-up checks executed: focused phase5.test.tsx suite 23 passed; TypeScript noEmit passed; scoped ESLint check passed; production build passed with existing image/config warnings; git diff --check passed. No hosted connection, database write, publication or deployment occurred for this follow-up. Existing unrelated CLI metadata and artifacts were preserved.

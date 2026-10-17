# Deliverable A — Executive Summary

## Overall status

**PARTIAL; production readiness is UNVERIFIED.** This is a branded public website and a nascent staff console, not yet a complete Operations Center. Three admin areas read or mutate real Supabase data (dashboard, leads, customers/profile); most other console modules are explicit placeholders. A single server function persists public form submissions as customers and leads. No remote state was queried.

## Major blockers

1. **Target project mismatch:** local Supabase CLI config targets `xahvwghacqbapfrgazxh`; approved target is `cudisqrugjupstgdeqac` (the production migration comment). Applied migrations cannot safely be verified until project targeting is resolved.
2. **Remote migration status and credentials:** `.env` exists but was deliberately not inspected. No confirmed production connectivity/schema history. The production migration is present locally only.
3. **Business decisions:** quote pricing/validity, booking confirmation/lifecycle, driver assignment/availability, customer privacy/retention, and chatbot (scripted vs AI) behavior are not sufficiently specified to build safely.

## Major verified findings

- Admin route guard calls Supabase `getUser()` and checks staff role rows; migration policies scope records by business unit. Route secrecy is documented as supplementary.
- Public booking form does **not** create a `ride_requests` row. It serializes trip details into `leads.message`; source is `CONTACT_FORM`.
- Public chat widget is present and mounted on the homepage. It is a scripted four-step contact capture, not a conversation system. It persists a generic lead only after name, phone and email; messages/session are component state.
- Admin dashboard/leads and customers are backed by queries. Query errors are frequently ignored; lead reads are unpaginated and status updates ignore database errors.
- Sidebar modules for chat, ride requests, quotes, bookings, fleet, drivers, availability, customer history, services, service areas, analytics, team/roles, notifications, and audit log render “coming next” placeholders.
- Local migration defines the approved 14 core tables, expected FK order, helper-based role policies and explicit super-admin branches. Remote application and live RLS behavior are unknown.
- Recovery implementation contains an absolute redirect URL, recovery-event gate, password update, and sign-out. `npm test -- --reporter=dot`: 43/43 pass, but all relevant Supabase calls are mocked. The tests explicitly do not verify actual email delivery/token flow. No independent live recovery test was performed. Owner-reported manual success is not independently evidenced here.

## Critical risks

- Resolve wrong-project targeting before any migration command; otherwise future CLI operations could target the wrong project.
- `submitLead` uses service-role access without authentication/rate limiting. A honeypot field exists in validation but neither public caller supplies it. A public endpoint can create unbounded customer/lead rows, and simultaneous same-email submissions can race the customer uniqueness index.
- Customer and lead upserts/queries have incomplete error handling. Lead status update and activity insertion are separate operations, with ignored errors; UI may show success despite partial failure.
- Public trip form data has no structured ride row and no duplicate-submit guard. No quote/booking conversion is available.
- Console role gate is not granular by role: every allowed staff role receives the same UI. RLS is the actual data boundary and must be verified against deployed policies.

## Recommended next steps

1. Confirm correct Supabase project reference and establish safe read-only access to that project before any migration application discussion.
2. Review and approve the local production migration against the live schema (do not apply as part of this audit).
3. Harden public lead ingestion (rate limiting/idempotency/atomic customer matching) and make failures visible.
4. Implement structured ride-request creation and staff review before quotes/bookings.
5. Define quoting, booking, fleet/driver, role-permission, notifications, email, retention, and chatbot requirements.
6. Implement staff workflows in dependency order and add integration/security tests.

See [master checklist](master-checklist.md) and [verification record](verification-record.md).

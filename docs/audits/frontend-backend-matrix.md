# Deliverable C — Frontend-to-Backend Matrix and Journeys

## Public forms and server boundary

| Entry point / action | Handler | Backend / persistence | Permission and evidence | Status |
|---|---|---|---|---|
| Homepage booking/contact form (`BookingForm`, `src/components/skyrun-site.tsx`) | `submitLead` in `src/lib/leads.functions.ts` | Server function validates payload, service-role client finds customer by lowercased email or inserts one, inserts `leads`, then attempts activity insert. Ride fields are embedded in `subject/message`. | Anonymous caller; service role bypasses RLS. No auth, rate limit, idempotency, or verified email. Honeypot schema is optional but caller does not send it. Errors from activity insert are ignored. | **PARTIAL**: real persistence for customer+lead if configured; no ride row/email. |
| Contact page `/contact` | none | Static phone/email/address only | No contact form or message table | **NOT IMPLEMENTED** as submission flow |
| Chat widget (`src/components/chat-widget.tsx`) | local scripted steps, then `submitLead(source=CHATBOT)` | Only final generic lead persists. Transcript, open state, partial answers, identity linkage to conversation do not persist. | Anonymous server service role. Four steps capture free-form initial message, name, phone, email. No rate limit / privacy minimization. | **PARTIAL**, chatbot system **NOT IMPLEMENTED**; details in dedicated report. |
| Admin status/review/note (`src/routes/_authenticated/admin.leads.$id.tsx`) | direct Supabase update or `log_activity` RPC | `leads`, `activities` | Browser user token and RLS. Status update and activity are distinct requests; some errors ignored. | **PARTIAL** |
| Bulk lead status (`admin.leads.index.tsx`) | `setLeadStatus` in `src/lib/admin-data.ts` | per-lead update + RPC via Promise.all | RLS; ignores both result errors. | **PARTIAL** |
| Profile name (`admin.settings.tsx`) | direct Supabase upsert | `profiles` | `profiles_own` policy in migration; local save shows DB error if upsert returns one. | **PARTIAL** |

## Admin reads, filters, and controls

| UI | Query/action | Data and actual behavior | Status |
|---|---|---|---|
| Dashboard | `fetchLeads()` + activities query; profile upsert on mount | Real leads/activity; counts and filters computed client-side over unbounded fetched leads; activity query limit 8. Failures are swallowed by `fetchLeads` and activity handling. No date picker or refresh subscription. | **PARTIAL** |
| Lead list | `fetchLeads()`; search/status filter in memory | Joined customer fields, local search and status counts, no sorting/pagination. Error/loading handling incomplete. | **PARTIAL** |
| Customer list | direct `customers` select with `leads(id)` | Real data, local string filter, no database pagination or error indicator. | **PARTIAL** |
| Lead detail | selects lead/customer and activity; mutations as above | Real persistence if RLS/schema match. Loading vs missing/error is conflated. | **PARTIAL** |
| All generic module routes | static `MODULES` map | Columns/title only, no database calls or actions. | **NOT CONNECTED** |

## Journey trace

1. **Visitor submits a ride/contact request:** `BookingForm` packages name/email/phone plus trip info into generic lead fields → `submitLead` Zod validation → server imports `supabaseAdmin` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) → customer lookup/insert → lead insert → activity insert. Expected DB objects: `customers`, `leads`, `activities`; no `ride_requests`. No email/notification. Insertion errors from customer/lead throw generic errors, but activity insert error is ignored. Duplicate protection is absent; simultaneous customer creation can conflict with unique lower-email index. **PARTIAL**. Source paths above.
2. **Authorized staff reviews and follows up:** `_authenticated` layout calls `getUser()`, then selects allowed `user_roles`; RLS then protects leads/customers/activities. Staff dashboard/list/detail can read leads; status and note actions write via direct updates/RPC. Customer can be called/emailed using device links. No assigned queue, staff email send, or structured ride progression. **PARTIAL**.
3. **Visitor starts chatbot:** widget state holds local scripted transcript; after four steps invokes same `submitLead` as above with source `CHATBOT`. Only a lead is stored; no `conversations` or `conversation_messages` rows. Admin conversation module is placeholder. **NOT IMPLEMENTED** as persisted chatbot/conversation; **PARTIAL** lead capture.
4. **Staff creates/sends quote:** dashboard link routes to generic module placeholder. No quote insert/update/email code. Migration/type defines quotes; `quotes` requires ride-request and customer, but public request never creates a ride request. **NOT CONNECTED / BLOCKED**.
5. **Staff creates/updates booking:** dashboard link routes to placeholder; no booking mutation or notification. `bookings` schema/types exist. **NOT CONNECTED**.
6. **Staff receives notification and acts:** bell links to a static placeholder; no notification table, event, subscription, or email. **NOT IMPLEMENTED**.
7. **Staff searches customer/history:** customers page performs local search and shows count of linked leads; no customer detail/history or cross-entity history. RLS migration scopes rows; remote policy operation unknown. **PARTIAL**.
8. **Unauthorized access attempt:** protected layout denies no-session/invalid-user and users without allowed role (redirect/sign out). Individual table queries rely on RLS. Routes under `_authenticated` are protected by layout, not URL obscurity. Security is **PARTIAL / remote UNVERIFIED**; there are no role-specific UI permissions and live unauthorized behavior was not exercised.

## Backend boundary/configuration

- Browser Supabase client: `src/integrations/supabase/client.ts`, publishable key only, persisted/auto-refreshed session.
- Server public-ingest client: `src/integrations/supabase/client.server.ts` reads server-only service role key; `submitLead` imports it inside the server handler, which is an intentional browser secret boundary by source design. Production deployment bundling/runtime was not inspected.
- Auth middleware exists (`src/integrations/supabase/auth-middleware.ts`) but no usage was found in app operations; current route guard is browser-side `getUser()` and RLS remains essential.
- Types in `src/integrations/supabase/types.ts` describe the 14 approved tables; they do not prove deployed schema.
- No public form currently handles retry, idempotency key, transactional activity write, structured ride request, or email delivery.

# Deliverable B — Sidebar and Route Inventory

Private route parent: `src/routes/_authenticated/route.tsx`; page shell/sidebar: `src/components/admin-shell.tsx`; generic modules: `src/routes/_authenticated/admin.m.$module.tsx`. Module routes share `/admin/m/$module`. The sidebar has no role-based visibility filtering.

| Display / route | Component and source | Actions / expected source | Actual source | Status; evidence and missing work |
|---|---|---|---|---|
| Dashboard `/admin` | `Dashboard`, `src/routes/_authenticated/admin.index.tsx` | KPIs, lead review, recent activity, quick links; leads + activities | Supabase `leads`, `activities`; also upserts own profile | **PARTIAL (High):** live query code; all leads fetched into browser; errors ignored, no date filter/stale refresh; Quick quote/booking links lead to placeholders. |
| All Leads `/admin/leads` | `LeadsPage`, `src/routes/_authenticated/admin.leads.index.tsx` | status tabs/counts, text filter, selection, mark genuine/spam, detail | Supabase leads joined to customers; update + `log_activity` | **PARTIAL (High):** backend connected; in-memory filtering, no pagination/sort, errors/loading on failures weak, bulk writes concurrent/non-transactional. |
| Needs Review `/admin/leads?status=NEW` | Same as above | filtered review queue | Same query then local filtering | **PARTIAL (High):** status filter is real client behavior, not server-side. |
| Contact Messages `/admin/m/contact-messages` | `ModulePage`, `src/routes/_authenticated/admin.m.$module.tsx` | Intended message list/review | None; static module config | **NOT CONNECTED (High):** explicit coming-next placeholder; contact form creates leads, not message table. |
| Ride Enquiries `/admin/m/ride-enquiries` | Same | Intended ride enquiry list | None | **NOT CONNECTED (High):** placeholder; booking form creates generic lead only. |
| Chat Conversations `/admin/m/chat-conversations` | Same | Intended live conversation list | None | **NOT CONNECTED (High):** placeholder; no persisted conversations/messages. |
| Ride Requests `/admin/m/ride-requests` | Same | Intended request list | None | **NOT CONNECTED (High):** schema/type exists, no form mutation/page query. |
| Quotes `/admin/m/quotes` | Same | Intended quote CRUD/send | None | **NOT CONNECTED (High):** quote schema exists, no UI/backend workflow. |
| Bookings `/admin/m/bookings` | Same | Intended schedule/lifecycle | None | **NOT CONNECTED (High):** booking schema exists, no UI/backend workflow. |
| Vehicles `/admin/m/vehicles` | Same | Intended fleet CRUD | None | **NOT CONNECTED (High):** schema and public RLS design exist, no query/page. |
| Vehicle Categories `/admin/m/vehicle-categories` | Same | Intended category CRUD | None | **NOT CONNECTED (High):** schema exists. |
| Drivers `/admin/m/drivers` | Same | Intended chauffeur records | None; no driver table in 14-table schema | **BLOCKED (High):** no approved driver schema/table. |
| Availability `/admin/m/availability` | Same | Intended scheduling | None; no availability table | **BLOCKED (High):** needs model/policy decision. |
| Customers `/admin/customers` | `Customers`, `src/routes/_authenticated/admin.customers.tsx` | client search; email/phone; lead counts | Supabase customers with related leads | **PARTIAL (High):** records/query work in source, but no detail/history navigation, pagination, query error/loading states, or edit. |
| Customer History `/admin/m/customer-history` | `ModulePage` | Intended timeline and related records | None | **NOT CONNECTED (High):** placeholder. |
| Services `/admin/m/services` | `ModulePage` | Intended editable service content | Static public arrays in `src/components/skyrun-site.tsx`; no services table (intentionally not approved) | **NOT CONNECTED (High):** admin is placeholder; public content is code-defined. Do not add `services` or `service_id` without approval. |
| Service Areas `/admin/m/service-areas` | `ModulePage` | Intended area management | Static page/content, no table | **NOT CONNECTED (High):** placeholder. |
| Analytics `/admin/m/analytics` | `ModulePage` | Intended reports | None | **NOT CONNECTED (High):** placeholder. |
| Team & Roles `/admin/m/team` | `ModulePage` | Intended staff/role administration | Auth role read only in login/guard/settings; no team CRUD | **NOT CONNECTED (High):** role schema exists but no management UI. |
| Notifications `/admin/m/notifications` | `ModulePage` | Intended persisted alerts/read state | None | **NOT CONNECTED (High):** bell links here; no notification table or event integration. |
| Audit Log `/admin/m/audit-log` | `ModulePage` | Intended activity list | `activities` queried only on dashboard and lead detail | **NOT CONNECTED (High):** no audit-log screen. |
| Settings `/admin/settings` | `Settings`, `src/routes/_authenticated/admin.settings.tsx` | view email/roles; edit full name | `profiles` select/upsert, `user_roles` select | **PARTIAL (High):** profile edit connects; errors on initial reads ignored; role assignment not editable; authorization relies on profile RLS. |
| Lead detail `/admin/leads/$id` | `LeadDetail`, `src/routes/_authenticated/admin.leads.$id.tsx` | status change, spam/genuine review, add note, contact | Supabase leads, customers, activities, `log_activity` RPC | **PARTIAL (High):** persisted actions; regular status change ignores errors and logs separately; record load failure appears as indefinite Loading. |
| Login `/j1s30MRp_geRZtdPP860Rw` | login index `src/routes/j1s30MRp_geRZtdPP860Rw.index.tsx` | sign in, password visibility, recovery link | Supabase Auth + `user_roles` | **PARTIAL (High):** real auth calls and role check; role-query errors treated as no roles; session precheck uses cached `getSession`. |
| Recovery `/j1s30MRp_geRZtdPP860Rw/forgot-password` | `src/routes/j1s30MRp_geRZtdPP860Rw.forgot-password.tsx` | request reset email | Supabase `resetPasswordForEmail` | **PARTIAL (High):** flow in source, mocked tests pass; live email/config not independently checked. |
| Recovery callback `/3ZiG4lFP04tFD1Iv4Vv97g/auth/callback` | `src/routes/3ZiG4lFP04tFD1Iv4Vv97g.auth.callback.tsx` | consume recovery event, validate/set password, sign out | Supabase Auth | **PARTIAL (High):** implementation exists and recovery tests pass, mocked only. |

## Public routes

| Route | Source | Actual behavior / status |
|---|---|---|
| `/` | `src/routes/index.tsx`, `src/components/skyrun-site.tsx` | Static marketing page; booking form and chatbot widget mounted (**PARTIAL** journey). |
| `/book` | `src/routes/book.tsx`, `src/components/inner-page.tsx`, shared `BookingForm` | Trip form sends to `submitLead`; no `ride_requests` record (**PARTIAL**). |
| `/contact` | `src/routes/contact.tsx` | Static contact details; no contact form (**NOT IMPLEMENTED** as message form). |
| `/fleet`, `/services`, `/service-areas`, `/airport*`, `/corporate*`, `/occasions`, `/special-occasions`, `/about`, `/faq`, legal routes | Corresponding `src/routes/*.tsx`, mostly `InnerPage` | Static/code-defined public content. Fleet/services are not database-driven. Existing redirects are route behavior, not back-office features. |

## Shared shell controls

Search in `src/components/admin-shell.tsx` navigates to leads with `q`; the leads page validates and applies that query. The notification bell is only a link to the placeholder. Sign out calls Supabase Auth and redirects; no error state. Website link returns to `/`. Role labels do not change available sidebar items.

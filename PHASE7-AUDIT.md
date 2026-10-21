# Phase 7 implementation matrix — 21 October 2026

Audited before code edits. Branch main, HEAD 1729cc9. Existing unrelated CLI metadata and untracked screenshots/exports are preserved. Inspected route tree/sidebar/AdminShell, all admin list/detail/settings routes, auth guard, generated types, admin-data, quote/delivery/acceptance and Phase 4–6 RPCs, and complete migration inventory (13 files). Phase 6 release/local evidence reviewed; real Phase 3 delivery/acceptance remains UNVERIFIED. No hosted inspection authorized or performed for Phase 7.

| Sidebar module | Audit status and evidence | Phase 7 action |
|---|---|---|
| Dashboard | WORKING BUT NEEDS UI POLISH; real scoped leads/counts, query errors explicit; fetches all leads | Shared styling; retain tested metrics and terminology |
| All Leads / Needs Review | WORKING BUT NEEDS UI POLISH; real leads, search/status/source and review actions | Preserve semantics and row navigation |
| Contact Messages / Ride Enquiries | WORKING BUT NEEDS UI POLISH; CONTACT_FORM/RIDE_ENQUIRY separated | Shared list styling |
| Chat | WORKING BUT NEEDS UI POLISH; Phase 6 controlled RPCs and shared unread | Preserve polling/ownership/capability isolation |
| Ride Requests / Quotes / Bookings | WORKING BUT NEEDS UI POLISH; real lists/details/links, safe quote/acceptance/deposit workflows | Finance entry points and related-document links |
| Vehicles / Categories | VERIFIED WORKING in prior Phase 6 live read-only evidence; 13 model groups / 14 photos; no actual inventory | Design reference, no fabricated counts |
| Drivers / Availability | BLOCKED BY SCHEMA and OUT OF PHASE 7 SCOPE; explicit unavailable pages | Honest planned-state presentation, no dispatch implementation |
| Customers | WORKING BUT NEEDS UI POLISH; actual records, duplicate suggestions, scoped history | Financial-history navigation |
| Customer History | PARTIALLY WORKING; redirects to Customers; history exists on selected profile | Preserve single source of truth; explain entry point |
| Services / Service Areas | WORKING BUT NEEDS UI POLISH; Phase 5 real configuration and controlled save | Shared forms/cards |
| Analytics | PLACEHOLDER; no authoritative query | Replace with Reports, preserve old URL redirect |
| Team & Roles | PARTIALLY WORKING; real read-only profile/role queries, no role mutation UI; result cap possible | Preserve trusted role architecture; do not build Phase 9 |
| Notifications | PLACEHOLDER / OUT OF PHASE 7 SCOPE; no persistence | Explicit Phase 8 state; no fake bell count |
| Audit Log | PARTIALLY WORKING; latest 100 activities only, no entity ID links/filtering | Server-filtered paged audit report and safe entity links |
| Settings | PARTIALLY WORKING; personal profile only, raw save error/no pending guard | Preserve profile; add scoped nonsecret document business profile |
| Invoices | BLOCKED BY SCHEMA/BUSINESS DECISION; no invoice model/numbering/tax policy | Small audited booking-linked DRAFT architecture; no issuance |
| Receipts | BLOCKED BY BUSINESS DECISION for official documents; Phase 4 receipt evidence is not an issued receipt | Verified unreversed evidence preview/print; no official receipt issuance |

## Confirmed relationships

customers -> leads/ride_requests/quotes/bookings by customer_id + business_unit_id. leads -> ride_requests via lead_id; quotes -> ride_requests/customer; accepted quote -> exactly one booking via existing acceptance RPC; bookings -> quote/customer/request; booking_deposit_receipts -> booking/BU, verification actor/time; reversals -> receipt/booking/BU. Activities use entity_type/entity_id + BU; no arbitrary FK invention. No invoice/issued receipt/payment provider/settings tables exist. service_configuration is internal only.

## Plan and boundary

1. Reuse shared shell/panels and scoped admin-only CSS for consistent headers/cards/forms/tables, status accents, focus and mobile overflow. Keep comparison tables.
2. Add database-authorized paged reports/CSV, exact per-currency deposit summaries, safe entity links and legacy analytics redirect. No unbounded production exports.
3. Prepare minimal additive document profile + invoice draft migration, strict existing manager/administrator scope, controlled transactional/audited saves and immutable booking/customer snapshot. Reserve authoritative event metadata in existing logger. PENDING APPROVAL; no migration execution until scoped local approval.
4. Add real draft list/detail, verified-evidence preview/print and business profile settings. No official invoice/receipt numbers, issuance or tax assumptions. Owner explicitly chose to skip numbering decisions for now.
5. Add customer/booking finance links, report/audit navigation, test safe source and document boundaries, run regressions/build/type/lint. Prepare guarded isolated integration/browser checks; execute only after local approval. No production operations, deployment, messages, installs or Phase 8 work.

## Source implementation result

Shared shell/panels/forms/tables/status presentation polished; operational tables retained. Reports replace Analytics at its legacy URL; audit shares the scoped report contract. Invoice Drafts and Payment Previews are real source implementations awaiting the additive database proposal. Customer History duplicate sidebar entry removed while its legacy redirect is preserved. Official numbering/issuance remains deferred at the owner's instruction. See PHASE7-VERIFICATION.md for source changes, actual checks, unexecuted database/browser/PDF checks and approval boundary.

## Local verification update — 21 October 2026
Owner-approved isolated migration and corrected save function are now tested: eight Phase 7 scenarios and 76 earlier workflow regressions passed; 409 unit/component tests passed. Draft/report/evidence-preview local scope verified. Official numbering/issuance remains deferred, production untouched. See consolidated A–T report in PHASE7-VERIFICATION.md; earlier pending-test statements above are historical.

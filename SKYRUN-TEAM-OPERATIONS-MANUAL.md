# Skyrun Limo — team operations manual

Version: 26 October 2026. For daily use of the current admin system. The instructions below describe available controls; access depends on your actual role and business unit. Phase 9 security changes are pending release. Ask the owner if a control is unavailable; never work around permissions.

## 1. Start here

Website: https://skyrun.padariyaarth077.workers.dev

Admin: https://skyrun.padariyaarth077.workers.dev/admin

If redirected, sign in using your own staff account. The current private login entry is https://skyrun.padariyaarth077.workers.dev/j1s30MRp_geRZtdPP860Rw . Knowing that URL does not grant access. Do not share accounts, passwords, recovery links or customer quote links.

At the start of a shift:

1. Open Dashboard and check Needs Review, recent leads and notifications.
2. Open Chat Conversations and check handoff/unread items.
3. Review pending bookings and outstanding deposit requirements within your business unit.
4. If you want alerts, open Settings, initialize/test notification sound with a click and save volume/preferences. Browser/device restrictions can suppress audio; keep checking visual notifications.

Sign out at the end of a shift, especially on shared computers. Lock your computer when leaving it.

## 2. Who handles what

| Team responsibility | Usual work |
|---|---|
| SUPER_ADMIN / owner | Team access and business-unit oversight; authorized management actions |
| ADMIN / MANAGER | Booking/deposit operations, customer/service/fleet configuration, financial drafts/settings |
| SUPPORT / DISPATCHER | Scoped enquiry review and chat operations; no Phase 4 booking/deposit mutations |
| CONTENT_MANAGER | Assigned read/content responsibilities; no deposit/booking mutations or chat takeover |

Existing quote policy currently permits scoped staff quote actions more broadly than management-only deposit actions. Follow the owner's assignment rules even when a button is visible. The system does not currently implement a new dispatch/driver allocation workflow; the DISPATCHER role name does not imply it does.

## 3. Understand the records

| Record | What it means |
|---|---|
| Customer | Contact profile and linked history |
| Lead | Incoming enquiry/message for review |
| Ride request | Structured trip details; not a confirmed booking |
| Quote draft | Proposed price/currency/expiry; not automatically sent |
| Sent / delivered quote | Delivery evidence, not customer acceptance |
| Accepted quote | Customer accepted the saved version |
| PENDING booking | Created from acceptance; still needs staff review/deposit condition |
| CONFIRMED booking | Staff completed the controlled confirmation step |
| Activity | Saved note or authoritative audit of an action |

Never treat enquiry receipt, a quote draft, provider acceptance or an unread notification as a confirmed ride.

## 4. Receive and review an enquiry

Customer steps on the website:

1. Enter name, phone, email, service, pickup/drop-off, travel date/time, passengers and supported preferences/notes.
2. Click Send Ride Request once and wait. Success provides an SR reference and says awaiting review. It does not guarantee availability.
3. On failure retain the entered details and retry the same logical submission; do not repeatedly start new enquiries.

Staff steps:

1. Open Needs Review, All Leads or Ride Enquiries. Search by reference/customer details and use filters.
2. Open the reference link. On supported lead/dashboard rows you may double-click noninteractive row text. Buttons/checkboxes have their own actions.
3. Read the message and linked customer/request. Check dates, locations, passengers and contact details.
4. Mark Genuine for an actual relevant enquiry, or Spam for an unwanted submission. Review the confirmation before saving. Use REVIEWING/CONTACTED/QUALIFIED/LOST only when they accurately describe your progress.
5. Add a useful Activity note describing clarification or follow-up. Wait for it to appear in the timeline. Blank notes are not valid; failed saves should preserve text.

Genuine review does not itself confirm the ride or create payment evidence. Contact Messages remains separate from Ride Enquiries; do not turn a generic message into a booking without the appropriate trip/quote workflow.

## 5. Prepare a quote

1. Open a Genuine lead with an eligible linked ride request.
2. Choose Prepare quote draft.
3. Verify the linked customer and trip, including date/time, passengers, return/flight/hourly details where present.
4. Enter the explicitly agreed price and three-letter currency, future expiry and quote notes. Do not invent taxes, gratuities, deposit percentages or policies.
5. Save draft and verify its persisted amount/currency/expiry. A saved draft has not been sent.
6. Edit only an eligible unfrozen draft. If another user changed it, refresh and review rather than overwriting stale data. Delivery/acceptance freezes the saved version.

Use dates carefully: quote expiry input uses your browser's local time. Trip fields display their stored date/time. Report timestamp boundaries are UTC. Do not silently reinterpret customer pickup time; confirm ambiguous timezone requirements with the owner/customer.

## 6. Send and monitor the quote email

**Current production quote mode is TEST MODE:** only padariyaarth077@gmail.com is allowed. This manual does not authorize enabling all-customer sending. General booking email automation is disabled separately.

When an approved mode/recipient is available:

1. Save all draft changes first.
2. In Delivery and acceptance, review the exact recipient, saved trip, amount, currency and expiry.
3. Tick the review checkbox, then click Send Quote once.
4. Wait for the saved result; use Refresh delivery status if necessary.

| Displayed result | Team action |
|---|---|
| Not sent / prepared | Do not tell customer it was delivered |
| In progress | Wait; do not create a replacement |
| Provider accepted | Resend accepted submission; inbox delivery not yet proven |
| Delivered | Recipient mail-server delivery verified; customer still needs to accept |
| Uncertain | Ask administrator to inspect provider/runtime evidence; do not blindly resend |
| Failed / revoked | Investigate; do not claim it can still be accepted |

Only use Retry same delivery when the application and administrator permit it. It retains the saved delivery/body and idempotency key. Old deliveries can require reconciliation. Creating a new quote to bypass uncertainty can send duplicates.

Customer quote links are private, expiring and tied to the saved quote. Do not paste them into team chat, public screenshots or reports. Staff must not impersonate a customer accepting a real quote.

## 7. Customer acceptance and pending booking

1. Customer opens the email review link, checks the saved offer and accepts if they agree.
2. Staff refreshes the quote and verifies Accepted plus its activity.
3. Use View booking, deposits and financial drafts.
4. Verify the PENDING booking has the correct customer, accepted quote, amount/currency and trip snapshot.
5. Do not manually create another booking because the page is slow. If relationships look wrong or two bookings are suspected, stop and report the references.

Acceptance does not mean a driver is assigned or a deposit received. Request data may retain its enquiry status; use the linked quote and booking for their actual lifecycle.

## 8. Deposits received outside the application

The application records and verifies evidence of external payments. It does not collect money or independently check a bank account. Only authorized management performs these actions.

### Set the requirement

1. Open the PENDING booking → Deposit and booking operations.
2. Select Set explicit deposit requirement.
3. Enter the owner-authorized exact amount in the booking currency.
4. Save and verify required amount/audit. Missing is different from zero.

Zero must be a deliberate authorized decision, never a workaround for a missing payment. Requirements lock after receipt evidence exists; confirmed bookings do not allow silent requirement changes. Escalate corrections rather than bypassing the controls.

### Record and verify a receipt

1. Select Record unverified receipt.
2. Enter the exact positive amount, external transaction reference and received date/time. Currency comes from the booking.
3. Save; it is still unverified and does not satisfy the requirement yet.
4. Verify funds through your approved external process.
5. Select Verify funds received externally, choose the receipt and give the required explicit attestation only if true. Save and verify the actor/time.

Multiple partial receipts can accumulate. Only verified, unreversed receipts in the booking currency count. Do not record card details, bank credentials or public receipt URLs. A duplicate reference should be investigated, not renamed to bypass detection.

### Reverse incorrect evidence

Use Reverse verified receipt, select the correct receipt, enter a clear reason and save. Preserve the original evidence. This is not a refund. A reversal after confirmation does not automatically cancel the booking; it can create a visible payment exception requiring management review.

## 9. Confirm, cancel or complete a booking

**Confirm:** verify trip/customer/quote, set a requirement and satisfy it, select Confirm booking and save. Missing requirement or insufficient eligible receipts blocks confirmation. Check CONFIRMED and its audit before telling the team it is confirmed.

**Cancel:** only PENDING/CONFIRMED in this workflow. Select Cancel booking, enter a meaningful nonblank reason, save, then verify CANCELLED, actor, timestamp and reason. Cancellation does not issue a refund or erase history.

**Complete:** only authorized staff, only CONFIRMED and only after the actual trip occurred. Select Mark trip completed, give the required truthful attestation and save. Never mark a future or unperformed trip completed to tidy a list.

CANCELLED and COMPLETED are terminal in this phase. Legacy ASSIGNED/DRIVER_ASSIGNED/IN_PROGRESS/NO_SHOW states do not get new transitions here. Do not use direct database edits to reopen a booking.

## 10. Customers, services and fleet

Customers: search by supported name/email/phone fields, open the profile and inspect linked leads/requests/quotes/bookings. Management may edit existing contact details; saved quote/booking snapshots are preserved. Review duplicate suggestions manually; the app does not automatically merge records.

Services/Service Areas: management selects the correct business unit, creates/edits/deactivates supported configuration and checks persistence. These controls do not invent pricing or automatically rewrite the public website.

Vehicles/Vehicle Categories: supplied photos form13 model groups with 14 reference images. Current verified saved vehicle count is 0. Images are not physical inventory or proof of availability. Enter/assign only confirmed existing fleet details; obtain actual quantities and passenger/luggage capacities from the owner. Do not infer them from a photo. Drivers/Availability remain outside the completed dispatch scope.

Catalogue/WhatsApp: View public catalogue or copy its link. Open WhatsApp prepares a draft; staff reviews the destination and text and sends manually if authorized. Opening it does not mean anything was sent or delivered. Do not send a customer quote acceptance link as a public catalogue link.

## 11. Chat inbox and human handoff

1. Open Chat Conversations and filter/search unread or handoff items.
2. Select the conversation and read history before replying. Team unread markers are shared.
3. Choose Take over. Confirm Assigned to you / human-handling state.
4. Enter Reply to visitor and Send reply once. Check the saved message; visitor receives it through the website chat.
5. Resolve the conversation when genuinely finished. Preset automated replies pause during human handoff.

Do not promise a booking, price, payment or driver assignment solely through chat. Use the authoritative quote/booking screens. WhatsApp opens separately; its replies are not automatically imported into this inbox.

## 12. Notifications and email automation

Open Notifications, filter by event/severity/date and follow Open related record. Mark read affects your notification state, not the booking or the team's chat unread marker. Check saved state after refresh.

Updates poll about every5seconds while visible. This is not guaranteed background push. Sound requires a browser gesture/initialization and saved preferences; visual history remains the fallback.

Communication delivery distinguishes queued, attempted, provider accepted, delivered and failure. **General automation is disabled.** Queued confirmation/cancellation messages are not sent emails. Do not click queue retries or enable a processor without owner approval. Before activation the administrator must review existing queued synthetic/stale messages; the current test left queued confirmation and cancellation entries. Do not delete audit evidence to hide them.

## 13. Reports, invoice drafts and payment previews

Reports: select the report, date range, search/status/source and supported business unit; wait for results. Follow references to check source records. Booking values are not received money. Report date definitions and UTC boundaries are shown in the page. Export CSV respects scope and has a 10,000-row cap; store exports securely.

Invoice drafts: open from a booking, enter an accurate description, save and verify the copied amount/currency and DRAFT—NOT ISSUED watermark. Print/Save PDF is a preview, not issuance or delivery. Unknown business name/address remain explicitly unconfigured. No official numbering, tax or due-date rules should be invented.

Payment previews: use eligible verified evidence and review reversals/current state first. Do not label unverified/reversed evidence an official receipt. No payment collection, official receipt issuance or accounting integration is implemented by a preview.

Official invoices/receipts remain deferred until the owner approves numbering, legal details, tax/terms and issuance policy. Never send a draft as an issued invoice.

## 14. Failures and escalation

| Problem | Safe response |
|---|---|
| Form fails | Keep entries, wait and retry same logical enquiry; record message/time |
| Save fails or stale-record error | Preserve text; refresh saved state before deciding whether retry is needed |
| Quote uncertain | Refresh delivery status; administrator reconciles same delivery; no blind new send |
| Access denied | Confirm your own account/business unit; ask owner; do not borrow an admin login |
| Deposit insufficient | Check explicit requirement, receipt verification/currency/reversals; no fake receipt/zero override |
| Blank/error screen | Record route/reference/time and safe error text; retry once, then escalate |
| No sound | Initialize/test in Settings; check mute/volume/browser; keep reading notifications |
| Missing image/inventory | Distinguish catalogue photos from actual saved fleet; report missing confirmed data |

Send support only the reference, screen name, timestamp/timezone, action and safe error text. Never include passwords, API keys, JWTs, recovery tokens, private acceptance links or bank/card details. Avoid screenshots of unrelated customer data.

## 15. Shift handover checklist

List enquiries awaiting clarification, unsent/uncertain quotes, pending bookings/deposit shortfalls, payment exceptions and unresolved handoff conversations. Include record references and next responsible person. Do not report queued email as delivered, drafts as issued or unassigned trips as dispatched.

The 26 October synthetic booking BK-e95764ab3963424d949fc21a93e1ea6e is CANCELLED after workflow testing. Its draft and evidence are TEST ONLY. Do not operate the ride, collect money, send its queued automation messages or delete its audit.

## 16. Release and readiness notes for the owner

Real quote delivery and customer acceptance→pending booking→explicit-zero confirmation/cancellation were verified live 26 October. Positive-payment verification/reversal and completed-trip paths retain isolated-test evidence, not live certification. Phase 9 security changes are still local; today's hosted preflight is read-only. General email automation, official issuance, payment gateway and dispatch are not enabled by this manual. Full role/device/accessibility/load/recovery QA remains.

Any migration, secret/settings change, deployment or automation activation needs the applicable separate approval. Team instructions do not grant technical privileges. See PHASE9-HOSTED-COMPATIBILITY-PREFLIGHT.md and LIVE-E2E-20261026.md for evidence and remaining gates.

# Phase 4 approved hosted release and live verification

Date: 19 October 2026. Status: RELEASED; end-to-end live verification BLOCKED by unconfirmed email delivery. Phase 3 LIVE VERIFICATION remains UNVERIFIED.

## Approved release

Owner approved the two named hosted migrations, GitHub publication and Worker deployment, plus one labelled test quote email to the owner's approved recipient and synthetic booking verification. No real payment, ride, dispatch, refund or deletion was authorized or performed.

Verified target: cudisqrugjupstgdeqac. Authenticated Supabase Management API GET established target. POST /database/query applied only the following reviewed files in order at 10:42 UTC; each contains its own BEGIN/COMMIT. No automatic db push, project relink, reset or ledger repair occurred.

| Migration | SHA256 | Result |
|---|---|---|
| 20261019080000_phase4_authorization_hardening.sql | ACC56E31EB4AA0438AF2ADB2C87472DDC540C461A23DB5A5002FCD5112FD0172 | Applied |
| 20261019090000_phase4_booking_deposits.sql | 69EDD0B0F66B8FBABDD5F3171CB50C69AE10C0B8EEBAECB5DDD708E06AAD2692 | Applied |

Ten read-only postflight metadata checks passed: deposit column/RPC present, receipt RLS enabled, unsafe membership role policy removed, authenticated booking UPDATE/TRUNCATE and activity TRUNCATE denied, anonymous logger EXECUTE denied, direct receipt INSERT denied for authenticated and service_role. This does not represent adversarial production mutation testing.

Published commit 9e11e84 to origin/main. Executed deployment:

`node <existing-cached-wrangler>/bin/wrangler.js deploy --config .output/server/wrangler.json --name skyrun --compatibility-date 2026-10-17 --keep-vars`

Exit 0. Worker version 8bf14ff7-464b-4022-8f0d-9e056669b181. Live origin https://skyrun.padariyaarth077.workers.dev. Existing eight secret names remain present; no values were read or printed. No secret changes were made.

## Actual visible live browser checks

- Authenticated owner dashboard loaded successfully.
- Public form created labelled enquiry SR-ec9e05803d1940c9af521deb531771cf. Reusing an existing synthetic phone correctly matched the existing test customer, whose saved email differs from the approved recipient. No quote email was attempted for this record, and that customer was not modified.
- A second labelled enquiry with a different synthetic phone created the intended test customer: lead c43abcf7-e536-4b56-96eb-1e5e16052dd8; request 82cd975f-3e1f-4cd4-b94b-13836992f760. Both synthetic enquiries remain; no data was deleted.
- Public confirmation accurately stated awaiting review, not confirmed booking, and cleared submitted fields.
- Staff marked the intended test lead Genuine using the review confirmation, then saved quote 20e4cb44-3029-41ae-8a4f-9618b432522f at USD 125.50, expiry 20 October 2026 16:30 Asia/Calcutta. Trip and quote notes explicitly state TEST ONLY, no real ride/payment/dispatch.
- Saved draft displayed not sent, test mode, exact approved recipient, and disabled Send Quote until staff review checkbox selected.
- Exactly one Send Quote action was invoked. The persisted result is UNCERTAIN, provider_email_id absent, quote still DRAFT, lease absent, and no provider delivery events associated. This is an attempted email submission, NOT evidence that an email was actually sent/delivered. No blind retry or replacement delivery was attempted.
- Refresh preserved the honest uncertain outcome and frozen quote snapshot. The UI did not mark Sent, Accepted or booked.
- Resend dashboard requires owner login; an open Codex browser tab is left at its login screen. Owner asked to sign in and report whether the email arrived, without sharing credentials or a private acceptance link.

## Not run live

Customer acceptance, booking creation, zero-deposit requirement, confirmation/completion and live booking audit checks remain pending because delivery/acceptance was not verified. No booking or deposit record was fabricated or inserted to bypass acceptance. Positive receipt/reversal, concurrency, rollback and authorization behavior were tested in the isolated database, not by mutating real production financial evidence. See PHASE4-VERIFICATION.md for executed local regression commands/results.

## Next action

Owner signs into Resend in Codex browser. Inspect the existing delivery/provider error before considering retry of the SAME delivery. Resolve provider configuration if required with explicit scoped approval. After verified delivery, owner opens the private email acceptance link; then verify exactly one PENDING booking and the approved explicit zero-deposit staff workflow. Do not claim Phase 3 live-verified or Phase 4 end-to-end complete until those checks execute.
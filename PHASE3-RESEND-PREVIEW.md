# Resend quote-email preparation

The owner reports that skyrunlimo.com is verified in Resend and RESEND_API_KEY has been added as a Cloudflare Worker secret. These settings have not been read or independently verified. No secret was requested or retrieved. No email has been sent and nothing has been deployed.

## Prepared source

src/lib/quote-email.server.ts uses TanStack createServerOnlyFn and the standard fetch API, with no dependency installation. It submits plain text to the fixed Resend HTTPS endpoint, fixed sender/reply-to support@skyrunlimo.com, a stable delivery UUID as the provider idempotency key, a 15-second timeout and redirects disabled. It validates inputs and returns provider_accepted only after a valid successful provider response containing an email UUID. Provider acceptance does not prove inbox delivery. Errors omit provider responses and credentials; timeouts explicitly require reconciliation before retrying.

There is deliberately no public sending endpoint or Send button yet. This transport must receive immutable data from an authorized, database-backed delivery workflow; it must not accept arbitrary browser-supplied recipients/prices. It is currently imported only by mocked tests. The Cloudflare secret alone does not enable delivery.

## Proposed plain-text content for owner review

From: Skyrun Limo <support@skyrunlimo.com>

Reply-To: support@skyrunlimo.com

Subject: Your Skyrun Limo quote — [quote reference]

    SKYRUN LIMO
    Quote reference: [quote reference]

    Pickup: [pickup]
    Drop-off: [drop-off]
    Travel date: [date]
    Pickup time: [time]
    Quoted amount: [currency] [amount]
    Valid until: [explicit expiry]

    This quote is not a confirmed booking.
    For questions, reply to support@skyrunlimo.com.

No invented taxes, policies or acceptance link are included. Once a secure acceptance design is approved and implemented, this preview needs its verified link and explicit acceptance instructions before approval for customer use.

## Required next implementation

Approve a single-purpose, expiring quote acceptance link delivered to the customer's stored, staff-checked email, or select authenticated customer accounts instead. A quote UUID alone cannot authorize acceptance. This decision precedes token schema and issuance code.

Prepare a separate migration for immutable quote/trip versions and delivery attempts. Staff must explicitly review recipient, content and trip before starting delivery; quote editing must freeze while delivery is pending or ambiguous. Persist the exact recipient/body/version and delivery UUID before the provider request; retry that same payload/key. Resend retains idempotency keys for 24 hours: after that window, an ambiguous attempt must be reconciled rather than blindly resent. Store provider email ID; distinguish pending, provider acceptance, delivery, failure/bounce and ambiguous outcomes. Define SENT precisely and never set it solely from a click. Signed, replay-safe provider events are needed to assert actual delivery.

Acceptance must bind to an immutable version, expiry and revocation, with only token hashes persisted; acceptance and creation of exactly one linked booking require transactional locking and uniqueness. No booking confirmation/payment/dispatch policy is inferred. Prepare exact objects, grants, compatibility, rollback and local tests for owner review before applying any new migration. The previous approval covers only the already-tested draft migration, not these future objects.

## Evidence and limitations

Nine mocked transport tests passed: fixed sender/reply-to, stable retry payload/key, provider acceptance distinction, absent secret, HTTP/network/malformed response failures and malformed inputs rejected before network access. These tests make no real Resend calls and prove neither domain verification nor production secret availability/delivery. Existing local database/browser results concern draft saving only.

Regression commands: `npm test -- --maxWorkers=1` passed 245 tests across 14 files (phase3-resend-regression.log); `node node_modules/typescript/bin/tsc --noEmit` passed after fixing two test-only undefined-array checks (phase3-resend-typecheck.log); `npm run lint` passed with nine existing Fast Refresh warnings (phase3-resend-lint.log); `npm run build` passed (phase3-resend-build.log). Build preceded the final test-only guard correction; application source did not change afterward. Focused tests were rerun after that correction. No integration/database/browser tests were rerun for this unconnected transport; no migration, production access or deployment was performed.

References: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/emails/idempotency-keys.

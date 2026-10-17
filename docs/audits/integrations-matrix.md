# Deliverable F — Email, Notifications, and Real-Time Matrix

| Event/trigger | Data persisted | Intended recipient | Mechanism/current implementation | Configuration/retry/dedup/security | Status |
|---|---|---|---|---|---|
| Password reset request | Auth reset request managed by Supabase | Admin who entered email | Browser `resetPasswordForEmail` with `window.location.origin + AUTH_CALLBACK_PATH` | Requires correct Supabase auth URL allowlist and email provider. Neutral success prevents user enumeration; only literal “rate limit” gets specific handling. No application retry. Test mocked only. | **PARTIAL / live delivery UNVERIFIED** |
| Password set | Supabase Auth password update | Admin user | Callback waits for `PASSWORD_RECOVERY`, calls `updateUser`, signs out | Depends on Supabase implicit recovery token/session and callback redirect config. Tests inspect mocked contracts/state; no real flow confirmed by this audit. | **PARTIAL** |
| Contact/ride form submit | `customers`, `leads`, attempted `activities` | Skyrun staff | Server `submitLead`; no email provider, database trigger, webhook, or notification dispatch found | Service role required server-side. Activity failure ignored; no retry/idempotency; no recipient config. | **PARTIAL persistence; email NOT IMPLEMENTED** |
| Chat completion | `customers`, `leads` only | Skyrun staff | Same `submitLead`; no conversation alert or staff inbox | No rate limit, persistence of transcript or notification. | **PARTIAL lead capture; conversation notification NOT IMPLEMENTED** |
| Lead status/note | `leads`, `activities` through update/RPC | Staff | Direct authenticated Supabase client | RLS intended in migration; write/log errors inconsistently handled; no notification to assigned staff/customer. | **PARTIAL** |
| Quote created/sent/accepted | No app writes | Customer/staff | No quote UI or email service | No email integration or delivery tracking/config found. | **NOT IMPLEMENTED** |
| Booking created/changed/cancelled | No app writes | Customer/staff/driver | No booking UI or dispatch/notification flow | No delivery mechanism, retry, dedupe or availability conflict control. | **NOT IMPLEMENTED** |
| Notification bell / list | None | Authenticated staff | Bell is a link to generic placeholder | No notification table, unread/read state, event trigger, realtime subscription, polling or cross-session behavior. | **NOT IMPLEMENTED** |
| New messages / real-time chat | None | Visitor and staff | No Supabase Realtime channel/subscription or staff responder | Migration does not configure publication; reconnection/duplicate safeguards absent. | **NOT IMPLEMENTED** |

No provider, edge function, webhook, SMTP configuration, notification service, scheduler or realtime subscription was found under `src/` and `supabase/`. This is static repository evidence; secrets and dashboard settings were not inspected. No email or external communication was sent during audit.

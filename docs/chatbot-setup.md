# Chatbot local setup

The hybrid chat implementation is local only. Its database prerequisite is [20261015190000_chat_conversations.sql](/F:/SKYRUN/skyrun/supabase/migrations/20261015190000_chat_conversations.sql). Do not apply it until the intended project is confirmed as `cudisqrugjupstgdeqac`; this workspace currently has a conflicting Supabase CLI reference.

## What the local migration adds

It adds session-token hashes, assignment and handoff fields to the existing `conversations` table; indexes for the inbox; restricted service-role RPCs for public visitor operations; and Realtime publication entries for staff updates. It adds no table and does not alter the approved 14-table boundary.

The visitor receives an opaque random session secret in browser local storage. The database receives only its SHA-256 hash. Clearing browser storage starts a new conversation; there is no identity recovery mechanism until the visitor shares contact details. Anonymous browser clients never receive direct table access.

## AI and email

No AI or email provider was found or configured, and this implementation does not choose one. The widget runs a server-side approved-content FAQ fallback with no credential and no external call. There are no AI environment variables yet.

Before connecting an AI provider, add a server-only provider adapter and document its key name, model, timeout, output limit and billing approval. Do not expose that key through a `VITE_` variable. Email notifications remain unimplemented because there is no provider or persistent notification/outbox model.

## Realtime and unread limits

Staff inbox code subscribes to `conversations` and `conversation_messages`; the migration prepares publication. Actual delivery depends on the remote Supabase Realtime configuration and deployed RLS, neither of which was verified locally.

The approved schema cannot model correct per-staff unread state without a recipient/read-state table. The existing notification bell is intentionally unchanged. Adding a notification or conversation-read table needs owner approval.

## Deployment checklist

1. Confirm the target Supabase project and take a read-only schema/RLS snapshot.
2. Review and apply the local migration through the approved deployment process.
3. Test visitor A versus visitor B session isolation, staff role/business-unit isolation, and service-role RPC grants against the target project.
4. Verify Realtime publication and staff channel delivery.
5. Decide AI provider and email/outbox design before enabling either integration.

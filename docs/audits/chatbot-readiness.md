# Deliverable D — Chatbot Readiness Report

## Classification

**A public scripted contact-capture widget exists and is mounted on the homepage. A persisted chatbot/conversation system is NOT IMPLEMENTED.** It is not an AI chatbot.

## Current behavior

`src/components/chat-widget.tsx` displays a launcher and four scripted prompts: initial free-text message, name, phone, email. Answers and transcript live in React component state only; closing/reloading loses the conversation. On completion it calls `submitLead` from `src/lib/leads.functions.ts`, which attempts customer matching/creation and creates one generic lead with source `CHATBOT`. No conversation or message records are created. A failure returns to an input step; it is only an in-widget fallback.

| Required capability | Current evidence | Classification |
|---|---|---|
| Public widget | Mounted by `HomePage` in `src/components/skyrun-site.tsx` | **WORKING** in source; not browser-runtime independently verified |
| Scripted interaction | Four fixed prompts and text input | **PARTIAL**: captures fields; no intent routing/FAQ answer set |
| AI model/provider/API | No provider, server endpoint, model config or AI call found | **NOT IMPLEMENTED** |
| Persistence across refresh/session | React state only; final generic lead only | **NOT IMPLEMENTED** for transcript |
| Conversation/message schema | Local migration/types define `conversations` and `conversation_messages` | **PARTIAL**: schema design exists locally; not used by app; remote existence unknown |
| Customer/lead link | Final generated lead links a customer; no conversation row or lead-to-chat transcript link | **PARTIAL** lead link only |
| Operations Center history/replies | Chat Conversations route is a placeholder | **NOT CONNECTED** |
| Real time/unread/assignment/notifications | No subscription/event/notification implementation | **NOT IMPLEMENTED** |
| Input and abuse safeguards | `submitLead` validates type/length/email; honeypot field defined but not passed; no rate limit, IP/session abuse control, duplicate guard | **PARTIAL / security gap** |
| Privacy-conscious collection | Collects free-text, name, phone, email; transcript not stored, but lead stores message and trip form serializes trip data into it | **PARTIAL**; retention/access policy still needs review |
| Service unavailable behavior | Catch message asks to check details, then sets step to phone; does not preserve clear retry semantics | **PARTIAL** |
| Secret handling | Service key access is in server-only module dynamically imported in server function | **PARTIAL by code design**; deployment-secret configuration not verified |

## Dependencies and decisions before implementation

1. Choose product scope: scripted FAQ + lead handoff, staff live chat, AI-generated answers, or staged combination. No provider or cost is implied by this audit.
2. Approve conversation lifecycle, anonymous/session identity, message retention, consent/privacy copy, transcript visibility, assignment, unread rules, and staff reply expectations.
3. Confirm production schema and RLS for `conversations`/`conversation_messages`; add public write through a server endpoint with rate limiting and strict validation rather than broad anonymous table access.
4. Define links between conversation, lead and customer and the behavior when a visitor abandons before sharing identity.
5. Define notification delivery (in-app, email, realtime) and outage/retry behavior.
6. If AI is selected, choose provider/model and server-side credential handling only after explicit business approval. Add output safety, prompt-injection defenses, escalation and unavailable-provider fallback.
7. Add tests for session persistence, duplicate submissions, privacy boundaries, RLS authorization, abuse controls, staff history/reply, and provider failure.

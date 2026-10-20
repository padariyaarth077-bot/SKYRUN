import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CHAT_BUSINESS_UNIT_ID,
  chatContactSchema,
  chatMessageSchema,
  chatPageInput,
  fallbackReply,
  type ChatPage,
} from "@/lib/chat.shared";

function hashSession(session: string) {
  return createHash("sha256").update(session).digest("hex");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function databaseError() {
  return new Error("We could not save your message. Please try again.");
}

export const startChat = createServerFn({ method: "POST" })
  .validator(
    z.object({
      session: z
        .string()
        .regex(/^[A-Za-z0-9_-]{43,128}$/)
        .optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const session = data.session ?? randomBytes(32).toString("base64url");
    const client = await admin();
    const { data: conversation, error } = await client.rpc("chat_start_conversation", {
      _business_unit_id: CHAT_BUSINESS_UNIT_ID,
      _session_token_hash: hashSession(session),
    });
    if (error || !conversation) throw databaseError();
    return { session, conversation: conversation as string };
  });

export const loadChat = createServerFn({ method: "POST" })
  .validator(chatPageInput.parse)
  .handler(async ({ data }) => {
    const client = await admin();
    const { data: result, error } = await client.rpc("chat_load_page", {
      _session_token_hash: hashSession(data.session),
      _before_created_at: data.beforeCreatedAt ?? null,
      _before_id: data.beforeId ?? null,
    });
    if (error || !result) throw new Error("This chat session is no longer available.");
    return result as ChatPage;
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .validator(chatMessageSchema.parse)
  .handler(async ({ data }) => {
    const client = await admin();
    const sessionHash = hashSession(data.session);
    const { data: result, error } = await client.rpc("chat_send_message", {
      _session_token_hash: sessionHash,
      _operation_id: data.operationId,
      _message: data.message,
      _reply: fallbackReply(data.message),
    });
    if (error || !result) throw databaseError();

    return result as {
      conversation_id: string;
      status: string;
      message_id: string;
      reply: string | null;
    };
  });

export const requestChatHandoff = createServerFn({ method: "POST" })
  .validator(z.object({ session: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/) }).parse)
  .handler(async ({ data }) => {
    const client = await admin();
    const { data: result, error } = await client.rpc("chat_request_handoff", {
      _session_token_hash: hashSession(data.session),
    });
    if (error || !result) throw databaseError();
    return result as { conversation_id: string; status: string };
  });

export const submitChatContact = createServerFn({ method: "POST" })
  .validator(chatContactSchema.parse)
  .handler(async ({ data }) => {
    if (data.website) return { ok: true, reference: "" };
    const client = await admin();
    const { data: result, error } = await client.rpc("chat_capture_contact", {
      _session_token_hash: hashSession(data.session),
      _name: data.name,
      _email: data.email.toLowerCase(),
      _phone: data.phone,
      _trip_details: JSON.stringify({
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        pickupDate: data.pickupDate,
        pickupTime: data.pickupTime,
        passengerCount: data.passengerCount,
        luggage: data.luggage,
      }),
    });
    if (error || !result) throw databaseError();
    return result as { ok: boolean; reference: string };
  });

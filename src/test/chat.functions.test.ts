import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator: (validate: (data: unknown) => unknown) => ({
      handler: (handle: (input: { data: unknown }) => unknown) => (input: { data: unknown }) =>
        handle({ data: validate(input.data) }),
    }),
  }),
}));
import { loadChat, requestChatHandoff, sendChatMessage } from "@/lib/chat.functions";

const session = "A".repeat(43);
beforeEach(() => vi.resetAllMocks());

it.each([loadChat, requestChatHandoff])(
  "rejects invalid sessions before database access",
  (call) => {
    expect(() => call({ data: { session: "invalid" } })).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  },
);

it("loads the chat state using only the hashed session", async () => {
  const state = { conversation: { id: "conversation", status: "OPEN" }, messages: [] };
  rpc.mockResolvedValue({ data: state, error: null });
  await expect(loadChat({ data: { session } })).resolves.toEqual(state);
  expect(rpc).toHaveBeenCalledWith("chat_load_page", {
    _session_token_hash: createHash("sha256").update(session).digest("hex"),
    _before_created_at: null,
    _before_id: null,
  });
});

it("requests a handoff with a valid session", async () => {
  const result = { conversation_id: "conversation", status: "HANDOFF_REQUESTED" };
  rpc.mockResolvedValue({ data: result, error: null });
  await expect(requestChatHandoff({ data: { session } })).resolves.toEqual(result);
  expect(rpc).toHaveBeenCalledWith("chat_request_handoff", {
    _session_token_hash: createHash("sha256").update(session).digest("hex"),
  });
});

it.each([loadChat, requestChatHandoff])("hides database failures", async (call) => {
  rpc.mockResolvedValue({ data: null, error: { message: "private database detail" } });
  await expect(call({ data: { session } })).rejects.not.toThrow("private database detail");
});

it("saves a visitor message and preset reply with one idempotent database call", async () => {
  const operationId = "11111111-1111-4111-8111-111111111111";
  rpc.mockResolvedValue({
    data: {
      conversation_id: "conversation",
      message_id: "message",
      status: "HUMAN_HANDLING",
      reply: null,
    },
    error: null,
  });
  const result = await sendChatMessage({
    data: { session, operationId, message: "I need airport travel" },
  });
  expect(result.reply).toBeNull();
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith(
    "chat_send_message",
    expect.objectContaining({
      _operation_id: operationId,
      _session_token_hash: createHash("sha256").update(session).digest("hex"),
      _message: "I need airport travel",
    }),
  );
});
it("rejects a missing retry key before reaching the database", () => {
  expect(() => sendChatMessage({ data: { session, message: "hello" } as never })).toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it("does not expose visitor message database failures", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private SQL error" } });
  await expect(
    sendChatMessage({
      data: { session, operationId: "11111111-1111-4111-8111-111111111111", message: "hello" },
    }),
  ).rejects.toThrow("We could not save your message. Please try again.");
});

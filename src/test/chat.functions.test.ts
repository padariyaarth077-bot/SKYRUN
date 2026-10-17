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
import { loadChat, requestChatHandoff } from "@/lib/chat.functions";

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
  expect(rpc).toHaveBeenCalledWith("chat_load_conversation", {
    _session_token_hash: createHash("sha256").update(session).digest("hex"),
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

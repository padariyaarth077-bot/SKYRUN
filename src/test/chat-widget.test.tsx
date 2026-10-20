import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatWidget } from "@/components/chat-widget";
const { startChat, loadChat, sendChatMessage, requestChatHandoff, submitChatContact } = vi.hoisted(
  () => ({
    startChat: vi.fn(),
    loadChat: vi.fn(),
    sendChatMessage: vi.fn(),
    requestChatHandoff: vi.fn(),
    submitChatContact: vi.fn(),
  }),
);
vi.mock("@/lib/chat.functions", () => ({
  startChat,
  loadChat,
  sendChatMessage,
  requestChatHandoff,
  submitChatContact,
}));
const session = "A".repeat(43);
const conversation = {
  id: "conversation",
  status: "AI_HANDLING",
  assigned_to: null,
  handoff_requested_at: null,
  lead_id: null,
  customer_id: null,
  updated_at: "2026-10-21T12:00:00Z",
};
const welcome = {
  id: "welcome",
  sender_type: "BOT",
  message: "Welcome test visitor",
  created_at: "2026-10-21T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  startChat.mockResolvedValue({ session, conversation: "conversation" });
  loadChat.mockResolvedValue({ conversation, messages: [welcome], has_more: false });
  sendChatMessage.mockResolvedValue({
    conversation_id: "conversation",
    message_id: "message",
    status: "AI_HANDLING",
    reply: "Preset answer",
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function open() {
  render(<ChatWidget />);
  fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
  await screen.findByText("Welcome test visitor");
  await waitFor(() => expect(screen.getByLabelText("Chat message")).toBeEnabled());
}
it("receives persisted staff replies through polling, then stops when minimized", async () => {
  vi.useFakeTimers();
  render(<ChatWidget />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
  });
  expect(screen.getByText("Welcome test visitor")).toBeInTheDocument();
  loadChat.mockResolvedValue({
    conversation: { ...conversation, status: "HUMAN_HANDLING" },
    messages: [
      welcome,
      {
        id: "staff",
        sender_type: "ADMIN",
        message: "A real saved staff reply",
        created_at: "2026-10-21T12:01:00Z",
      },
    ],
    has_more: false,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(screen.getByText("A real saved staff reply")).toBeInTheDocument();
  expect(screen.getByText(/Automated replies are paused/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Minimize chat" }));
  const count = loadChat.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(loadChat).toHaveBeenCalledTimes(count);
});
it("preserves failed visitor text and reuses its operation ID on retry", async () => {
  sendChatMessage.mockRejectedValueOnce(Error("private failure"));
  await open();
  fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Airport trip" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText(/Your message could not be confirmed/);
  expect(screen.getByLabelText("Chat message")).toHaveValue("Airport trip");
  const first = sendChatMessage.mock.calls[0]![0].data.operationId;
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(screen.getByLabelText("Chat message")).toHaveValue(""));
  expect(sendChatMessage.mock.calls[1]![0].data.operationId).toBe(first);
  expect(screen.queryByText("private failure")).toBeNull();
});
it("does not lose a successfully saved message draft because refresh fails or offer duplicate resend", async () => {
  await open();
  loadChat.mockRejectedValue(Error("load failure"));
  fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Saved message" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText(/Could not refresh chat/);
  expect(screen.getByLabelText("Chat message")).toHaveValue("");
  expect(screen.queryByText(/Your message could not be confirmed/)).toBeNull();
  expect(screen.getByText("Welcome test visitor")).toBeInTheDocument();
});
it("serializes rapid clicks and keeps controls disabled while sending", async () => {
  let resolve!: (result: unknown) => void;
  sendChatMessage.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await open();
  fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "One message" } });
  const button = screen.getByRole("button", { name: "Send message" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(sendChatMessage).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Chat message")).toBeDisabled();
  resolve({ message_id: "message" });
  await waitFor(() => expect(screen.getByLabelText("Chat message")).toBeEnabled());
});
it("does not permit messages in a resolved conversation and offers an explicit new chat", async () => {
  loadChat.mockResolvedValue({
    conversation: { ...conversation, status: "RESOLVED" },
    messages: [welcome],
    has_more: false,
  });
  render(<ChatWidget />);
  fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
  await screen.findByText(/This conversation is closed/);
  expect(screen.getByLabelText("Chat message")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Start a new chat" })).toBeInTheDocument();
});

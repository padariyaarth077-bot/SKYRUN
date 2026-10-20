import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ChatInbox } from "@/components/chat-inbox";
const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params }: { children: ReactNode; to: string; params: { id: string } }) => (
    <a href={to.replace("$id", params.id)}>{children}</a>
  ),
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({
    children,
    title,
    actions,
  }: {
    children: ReactNode;
    title: string;
    actions: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
  Panel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  timeAgo: () => "Recently",
}));
const id = "11111111-1111-4111-8111-111111111111",
  otherId = "22222222-2222-4222-8222-222222222222",
  staff = "staff";
const message = {
  id: "33333333-3333-4333-8333-333333333333",
  sender_type: "CUSTOMER",
  message: "Visitor message",
  created_at: "2026-10-21T12:00:00Z",
};
let rows: {
  id: string;
  business_unit_id: string;
  status: string;
  assigned_to: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_id: string | null;
  lead_id: string | null;
  last_customer_message_id: string;
  unread: boolean;
  can_handle: boolean;
}[];
function page(forId = id) {
  const row = rows.find((r) => r.id === forId)!;
  return {
    conversation: { ...row, updated_at: "2026-10-21T12:00:00Z", handoff_requested_at: null },
    messages: [
      { ...message, message: forId === id ? "Visitor message" : "Other conversation message" },
    ],
    last_customer_message_id: message.id,
    can_handle: row.can_handle,
    has_more: false,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  rows = [
    {
      id,
      business_unit_id: "unit",
      status: "AI_HANDLING",
      assigned_to: null,
      customer_name: "Customer A",
      customer_phone: "+12025550188",
      customer_id: "customer-id",
      lead_id: "lead-id",
      last_customer_message_id: message.id,
      unread: true,
      can_handle: true,
    },
  ];
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => Promise.resolve({ data: rows, error: null })),
  }));
  rpc.mockImplementation((name, args) => {
    if (name === "chat_staff_load")
      return Promise.resolve({ data: page(args._conversation_id), error: null });
    if (name === "chat_mark_read") return Promise.resolve({ data: true, error: null });
    if (name === "chat_staff_action") {
      rows = rows.map((r) =>
        r.id === args._conversation_id
          ? {
              ...r,
              assigned_to: staff,
              status:
                args._action === "claim"
                  ? "HUMAN_HANDLING"
                  : args._action === "reply"
                    ? "WAITING_FOR_CUSTOMER"
                    : "RESOLVED",
            }
          : r,
      );
      return Promise.resolve({ data: args._conversation_id, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});
afterEach(cleanup);
async function select() {
  fireEvent.click(await screen.findByRole("button", { name: /Customer A/ }));
  await screen.findByText("Visitor message");
}
it("loads real history, marks only the observed visitor message read, and links customer/lead", async () => {
  render(<ChatInbox userId={staff} />);
  await select();
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("chat_mark_read", {
      _conversation_id: id,
      _last_customer_message_id: message.id,
    }),
  );
  expect(screen.getByRole("link", { name: "Customer profile" })).toHaveAttribute(
    "href",
    "/admin/customer/customer-id",
  );
  expect(screen.getByRole("link", { name: "Linked lead" })).toHaveAttribute(
    "href",
    "/admin/leads/lead-id",
  );
});
it("shows inbox failure distinctly from no conversations and hides raw errors", async () => {
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: null, error: { message: "private SQL" } }),
  }));
  render(<ChatInbox userId={staff} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load conversations");
  expect(screen.queryByText("No matching conversations.")).toBeNull();
  expect(screen.queryByText("private SQL")).toBeNull();
});
it("does not enable mutation controls for read-only staff or claim another owner", async () => {
  rows[0] = { ...rows[0]!, can_handle: false, assigned_to: "other" };
  render(<ChatInbox userId={staff} />);
  await select();
  expect(screen.getByRole("button", { name: "Take over" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  expect(screen.getByText("This conversation is read-only for your role.")).toBeInTheDocument();
  expect(rpc.mock.calls.some((call) => call[0] === "chat_mark_read")).toBe(false);
});
it("claims atomically before enabling replies", async () => {
  render(<ChatInbox userId={staff} />);
  await select();
  expect(screen.getByLabelText("Reply to visitor")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Take over" }));
  await waitFor(() => expect(screen.getByLabelText("Reply to visitor")).toBeEnabled());
  expect(rpc).toHaveBeenCalledWith(
    "chat_staff_action",
    expect.objectContaining({ _conversation_id: id, _action: "claim", _message: "" }),
  );
});
it("preserves a failed reply and retries the same operation without duplicate clicks", async () => {
  rows[0] = { ...rows[0]!, assigned_to: staff, status: "HUMAN_HANDLING" };
  const standard = rpc.getMockImplementation()!;
  let release!: (result: unknown) => void;
  rpc.mockImplementation((name, args) =>
    name === "chat_staff_action"
      ? new Promise((resolve) => {
          release = resolve;
        })
      : standard(name, args),
  );
  render(<ChatInbox userId={staff} />);
  await select();
  fireEvent.change(screen.getByLabelText("Reply to visitor"), { target: { value: "Staff reply" } });
  const button = screen.getByRole("button", { name: "Send reply" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(rpc.mock.calls.filter((call) => call[0] === "chat_staff_action")).toHaveLength(1);
  expect(screen.getByLabelText("Reply to visitor")).toBeDisabled();
  release({ data: null, error: { message: "private error" } });
  await screen.findByText(/Could not confirm this action/);
  expect(screen.getByLabelText("Reply to visitor")).toHaveValue("Staff reply");
  const first = rpc.mock.calls.find((call) => call[0] === "chat_staff_action")![1];
  rpc.mockImplementation(standard);
  fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
  await waitFor(() => expect(screen.getByLabelText("Reply to visitor")).toHaveValue(""));
  const calls = rpc.mock.calls.filter((call) => call[0] === "chat_staff_action");
  expect(calls[1]![1]._operation_id).toBe(first._operation_id);
});
it("ignores an older conversation response after switching selection", async () => {
  rows.push({ ...rows[0]!, id: otherId, customer_name: "Customer B" });
  const standard = rpc.getMockImplementation()!;
  let finish!: (result: unknown) => void;
  rpc.mockImplementation((name, args) =>
    name === "chat_staff_load" && args._conversation_id === id
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : standard(name, args),
  );
  render(<ChatInbox userId={staff} />);
  fireEvent.click(await screen.findByRole("button", { name: /Customer A/ }));
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: /Customer B/ }));
  await screen.findByText("Other conversation message");
  finish({ data: page(id), error: null });
  await waitFor(() => expect(screen.queryByText("Visitor message")).toBeNull());
  expect(screen.getByText("Other conversation message")).toBeInTheDocument();
});
it("keeps per-conversation drafts when navigating between customers", async () => {
  rows[0] = { ...rows[0]!, assigned_to: staff, status: "HUMAN_HANDLING" };
  rows.push({ ...rows[0]!, id: otherId, customer_name: "Customer B" });
  render(<ChatInbox userId={staff} />);
  await select();
  fireEvent.change(screen.getByLabelText("Reply to visitor"), { target: { value: "Draft for A" } });
  fireEvent.click(screen.getByRole("button", { name: /Customer B/ }));
  await screen.findByText("Other conversation message");
  expect(screen.getByLabelText("Reply to visitor")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: /Customer A/ }));
  await screen.findByText("Visitor message");
  expect(screen.getByLabelText("Reply to visitor")).toHaveValue("Draft for A");
});
it("shows message loading failure separately and does not pretend the conversation is empty", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private" } });
  render(<ChatInbox userId={staff} />);
  fireEvent.click(await screen.findByRole("button", { name: /Customer A/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this conversation");
  expect(screen.queryByText("No messages in this conversation.")).toBeNull();
});

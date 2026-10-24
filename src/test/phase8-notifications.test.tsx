import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { rpc, toast, play } = vi.hoisted(() => ({
  rpc: vi.fn(),
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
  play: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/lib/notification-sound", () => ({
  playNotificationSound: play,
  closeNotificationAudio: vi.fn(),
  unlockNotificationAudio: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Panel: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  StatusBadge: () => null,
  timeAgo: () => "now",
}));
import {
  NotificationProvider,
  NotificationBell,
  useNotifications,
} from "@/components/notification-context";
import { NotificationSettings } from "@/components/notifications";
const user = "11111111-1111-4111-8111-111111111111",
  unit = "22222222-2222-4222-8222-222222222222";
const row = {
  id: user,
  seq: "1",
  business_unit_id: unit,
  kind: "CHAT_MESSAGE",
  severity: "NORMAL",
  title: "New customer chat message",
  entity_type: "conversation",
  entity_id: user,
  created_at: "2026-10-21T10:00:00Z",
  read_at: null,
};
let snapshot: {
  rows: unknown[];
  unread: number;
  through: string;
  preferences: Record<string, unknown>;
};
function Harness() {
  const state = useNotifications()!;
  return (
    <>
      <NotificationBell />
      <output>{state.unread ?? "unavailable"}</output>
      <p>{state.error}</p>
      <button onClick={() => void state.refresh()}>Refresh test</button>
      <button onClick={() => void state.action("read_all")}>Read all test</button>
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  snapshot = { rows: [], unread: 0, through: "0", preferences: {} };
  rpc.mockImplementation((name) =>
    Promise.resolve({ data: name === "phase8_snapshot" ? snapshot : null, error: null }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("updates bell and toast once for a new event, ignoring replay and history", async () => {
  render(
    <NotificationProvider userId={user}>
      <Harness />
    </NotificationProvider>,
  );
  await screen.findByText("0", { selector: "output" });
  snapshot = { ...snapshot, rows: [row], unread: 1, through: "1" };
  fireEvent.click(screen.getByText("Refresh test"));
  await screen.findByText("1", { selector: "output" });
  expect(toast).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Notifications, 1 unread" })).toHaveAttribute(
    "href",
    "/admin/m/notifications",
  );
  fireEvent.click(screen.getByText("Refresh test"));
  await waitFor(() =>
    expect(rpc.mock.calls.filter(([name]) => name === "phase8_snapshot")).toHaveLength(3),
  );
  expect(toast).toHaveBeenCalledTimes(1);
});
it("muted sounds preserve visual notifications and unread state", async () => {
  snapshot.preferences = { sound: false };
  render(
    <NotificationProvider userId={user}>
      <Harness />
    </NotificationProvider>,
  );
  await screen.findByText("0", { selector: "output" });
  snapshot = { ...snapshot, rows: [row], unread: 1, through: "1" };
  fireEvent.click(screen.getByText("Refresh test"));
  await screen.findByText("1", { selector: "output" });
  expect(toast).toHaveBeenCalledTimes(1);
  expect(play).not.toHaveBeenCalled();
});
it("active conversation suppresses its message alert, not its retained unread record", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  render(
    <NotificationProvider userId={user}>
      <Harness />
    </NotificationProvider>,
  );
  await screen.findByText("0", { selector: "output" });
  window.dispatchEvent(new CustomEvent("skyrun-active-conversation", { detail: user }));
  snapshot = { ...snapshot, rows: [row], unread: 1, through: "1" };
  fireEvent.click(screen.getByText("Refresh test"));
  await screen.findByText("1", { selector: "output" });
  expect(toast).not.toHaveBeenCalled();
});
it("read-all submits only the last observed boundary and errors hide stale contents", async () => {
  snapshot = { ...snapshot, rows: [row], unread: 1, through: "1" };
  render(
    <NotificationProvider userId={user}>
      <Harness />
    </NotificationProvider>,
  );
  await screen.findByText("1", { selector: "output" });
  expect(toast).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Read all test"));
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      "phase8_user_action",
      expect.objectContaining({ _action: "read_all", _through: "1" }),
    ),
  );
  rpc.mockResolvedValue({ data: null, error: { message: "private SQL" } });
  fireEvent.click(screen.getByText("Refresh test"));
  await screen.findByText("unavailable", { selector: "output" });
  expect(screen.queryByText("private SQL")).toBeNull();
});
it("preserves notification settings on failed save", async () => {
  render(
    <NotificationProvider userId={user}>
      <NotificationSettings />
    </NotificationProvider>,
  );
  const volume = screen.getByLabelText("Sound volume");
  await waitFor(() => expect(volume).toBeEnabled());
  fireEvent.change(volume, { target: { value: "0.7" } });
  rpc.mockImplementation((name) =>
    Promise.resolve({
      data: name === "phase8_snapshot" ? snapshot : null,
      error: name === "phase8_user_action" ? { message: "private SQL" } : null,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save notification preferences" }));
  await screen.findByText("Could not save. Your preferences are preserved; retry safely.");
  expect(volume).toHaveValue("0.7");
  expect(rpc).toHaveBeenCalledWith(
    "phase8_user_action",
    expect.objectContaining({ _preferences: expect.objectContaining({ volume: 0.7 }) }),
  );
});

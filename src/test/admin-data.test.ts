import { beforeEach, expect, it, vi } from "vitest";
const { from, rpc, range, single, update } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  range: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
import { fetchLeads, readAll, setLeadStatus, matchesLeadStatus } from "@/lib/admin-data";
beforeEach(() => {
  vi.resetAllMocks();
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range,
    single,
    update,
  };
  update.mockReturnValue(chain);
  from.mockReturnValue(chain);
  single
    .mockResolvedValueOnce({ data: { status: "NEW" }, error: null })
    .mockResolvedValue({ data: { id: "lead" }, error: null });
  rpc.mockResolvedValue({ data: "activity", error: null });
});
it("rejects failed reads with safe error", async () => {
  range.mockResolvedValue({ data: null, error: { message: "private" } });
  await expect(fetchLeads()).rejects.toThrow("Could not load leads. Please retry.");
});
it("returns a successful empty list", async () => {
  range.mockResolvedValue({ data: [], error: null });
  await expect(fetchLeads()).resolves.toEqual([]);
});
it("reads successive ranges beyond the API row limit", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null })
    .mockResolvedValueOnce({ data: [{ id: 500 }], error: null });
  const rows = await readAll(read);
  expect(rows).toHaveLength(501);
  expect(read).toHaveBeenNthCalledWith(1, 0, 499);
  expect(read).toHaveBeenNthCalledWith(2, 500, 999);
});
it("does not return partial records after a later page fails", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ data: Array(500).fill({ id: 1 }), error: null })
    .mockResolvedValueOnce({ data: null, error: { message: "private" } });
  await expect(readAll(read)).rejects.toThrow("Could not load records");
});
it("treats NEW and REVIEWING as Needs Review only", () => {
  expect(matchesLeadStatus("NEW", "NEEDS_REVIEW")).toBe(true);
  expect(matchesLeadStatus("REVIEWING", "NEEDS_REVIEW")).toBe(true);
  expect(matchesLeadStatus("GENUINE", "NEEDS_REVIEW")).toBe(false);
});
it("records review metadata only after a confirmed write", async () => {
  await setLeadStatus("lead", "SPAM", "staff", "Duplicate");
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "SPAM", reviewed_by: "staff", spam_reason: "Duplicate" }),
  );
  expect(rpc).toHaveBeenCalledWith(
    "log_activity",
    expect.objectContaining({ _entity_id: "lead", _activity_type: "STATUS_CHANGE" }),
  );
});
it("does not create audit activity when status write is denied", async () => {
  single
    .mockReset()
    .mockResolvedValueOnce({ data: { status: "NEW" }, error: null })
    .mockResolvedValueOnce({ data: null, error: { message: "private" } });
  await expect(setLeadStatus("lead", "GENUINE", "staff")).rejects.toThrow("Could not save");
  expect(rpc).not.toHaveBeenCalled();
});
it("reports partial audit failure accurately", async () => {
  rpc.mockResolvedValue({ error: { message: "private" } });
  await expect(setLeadStatus("lead", "GENUINE", "staff")).rejects.toThrow(
    "Status saved, but activity could not be recorded",
  );
});
it("rejects unsupported statuses before querying", async () => {
  await expect(setLeadStatus("lead", "FAKE" as never, "staff")).rejects.toThrow("Unsupported");
  expect(from).not.toHaveBeenCalled();
});

it("does not repeat a status or audit already saved", async () => {
  single.mockReset().mockResolvedValue({ data: { status: "GENUINE" }, error: null });
  await setLeadStatus("lead", "GENUINE", "staff");
  expect(update).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it("sanitizes unexpected transport exceptions before status mutation", async () => {
  single.mockReset().mockRejectedValue(new Error("private transport credentials"));
  await expect(setLeadStatus("lead", "GENUINE", "staff")).rejects.toThrow(
    "Could not save the lead status",
  );
  expect(rpc).not.toHaveBeenCalled();
});
it("reports confirmed status if the audit transport throws", async () => {
  rpc.mockRejectedValue(new Error("private transport"));
  await expect(setLeadStatus("lead", "GENUINE", "staff")).rejects.toThrow(
    "Status saved, but activity could not be recorded",
  );
});

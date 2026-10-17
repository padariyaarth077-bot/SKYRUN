import { beforeEach, expect, it, vi } from "vitest";
const { order } = vi.hoisted(() => ({ order: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ order }) }) },
}));
import { fetchLeads } from "@/lib/admin-data";
beforeEach(() => vi.resetAllMocks());
it("rejects failed reads with a safe error instead of returning an empty lead list", async () => {
  order.mockResolvedValue({ data: null, error: { message: "private database detail" } });
  await expect(fetchLeads()).rejects.toThrow("Could not load leads. Please retry.");
});
it("returns an empty list for a successful empty read", async () => {
  order.mockResolvedValue({ data: [], error: null });
  await expect(fetchLeads()).resolves.toEqual([]);
});

import { beforeEach, expect, it, vi } from "vitest";
import {
  csvCell,
  reportCsv,
  reportFilters,
  emptyFilters,
  entityDestination,
  fetchReport,
  exportReport,
} from "@/lib/reports";
import { evidenceEligible, profileSchema, blankProfile } from "@/lib/finance";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
beforeEach(() => vi.resetAllMocks());
it("validates real dates, date order, unit IDs and query bounds", () => {
  expect(reportFilters.safeParse({ ...emptyFilters("quotes"), from: "2026-02-30" }).success).toBe(
    false,
  );
  expect(
    reportFilters.safeParse({ ...emptyFilters("quotes"), from: "2026-10-20", to: "2026-10-01" })
      .success,
  ).toBe(false);
  expect(reportFilters.safeParse({ ...emptyFilters("quotes"), unit: "other" }).success).toBe(false);
  expect(
    reportFilters.safeParse({ ...emptyFilters("quotes"), search: "x".repeat(121) }).success,
  ).toBe(false);
  expect(
    reportFilters.safeParse({ ...emptyFilters("quotes"), from: "2026-10-01", to: "2026-10-20" })
      .success,
  ).toBe(true);
});
it.each(["=SUM(A1)", "+cmd", "-1+2", "@SUM(A1)", "  =1", "\tformula", "\rpayload"])(
  "neutralizes spreadsheet formula input %s",
  (value) => {
    expect(csvCell(value)).toContain("'");
  },
);
it("escapes quotes, commas and lines; exports only supported columns", () => {
  const csv = reportCsv("quotes", [
    {
      reference: 'A,"B"\nC',
      customer: "Name",
      amount: "100.10",
      currency: "USD",
      status: "DRAFT",
      date: "2026-10-21",
      secret: "never export",
    },
  ]);
  expect(csv).toContain('"A,""B""\nC"');
  expect(csv).not.toContain("never export");
  expect(csv).toContain("100.10");
});
it("preserves exact database decimal text in CSV without binary rounding", () => {
  expect(reportCsv("quotes", [{ amount: "99999999.99", currency: "USD" }])).toContain(
    "99999999.99",
  );
});
it("uses an authenticated database RPC with exact filters and bounded paging", async () => {
  rpc.mockResolvedValue({ data: { rows: [], total: 0 }, error: null });
  await fetchReport({ ...emptyFilters("enquiries"), search: "name", from: "2026-10-01" }, 50);
  expect(rpc).toHaveBeenCalledWith(
    "phase7_report",
    expect.objectContaining({
      _kind: "enquiries",
      _from: "2026-10-01",
      _search: "name",
      _offset: 50,
      _limit: 50,
    }),
  );
});
it("does not turn query failure into zero or expose internal diagnostics", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private SQL" } });
  await expect(fetchReport(emptyFilters("quotes"))).rejects.toThrow("Report unavailable");
});
it("exports one authorized database snapshot and preserves filters", async () => {
  rpc.mockResolvedValue({
    data: { rows: [{ id: "one", reference: "ref", amount: "12.30", currency: "USD" }], total: 1 },
    error: null,
  });
  expect(await exportReport({ ...emptyFilters("quotes"), status: "DRAFT" })).toContain("12.30");
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc.mock.calls[0]![1]).toMatchObject({ _status: "DRAFT", _limit: 10000 });
});
it.each([
  { rows: [], total: 0 },
  { rows: [], total: 10001 },
  { rows: [{ id: "1" }], total: 2 },
])("rejects empty, excessive or incomplete exports", async (data) => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(exportReport(emptyFilters("quotes"))).rejects.toThrow();
});
it("only links recognized entities with valid IDs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  expect(entityDestination("booking", id)).toBe("/admin/booking/" + id);
  expect(entityDestination("unknown", id)).toBeNull();
  expect(entityDestination("booking", "javascript:bad")).toBeNull();
});
it("requires verified unreversed same-booking/currency/tenant evidence", () => {
  const b = { id: "b", currency: "USD", business_unit_id: "u" },
    r = {
      booking_id: "b",
      currency: "USD",
      business_unit_id: "u",
      verified_at: "now",
      verified_by: "actor",
    };
  expect(evidenceEligible(r, b, false)).toBe(true);
  expect(evidenceEligible(r, b, true)).toBe(false);
  expect(evidenceEligible({ ...r, verified_by: null }, b, false)).toBe(false);
  expect(evidenceEligible({ ...r, currency: "CAD" }, b, false)).toBe(false);
  expect(evidenceEligible({ ...r, business_unit_id: "other" }, b, false)).toBe(false);
});
it("allows genuinely missing business details, rejects secret fields and invalid contacts", () => {
  expect(profileSchema.safeParse(blankProfile).success).toBe(true);
  expect(profileSchema.safeParse({ ...blankProfile, service_role_key: "forbidden" }).success).toBe(
    false,
  );
  expect(profileSchema.safeParse({ ...blankProfile, email: "bad" }).success).toBe(false);
  expect(profileSchema.safeParse({ ...blankProfile, website: "http://example.test" }).success).toBe(
    false,
  );
});

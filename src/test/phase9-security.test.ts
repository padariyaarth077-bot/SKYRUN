import { afterEach, expect, it, vi } from "vitest";
const { rpc, request } = vi.hoisted(() => ({ rpc: vi.fn(), request: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: request }));
import { budgetSubject, enforcePublicBudget } from "@/lib/public-budget.server";
import { secureResponse } from "@/lib/security-headers";
import { managementPage } from "@/lib/admin-access";
import { describeError } from "@/lib/error-capture";
import { reportLovableError } from "@/lib/lovable-error-reporting";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it.each([
  "/admin/m/invoices",
  "/admin/m/invoices/",
  "/admin/document/receipt/id",
  "/admin/m/%72eceipts",
])("guards direct financial page %s", (path) => expect(managementPage(path)).toBe(true));
it.each(["/admin/settings", "/admin/leads", "/admin/m/notifications"])(
  "preserves ordinary staff page %s",
  (path) => expect(managementPage(path)).toBe(false),
);
it("sets narrow security headers and preserves stricter private response policy", () => {
  const r = secureResponse(
    new Request("https://example.test/admin"),
    new Response("ok", { headers: { "Referrer-Policy": "no-referrer" } }),
  );
  expect(r.headers.get("Cache-Control")).toBe("no-store, private");
  expect(r.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(r.headers.get("X-Frame-Options")).toBe("DENY");
  expect(r.headers.get("Strict-Transport-Security")).toContain("31536000");
  expect(r.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
});
it("does not send HSTS on plain local HTTP", () =>
  expect(
    secureResponse(new Request("http://localhost/"), new Response()).headers.has(
      "Strict-Transport-Security",
    ),
  ).toBe(false));
it("never trusts forwarded/IP headers without Cloudflare runtime metadata", () => {
  const a = new Request("http://local/", {
    headers: { "cf-connecting-ip": "192.0.2.1", "x-forwarded-for": "192.0.2.2" },
  });
  const b = new Request("http://local/", { headers: { "cf-connecting-ip": "192.0.2.3" } });
  expect(budgetSubject(a, "synthetic-secret")).toBe(budgetSubject(b, "synthetic-secret"));
  Object.assign(a, { cf: {} });
  Object.assign(b, { cf: {} });
  expect(budgetSubject(a, "synthetic-secret")).not.toBe(budgetSubject(b, "synthetic-secret"));
  expect(budgetSubject(a, "synthetic-secret")).toMatch(/^[a-f0-9]{64}$/);
});
it("keys subjects so a different server secret changes the stored digest", () => {
  const a = new Request("http://local/");
  expect(budgetSubject(a, "synthetic-secret-A")).not.toBe(budgetSubject(a, "synthetic-secret-B"));
});
it.each([false, null])("fails closed on rejected budget %s", async (data) => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-secret");
  request.mockReturnValue(new Request("http://local/"));
  rpc.mockResolvedValue({ data, error: null });
  await expect(enforcePublicBudget("ride")).rejects.toThrow("Request temporarily unavailable");
});
it("hides transport details and requires a configured server secret", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  await expect(enforcePublicBudget("ride")).rejects.toThrow("Request temporarily unavailable");
  expect(rpc).not.toHaveBeenCalled();
});
it("permits a confirmed budget and passes no raw identity to the database", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-secret");
  request.mockReturnValue(new Request("http://local/"));
  rpc.mockResolvedValue({ data: true, error: null });
  await enforcePublicBudget("chat_write");
  expect(rpc).toHaveBeenCalledWith("phase9_budget", {
    _scope: "chat_write",
    _subject: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});
it("does not expand secrets or bearer URLs in production errors", () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(
    describeError(new Error("Bearer private-token at https://example.test/#access_token=private")),
  ).toBe("ServerError (details withheld)");
});
it("does not forward production errors into optional preview telemetry hooks", () => {
  vi.stubEnv("PROD", true);
  const capture = vi.fn(),
    report = vi.fn();
  window.__lovableEvents = { captureException: capture };
  window.__lovableReportRuntimeError = report;
  try {
    reportLovableError(new Error("synthetic private context"));
    expect(capture).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  } finally {
    delete window.__lovableEvents;
    delete window.__lovableReportRuntimeError;
  }
});

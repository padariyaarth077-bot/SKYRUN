import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
import { submitQuoteEmail } from "@/lib/quote-email.server";

const input = {
  deliveryId: "ef965fa7-ed2c-40ef-9b97-93afcc67c703",
  quoteId: "ee2471c9-44b0-4f38-9b58-0fd84686e867",
  to: "customer@example.test",
  text: "TEST ONLY\nQuoted amount: USD 125.50\nThis quote is not a confirmed booking.",
  isTest: true,
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("prepared Resend quote transport (mocked, no live sending)", () => {
  it.each([
    { kind: "http", expected: "provider_response", status: 403, timeout: false },
    { kind: "network", expected: "request", status: undefined, timeout: false },
    { kind: "timeout", expected: "request", status: undefined, timeout: true },
    { kind: "format", expected: "response_format", status: 200, timeout: false },
  ])("logs only safe diagnostics for $kind", async ({ kind, expected, status, timeout }) => {
    vi.stubEnv("RESEND_API_KEY", "SECRET-NEVER-LOG");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (kind === "network" || kind === "timeout") {
          const error = new Error("SECRET-NEVER-LOG private provider content");
          if (kind === "timeout") error.name = "TimeoutError";
          throw error;
        }
        return {
          ok: kind !== "http",
          status,
          json: async () => ({ private: "SECRET-NEVER-LOG" }),
        };
      }),
    );
    await expect(submitQuoteEmail(input)).rejects.toThrow("submission could not be confirmed");
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0]![0])).toEqual({
      event: "quote_email_failure",
      stage: expected,
      ...(status ? { status } : {}),
      timeout,
    });
    const output = JSON.stringify(log.mock.calls);
    for (const privateValue of ["SECRET-NEVER-LOG", input.to, input.text, input.deliveryId])
      expect(output).not.toContain(privateValue);
  });
  it("fails closed without a secret", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitQuoteEmail(input)).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses the fixed sender, plain text and stable retry key; reports acceptance only", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-placeholder");
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: input.deliveryId }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitQuoteEmail(input)).toEqual({
      providerEmailId: input.deliveryId,
      state: "provider_accepted",
    });
    await submitQuoteEmail(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = fetchMock.mock.calls[0];
    const second = fetchMock.mock.calls[1];
    if (!first || !second) throw new Error("Both submissions must call the provider");
    const [url, request] = first;
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers["Idempotency-Key"]).toBe(`quote-delivery/${input.deliveryId}`);
    expect(second[1].body).toBe(request.body);
    const body = JSON.parse(request.body);
    expect(body.from).toBe("Skyrun Limo <support@skyrunlimo.com>");
    expect(body.reply_to).toBe("support@skyrunlimo.com");
    expect(body.text).toContain("not a confirmed booking");
    expect(body.subject).toMatch(/^\[TEST ONLY\]/);
    expect(body.html).toBeUndefined();
    expect(request.redirect).toBe("manual");
  });
  it("rejects redirects without following them or accepting a provider result", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-placeholder");
    const json = vi.fn();
    const fetchMock = vi.fn(async (_url, init) => {
      expect(init.redirect).toBe("manual");
      return { ok: false, status: 302, json };
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitQuoteEmail(input)).rejects.toThrow("submission could not be confirmed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });
  it.each(["http", "network", "missing-id", "invalid-json"])(
    "sanitizes %s failure",
    async (kind) => {
      vi.stubEnv("RESEND_API_KEY", "test-placeholder");
      const fetchMock = vi.fn().mockImplementation(async () => {
        if (kind === "network") throw new Error("private provider details");
        return {
          ok: kind !== "http",
          json: async () => {
            if (kind === "invalid-json") throw new Error("private response");
            return { error: "private details" };
          },
        };
      });
      vi.stubGlobal("fetch", fetchMock);
      await expect(submitQuoteEmail(input)).rejects.toThrow("submission could not be confirmed");
    },
  );
  it.each([
    { to: "victim@example.test\r\nBcc: other@example.test" },
    { text: "" },
    { deliveryId: "guessable" },
  ])("rejects malformed input before network access", async (override) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitQuoteEmail({ ...input, ...override })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

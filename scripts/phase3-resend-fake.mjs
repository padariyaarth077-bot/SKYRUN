// Test-process preload only, never imported by application code. Sends NO email.
import assert from "node:assert/strict";
assert.equal(process.env.SKYRUN_PHASE3_DELIVERY_APPROVAL, "skyrun-phase1-core");
assert.equal(process.env.SUPABASE_URL, "http://127.0.0.1:56341");
assert.equal(process.env.QUOTE_EMAIL_MODE, "test");
const realFetch = globalThis.fetch,
  seen = new Map();
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : (input.url ?? input.href));
  if (
    url.origin === "https://api.resend.com" &&
    url.pathname === "/emails" &&
    init?.method === "POST"
  ) {
    const body = JSON.parse(init.body),
      headers = new Headers(init.headers),
      id = headers.get("Idempotency-Key")?.replace("quote-delivery/", "");
    assert.match(id ?? "", /^[a-f0-9-]{36}$/i);
    assert.deepEqual(body.to, ["padariyaarth077@gmail.com"]);
    assert.equal(body.from, "Skyrun Limo <support@skyrunlimo.com>");
    assert.ok(body.subject.startsWith("[TEST ONLY]"));
    assert.ok(body.text.includes("http://127.0.0.1:56500/quote/accept#token="));
    if (seen.has(id) && seen.get(id) !== init.body)
      return Response.json({ error: "fixture payload changed" }, { status: 409 });
    seen.set(id, init.body);
    return Response.json({ id });
  }
  if (["http://127.0.0.1:56341", "http://127.0.0.1:56500"].includes(url.origin))
    return realFetch(input, init);
  throw new Error("Nonlocal network blocked by isolated delivery test preload");
};

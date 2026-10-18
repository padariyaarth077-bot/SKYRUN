// Prepared integration coverage. Requires separate approval and an already-applied local migration.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
assert.equal(
  process.env.SKYRUN_PHASE3_ACCEPTANCE_APPROVAL,
  "skyrun-phase1-core",
  "Explicit acceptance migration local test approval is required",
);
const root = "F:/SKYRUN/skyrun-phase1-core",
  project = "skyrun-phase1-core",
  container = "supabase_db_skyrun-phase1-core";
assert.match(
  readFileSync(root + "/supabase/config.toml", "utf8"),
  /^project_id = "skyrun-phase1-core"$/m,
);
let status;
try {
  status = JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/supabase/dist/supabase.js"),
        "status",
        "--workdir",
        root,
        "-o",
        "json",
      ],
      {
        cwd: root,
        env: { ...process.env, SUPABASE_PROJECT_ID: project },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
} catch {
  throw new Error(
    "The approved isolated local stack must be running; CLI diagnostics are withheld to protect credentials.",
  );
}
assert.equal(status.API_URL, "http://127.0.0.1:56341");
const labels = JSON.parse(
  execFileSync("docker", ["inspect", "--format", "{{json .Config.Labels}}", container], {
    encoding: "utf8",
  }),
);
assert.equal(labels["com.supabase.cli.project"], project);
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
assert.equal(
  sql("SELECT to_regprocedure('public.customer_quote_acceptance(text,boolean)') IS NOT NULL;"),
  "t",
  "Reviewed draft migration must already be applied locally; this script never applies it",
);
const guardedFetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : (input.url ?? input.href));
  assert.equal(url.origin, status.API_URL);
  return fetch(input, init);
};
const client = (key) =>
  createClient(status.API_URL, key, {
    global: { fetch: guardedFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = client(status.SERVICE_ROLE_KEY),
  anon = client(status.ANON_KEY);
const bu = "00000000-0000-0000-0000-000000000002";
const ok = (result) => {
  if (result.error)
    throw new Error("Isolated operation failed: " + (result.error.code ?? "unknown"));
  return result.data;
};
const hash = async (token) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};
let staff, other, ordinary;
async function identity(role, unit) {
  const email = randomUUID() + "@acceptance.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  if (role)
    ok(await admin.from("user_roles").insert({ user_id: user.id, business_unit_id: unit, role }));
  const session = client(status.ANON_KEY);
  ok(await session.auth.signInWithPassword({ email, password }));
  return session;
}
async function offer(delivered = true) {
  const request = ok(
    await admin.rpc("create_ride_enquiry", {
      _business_unit_id: bu,
      _submission_key: randomUUID(),
      _name: "TEST ONLY Acceptance",
      _email: randomUUID() + "@acceptance.example.test",
      _phone: "TEST-" + randomUUID().slice(0, 25),
      _subject: "TEST ONLY NO CUSTOMER CONTACT",
      _service: "Airport transfer",
      _pickup_location: "TEST ONLY Airport",
      _dropoff_location: "TEST ONLY Hotel",
      _travel_date: "2099-11-06",
      _pickup_time: "14:30",
      _passenger_count: 2,
      _vehicle_preference: "",
      _notes: "Synthetic isolated trip",
    }),
  );
  ok(await admin.from("leads").update({ status: "GENUINE" }).eq("id", request.lead_id));
  const quoteId = randomUUID(),
    linkId = randomUUID();
  // Synthetic capability stays in memory and is never logged or written to a file.
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const tokenHash = await hash(token);
  ok(
    await staff.rpc("save_quote_draft", {
      _quote_id: quoteId,
      _ride_request_id: request.ride_request_id,
      _amount: "125.50",
      _currency: "USD",
      _valid_until: new Date(Date.now() + 86400000).toISOString(),
      _notes: "TEST ONLY exact quote",
      _expected_updated_at: null,
    }),
  );
  const quote = ok(await staff.from("quotes").select("*").eq("id", quoteId).single());
  const args = {
    _link_id: linkId,
    _quote_id: quoteId,
    _token_hash: tokenHash,
    _expected_updated_at: quote.updated_at,
  };
  ok(await staff.rpc("prepare_quote_acceptance", args));
  const providerId = randomUUID();
  // This is explicit synthetic delivery evidence, never a real Resend send/event.
  if (delivered)
    ok(
      await admin.rpc("record_quote_delivery", {
        _link_id: linkId,
        _provider_email_id: providerId,
      }),
    );
  return { ...request, quoteId, linkId, token, tokenHash, quote, args, providerId };
}
const access = (o, accept = false) =>
  admin.rpc("customer_quote_acceptance", { _token_hash: o.tokenHash, _accept: accept });
before(async () => {
  const unit = randomUUID();
  ok(
    await admin.from("business_units").insert({
      id: unit,
      organization_id: "00000000-0000-0000-0000-000000000001",
      name: "TEST ONLY acceptance other tenant",
      slug: "acceptance-" + unit,
      business_type: "LIMO",
    }),
  );
  staff = await identity("ADMIN", bu);
  other = await identity("ADMIN", unit);
  ordinary = await identity();
});
test("undelivered and unknown links are unavailable; retries do not duplicate issuance", async () => {
  const o = await offer(false);
  assert.ok((await access(o)).error);
  assert.ok((await access({ tokenHash: "0".repeat(64) })).error);
  assert.equal(ok(await staff.rpc("prepare_quote_acceptance", o.args)).id, o.linkId);
  assert.ok((await admin.from("quotes").update({ amount: 999 }).eq("id", o.quoteId)).error);
  assert.ok(
    (
      await staff.rpc("save_quote_draft", {
        _quote_id: o.quoteId,
        _ride_request_id: o.ride_request_id,
        _amount: "999.00",
        _currency: "USD",
        _valid_until: o.quote.valid_until,
        _notes: "Changed frozen draft",
        _expected_updated_at: o.quote.updated_at,
      })
    ).error,
  );
  assert.equal(
    ok(await admin.from("quotes").select("amount").eq("id", o.quoteId).single()).amount,
    125.5,
  );
  assert.equal(
    ok(await admin.from("quote_acceptance_links").select("id").eq("quote_id", o.quoteId)).length,
    1,
  );
});
test("tenant/role/anonymous and direct-table restrictions hold with actual local JWTs", async () => {
  const o = await offer(false);
  for (const c of [other, ordinary, anon])
    assert.ok(
      (await c.rpc("prepare_quote_acceptance", { ...o.args, _link_id: randomUUID() })).error,
    );
  for (const c of [staff, other, ordinary, anon]) {
    assert.ok(
      (await c.rpc("customer_quote_acceptance", { _token_hash: o.tokenHash, _accept: true })).error,
    );
    assert.ok(
      (
        await c.rpc("record_quote_delivery", {
          _link_id: o.linkId,
          _provider_email_id: o.providerId,
        })
      ).error,
    );
    assert.ok((await c.from("quote_acceptance_links").select("*")).error);
  }
});
test("delivered preview is read-only, limited, immutable and never creates a booking", async () => {
  const o = await offer();
  ok(
    await admin
      .from("ride_requests")
      .update({ passenger_count: 9, pickup_location: "Changed live request" })
      .eq("id", o.ride_request_id),
  );
  const preview = ok(await access(o));
  assert.equal(preview.passengers, 2);
  assert.equal(preview.pickup, "TEST ONLY Airport");
  assert.equal(preview.accepted, false);
  assert.equal(preview.bookingReference, null);
  for (const field of ["token_hash", "recipient_email", "business_unit_id", "snapshot"])
    assert.equal(preview[field], undefined);
  assert.equal(ok(await admin.from("bookings").select("id").eq("quote_id", o.quoteId)).length, 0);
  assert.ok(
    (
      await staff.rpc("save_quote_draft", {
        _quote_id: o.quoteId,
        _ride_request_id: o.ride_request_id,
        _amount: "200.00",
        _currency: "USD",
        _valid_until: o.quote.valid_until,
        _notes: "Changed",
        _expected_updated_at: o.quote.updated_at,
      })
    ).error,
  );
});
test("eight concurrent accepts produce exactly one pending booking and two acceptance activities", async () => {
  const o = await offer();
  ok(
    await admin
      .from("ride_requests")
      .update({ passenger_count: 9, pickup_location: "Changed after quote snapshot" })
      .eq("id", o.ride_request_id),
  );
  const results = await Promise.all(Array.from({ length: 8 }, () => access(o, true)));
  const references = results.map((r) => ok(r).bookingReference);
  assert.equal(new Set(references).size, 1);
  assert.ok(references[0]);
  const bookings = ok(await admin.from("bookings").select("*").eq("quote_id", o.quoteId));
  assert.equal(bookings.length, 1);
  const b = bookings[0];
  assert.equal(b.status, "PENDING");
  assert.equal(b.final_amount, 125.5);
  assert.equal(b.passenger_count, 2);
  assert.equal(b.pickup_location, "TEST ONLY Airport");
  assert.equal(b.customer_id, o.quote.customer_id);
  assert.equal(b.confirmed_at, null);
  assert.deepEqual(ok(await other.from("bookings").select("id").eq("id", b.id)), []);
  assert.deepEqual(ok(await anon.from("bookings").select("id").eq("id", b.id)), []);
  assert.deepEqual(ok(await other.from("quotes").select("id").eq("id", o.quoteId)), []);
  const acts = ok(
    await admin
      .from("activities")
      .select("id")
      .in("entity_id", [o.quoteId, b.id])
      .in("description", [
        "Customer accepted exact quote version",
        "Pending booking created from customer acceptance",
      ]),
  );
  assert.equal(acts.length, 2);
  // Duplicate verified delivery events stay harmless even after acceptance.
  ok(
    await admin.rpc("record_quote_delivery", {
      _link_id: o.linkId,
      _provider_email_id: o.providerId,
    }),
  );
});
test("staff revocation, expiry, changed review and cancelled quotes reject acceptance", async () => {
  const revoked = await offer();
  ok(await staff.rpc("revoke_quote_acceptance", { _link_id: revoked.linkId }));
  assert.ok((await access(revoked, true)).error);
  const reviewed = await offer();
  ok(await admin.from("leads").update({ status: "SPAM" }).eq("id", reviewed.lead_id));
  assert.ok((await access(reviewed, true)).error);
  const cancelled = await offer();
  ok(await admin.from("quotes").update({ status: "CANCELLED" }).eq("id", cancelled.quoteId));
  assert.ok((await access(cancelled, true)).error);
  const expired = await offer();
  const result =
    sql(`BEGIN; UPDATE public.quote_acceptance_links SET expires_at=now()-interval '1 second' WHERE id='${expired.linkId}';
    DO $$ BEGIN BEGIN PERFORM public.customer_quote_acceptance('${expired.tokenHash}',true); RAISE EXCEPTION 'expected missing';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'link unavailable' THEN RAISE; END IF; END; END $$;
    SELECT 'expired rejected'; ROLLBACK;`);
  assert.ok(result.endsWith("expired rejected"));
});
test("late acceptance activity failure rolls back booking, acceptance proof and quote transition", async () => {
  const o = await offer();
  const result = sql(`BEGIN;
    CREATE FUNCTION pg_temp.acceptance_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'acceptance injected failure'; END $$;
    CREATE TRIGGER acceptance_test_failure BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.acceptance_fail();
    DO $$ BEGIN BEGIN PERFORM public.customer_quote_acceptance('${o.tokenHash}',true); RAISE EXCEPTION 'expected failure missing';
      EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'acceptance injected failure' THEN RAISE; END IF; END;
      IF EXISTS(SELECT 1 FROM public.bookings WHERE quote_id='${o.quoteId}') OR EXISTS(SELECT 1 FROM public.quote_acceptance_links WHERE id='${o.linkId}' AND accepted_at IS NOT NULL)
      OR EXISTS(SELECT 1 FROM public.quotes WHERE id='${o.quoteId}' AND status <> 'SENT') THEN RAISE EXCEPTION 'partial acceptance survived'; END IF;
    END $$; SELECT 'acceptance rollback verified'; ROLLBACK;`);
  assert.ok(result.endsWith("acceptance rollback verified"));
});
test("legacy conflicting booking cannot be silently reused as customer acceptance", async () => {
  const o = await offer();
  ok(
    await admin.from("bookings").insert({
      business_unit_id: bu,
      customer_id: o.quote.customer_id,
      ride_request_id: o.ride_request_id,
      quote_id: o.quoteId,
      booking_number: "TEST-" + randomUUID(),
      pickup_location: "Synthetic legacy",
      dropoff_location: "Hotel",
      travel_date: "2099-11-06",
      passenger_count: 1,
      status: "PENDING",
    }),
  );
  assert.ok((await access(o, true)).error);
  assert.equal(
    ok(await admin.from("quotes").select("status").eq("id", o.quoteId).single()).status,
    "SENT",
  );
  assert.equal(
    ok(await admin.from("quote_acceptance_links").select("accepted_at").eq("id", o.linkId).single())
      .accepted_at,
    null,
  );
});

test("real local browser previews without accepting, strips the fragment and creates one pending booking on explicit acceptance", async () => {
  const o = await offer();
  const appUrl = "http://127.0.0.1:56500";
  const server = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "56500",
      "--strictPort",
    ],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=384",
        SUPABASE_PROJECT_ID: project,
        VITE_SUPABASE_PROJECT_ID: project,
        SUPABASE_URL: status.API_URL,
        VITE_SUPABASE_URL: status.API_URL,
        SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
        VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
      },
    },
  );
  let browser,
    stage = "app startup";
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error("Local app startup failed");
      try {
        if ((await fetch(appUrl)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(1000);
    }
    assert.ok(ready);
    const { chromium } = await import(
      pathToFileURL(
        "C:/Users/padar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
      ).href
    );
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route("**/*", (route) =>
      [appUrl, status.API_URL].includes(new URL(route.request().url()).origin)
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    stage = "read-only preview";
    await page.goto(`${appUrl}/quote/accept#token=${o.token}`);
    await page.getByText("USD 125.50", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(ok(await admin.from("bookings").select("id").eq("quote_id", o.quoteId)).length, 0);
    assert.equal(
      await page.getByRole("button", { name: "Accept quote", exact: true }).isDisabled(),
      true,
    );
    stage = "explicit customer acceptance";
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Accept quote", exact: true }).click();
    await page.getByText(/Quote accepted\. Booking reference:/).waitFor();
    assert.equal(ok(await admin.from("bookings").select("*").eq("quote_id", o.quoteId)).length, 1);
    stage = "idempotent revisit";
    await page.goto(`${appUrl}/quote/accept#token=${o.token}`);
    await page.getByText(/Quote accepted\. Booking reference:/).waitFor();
    assert.equal(ok(await admin.from("bookings").select("*").eq("quote_id", o.quoteId)).length, 1);
  } catch {
    // No Playwright URLs, request bodies, capability tokens or keys in failure logs.
    throw new Error(
      `Isolated acceptance browser check failed during ${stage}; sensitive diagnostics withheld.`,
    );
  } finally {
    await browser?.close();
    server.kill();
  }
});

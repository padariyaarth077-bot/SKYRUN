import { setTimeout as delay } from "node:timers/promises";
// Prepared integration coverage. Requires separate approval and an already-applied local migration.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
assert.equal(
  process.env.SKYRUN_PHASE4_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 4 isolated test approval is required",
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

const booking = async () => {
  const o = await offer();
  const accepted = ok(await access(o, true));
  const b = ok(await admin.from("bookings").select("*").eq("quote_id", o.quoteId).single());
  assert.equal(b.status, "PENDING");
  assert.equal(b.required_deposit_amount, null);
  assert.equal(accepted.bookingReference, b.booking_number);
  return { ...b, offer: o };
};
const get = async (b) => ok(await admin.from("bookings").select("*").eq("id", b.id).single());
const args = (b, action, payload = {}, id = randomUUID()) => ({
  _booking_id: b.id,
  _operation_id: id,
  _action: action,
  _payload: payload,
  _expected_updated_at: b.updated_at,
});
const act = async (b, action, payload = {}, who = staff) => {
  const current = await get(b);
  return who.rpc("phase4_booking_action", args(current, action, payload));
};
async function receipt(b, amount = "30.00", reference = randomUUID()) {
  const id = randomUUID();
  ok(
    await staff.rpc(
      "phase4_booking_action",
      args(
        await get(b),
        "receipt",
        {
          amount,
          reference,
          currency: "USD",
          receivedAt: new Date(Date.now() - 60000).toISOString(),
        },
        id,
      ),
    ),
  );
  return id;
}
const verify = (b, id) => act(b, "verify", { receiptId: id, attested: true });
const reverse = (b, id) =>
  act(b, "reverse", { receiptId: id, reason: "TEST ONLY external correction" });

test("missing requirement blocks confirmation; explicit zero is audited, idempotent and preserves accepted terms", async () => {
  const b = await booking();
  assert.ok((await act(b, "confirm")).error);
  const a = args(await get(b), "requirement", { amount: "0.00" });
  ok(await staff.rpc("phase4_booking_action", a));
  ok(await staff.rpc("phase4_booking_action", a));
  const c = args(await get(b), "confirm");
  const results = await Promise.all(
    Array.from({ length: 5 }, () => staff.rpc("phase4_booking_action", c)),
  );
  results.forEach(ok);
  const saved = await get(b);
  assert.equal(saved.status, "CONFIRMED");
  assert.ok(saved.confirmed_at);
  for (const field of [
    "quote_id",
    "customer_id",
    "ride_request_id",
    "pickup_location",
    "dropoff_location",
    "travel_date",
    "pickup_time",
    "passenger_count",
    "final_amount",
    "currency",
  ])
    assert.equal(saved[field], b[field]);
  const events = ok(await admin.from("activities").select("*").eq("entity_id", b.id));
  assert.equal(events.filter((e) => e.activity_type === "BOOKING_CONFIRMED").length, 1);
  assert.ok(events.find((e) => e.activity_type === "BOOKING_CONFIRMED").actor_id);
  assert.equal((await access(b.offer, true)).data.bookingReference, b.booking_number);
  assert.equal(ok(await admin.from("bookings").select("id").eq("quote_id", b.quote_id)).length, 1);
});

test("partial receipts require actual verification, matching currency, exact amounts, and unique tenant references", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "60.00" }));
  assert.ok(
    (
      await act(b, "receipt", {
        amount: "20.001",
        currency: "USD",
        reference: randomUUID(),
        receivedAt: new Date().toISOString(),
      })
    ).error,
  );
  assert.ok(
    (
      await act(b, "receipt", {
        amount: "20",
        currency: "EUR",
        reference: randomUUID(),
        receivedAt: new Date().toISOString(),
      })
    ).error,
  );
  const ref = randomUUID(),
    r1 = await receipt(b, "30.00", ref);
  assert.ok((await act(b, "confirm")).error);
  assert.ok((await act(b, "requirement", { amount: "0" })).error);
  assert.ok(
    await receipt(b, "30", ref).then(
      () => false,
      () => true,
    ),
  );
  const r2 = await receipt(b, "30.00");
  ok(await verify(b, r1));
  assert.ok((await act(b, "confirm")).error);
  assert.ok((await act(b, "verify", { receiptId: r2, attested: false })).error);
  ok(await verify(b, r2));
  ok(await act(b, "confirm"));
  ok(await reverse(b, r1));
  assert.equal((await get(b)).status, "CONFIRMED");
  assert.equal(
    ok(await admin.from("booking_deposit_reversals").select("*").eq("booking_id", b.id)).length,
    1,
  );
  assert.ok((await reverse(b, r1)).error);
});

test("reversed receipts do not count; pending receipts remain ineligible", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "30" }));
  const r = await receipt(b);
  ok(await verify(b, r));
  ok(await reverse(b, r));
  assert.ok((await act(b, "confirm")).error);
  assert.equal((await get(b)).status, "PENDING");
});

test("every restricted role, roleless, cross-tenant and mixed-role staff is denied with real local JWTs", async () => {
  const b = await booking();
  for (const c of [other, ordinary, anon, admin])
    assert.ok((await act(b, "requirement", { amount: "0" }, c)).error);
  for (const role of ["SUPPORT", "DISPATCHER", "CONTENT_MANAGER"]) {
    const c = await identity(role, bu);
    assert.ok((await act(b, "requirement", { amount: "0" }, c)).error);
  }
  const mixed = await identity("ADMIN", bu);
  const uid = ok(await mixed.auth.getUser()).user.id;
  ok(
    await admin.from("user_roles").insert({ user_id: uid, business_unit_id: bu, role: "SUPPORT" }),
  );
  assert.ok((await act(b, "requirement", { amount: "0" }, mixed)).error);
  const manager = await identity("MANAGER", bu);
  ok(await act(b, "requirement", { amount: "0" }, manager));
  assert.deepEqual(
    ok(await other.from("booking_deposit_receipts").select("*").eq("booking_id", b.id)),
    [],
  );
});

test("direct writes and forged generic activities cannot bypass workflow; ordinary notes still work", async () => {
  const b = await booking();
  assert.ok((await staff.from("bookings").update({ status: "CONFIRMED" }).eq("id", b.id)).error);
  assert.ok(
    (
      await staff.from("bookings").insert({
        business_unit_id: bu,
        customer_id: b.customer_id,
        booking_number: randomUUID(),
        pickup_location: "x",
        dropoff_location: "y",
        travel_date: "2099-11-06",
        passenger_count: 1,
      })
    ).error,
  );
  assert.ok((await staff.from("booking_deposit_receipts").insert({ id: randomUUID() })).error);
  assert.ok(
    (
      await staff.from("activities").insert({
        business_unit_id: bu,
        entity_type: "booking",
        entity_id: b.id,
        activity_type: "BOOKING_CONFIRMED",
        description: "forged",
      })
    ).error,
  );
  for (const type of ["BOOKING_CONFIRMED", "DEPOSIT_VERIFIED", "STATUS_CHANGE"])
    assert.ok(
      (
        await staff.rpc("log_activity", {
          _entity_type: "booking",
          _entity_id: b.id,
          _activity_type: type,
          _description: "forged",
          _metadata: {},
        })
      ).error,
    );
  assert.ok(
    (
      await staff.rpc("log_activity", {
        _entity_type: "lead",
        _entity_id: b.offer.lead_id,
        _activity_type: "NOTE",
        _description: "forged",
        _metadata: { phase4_operation_id: randomUUID() },
      })
    ).error,
  );
  ok(
    await staff.rpc("log_activity", {
      _entity_type: "booking",
      _entity_id: b.id,
      _activity_type: "NOTE",
      _description: "TEST ONLY ordinary note",
      _metadata: {},
    }),
  );
});

test("confirmation versus reversal serializes; reversal never rewrites booking history", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "30" }));
  const r = await receipt(b);
  ok(await verify(b, r));
  const current = await get(b);
  const results = await Promise.all([
    staff.rpc("phase4_booking_action", args(current, "confirm")),
    staff.rpc(
      "phase4_booking_action",
      args(current, "reverse", { receiptId: r, reason: "TEST ONLY race" }),
    ),
  ]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  if ((await get(b)).status === "CONFIRMED") ok(await reverse(b, r));
  else assert.ok((await act(b, "confirm")).error);
  const events = ok(await admin.from("activities").select("*").eq("entity_id", b.id));
  assert.ok(events.some((e) => e.activity_type === "DEPOSIT_REVERSED"));
});

test("cancellation requires reason and actor/time; completion requires attestation; terminal bookings cannot reopen", async () => {
  const pending = await booking();
  assert.ok((await act(pending, "cancel", { reason: "  " })).error);
  ok(await act(pending, "cancel", { reason: "TEST ONLY cancellation" }));
  const cancelled = await get(pending);
  assert.equal(cancelled.status, "CANCELLED");
  assert.ok(cancelled.cancelled_at);
  const events = ok(
    await admin
      .from("activities")
      .select("*")
      .eq("entity_id", pending.id)
      .eq("activity_type", "BOOKING_CANCELLED"),
  );
  assert.equal(events.length, 1);
  assert.ok(events[0].actor_id);
  assert.equal(events[0].metadata.payload.reason, "TEST ONLY cancellation");
  assert.ok((await act(pending, "confirm")).error);
  assert.ok((await act(pending, "complete", { attested: true })).error);
  const b = await booking();
  ok(await act(b, "requirement", { amount: "0" }));
  ok(await act(b, "confirm"));
  assert.ok((await act(b, "complete", { attested: false })).error);
  ok(await act(b, "complete", { attested: true }));
  assert.ok((await get(b)).completed_at);
  assert.ok((await act(b, "cancel", { reason: "reopen" })).error);
});

test("late activity failure rolls back deposit requirement and state together", async () => {
  const b = await booking();
  const uid = ok(await staff.auth.getUser()).user.id;
  const result = sql(
    `BEGIN; CREATE FUNCTION pg_temp.fail_phase4() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.activity_type='DEPOSIT_REQUIREMENT_SET' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_phase4 BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_phase4(); SELECT set_config('request.jwt.claim.sub','${uid}',true); DO $$ BEGIN BEGIN PERFORM public.phase4_booking_action('${b.id}','${randomUUID()}','requirement','{"amount":"0"}'::jsonb,'${b.updated_at}'); RAISE EXCEPTION 'failure missing'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'injected failure' THEN RAISE; END IF; END; IF EXISTS(SELECT 1 FROM public.bookings WHERE id='${b.id}' AND required_deposit_amount IS NOT NULL) THEN RAISE EXCEPTION 'partial state'; END IF; END $$; SELECT 'atomic rollback verified'; ROLLBACK;`,
  );
  assert.ok(result.endsWith("atomic rollback verified"));
});

test("real isolated staff browser records, verifies and confirms a deposit, then completes with persisted audit", async () => {
  const b = await booking();
  const email = randomUUID() + "@phase4.example.test",
    password = randomUUID() + randomUUID();
  const u = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  ok(
    await admin.from("user_roles").insert({ user_id: u.id, business_unit_id: bu, role: "MANAGER" }),
  );
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
        QUOTE_EMAIL_MODE: "disabled",
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
    stage = "startup";
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null) throw Error();
      try {
        if ((await fetch(appUrl)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(1000);
    }
    assert.ok(ready);
    const { chromium } =
      await import("file:///C:/Users/padar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route("**/*", (route) =>
      [appUrl, status.API_URL].includes(new URL(route.request().url()).origin)
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    stage = "staff login";
    await page.goto(appUrl + "/j1s30MRp_geRZtdPP860Rw/");
    await page.waitForFunction(() => {
      const input = document.querySelector('input[type="email"]');
      return input && Object.keys(input).some((k) => k.startsWith("__reactProps$"));
    });
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/admin");
    await page.goto(appUrl + "/admin/booking/" + b.id);
    await page.getByLabel("Booking action").waitFor();
    stage = "explicit requirement";
    await page.getByLabel("Deposit amount").fill("30.00");
    await page.getByRole("button", { name: "Save booking action" }).click();
    await page.getByText("Required: USD 30.00", { exact: true }).waitFor();
    stage = "unverified receipt";
    await page.getByLabel("Booking action").selectOption("receipt");
    await page.getByLabel("Deposit amount").fill("30.00");
    await page.getByLabel("External transaction reference").fill("TEST ONLY " + randomUUID());
    await page.getByLabel("Received date and time").fill("2026-10-18T12:00");
    await page.getByRole("button", { name: "Save booking action" }).click();
    await page.getByText(/Unverified — does not count/).waitFor();
    stage = "verification";
    await page.getByLabel("Booking action").selectOption("verify");
    const receiptRow = ok(
      await admin.from("booking_deposit_receipts").select("*").eq("booking_id", b.id).single(),
    );
    await page.getByLabel("Receipt", { exact: true }).selectOption(receiptRow.id);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save booking action" }).click();
    await page.getByText(/Verified by/).waitFor();
    stage = "confirmation";
    await page.getByLabel("Booking action").selectOption("confirm");
    await page.getByRole("button", { name: "Save booking action" }).click();
    await page.getByText(/^confirmed$/i).waitFor();
    assert.equal((await get(b)).status, "CONFIRMED");
    stage = "completion";
    await page.getByLabel("Booking action").selectOption("complete");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save booking action" }).click();
    await page.getByText(/^completed$/i).waitFor();
    stage = "completed booking reload";
    await page.reload();
    await page.getByText(/^completed$/i).waitFor();
    assert.equal((await get(b)).status, "COMPLETED");
    stage = "completed booking activity";
    const events = ok(
      await admin.from("activities").select("*").eq("entity_id", b.id).eq("actor_id", u.id),
    );
    assert.equal(events.filter((e) => e.metadata.authoritative === true).length, 5);
  } catch {
    throw new Error(
      "Local Phase 4 browser failed during " + stage + "; sensitive diagnostics withheld.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
});

test("completion and cancellation race has one winner; unsupported lifecycle states remain read-only", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "0" }));
  ok(await act(b, "confirm"));
  const current = await get(b);
  const results = await Promise.all([
    staff.rpc(
      "phase4_booking_action",
      args(current, "cancel", { reason: "TEST ONLY concurrent cancellation" }),
    ),
    staff.rpc("phase4_booking_action", args(current, "complete", { attested: true })),
  ]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  const saved = await get(b);
  assert.ok(["COMPLETED", "CANCELLED"].includes(saved.status));
  for (const status of ["ASSIGNED", "DRIVER_ASSIGNED", "IN_PROGRESS", "NO_SHOW"]) {
    const legacy = await booking();
    ok(await admin.from("bookings").update({ status }).eq("id", legacy.id));
    assert.ok((await act(legacy, "cancel", { reason: "TEST ONLY" })).error);
    assert.ok((await act(legacy, "complete", { attested: true })).error);
  }
});

test("wrong-currency legacy evidence cannot satisfy deposit; controlled evidence and booking edits are denied", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "30" }));
  const r = await receipt(b);
  ok(await verify(b, r));
  assert.ok(
    (await staff.from("booking_deposit_receipts").update({ amount: 999 }).eq("id", r)).error,
  );
  assert.ok((await staff.from("booking_deposit_receipts").delete().eq("id", r)).error);
  assert.ok(
    (
      await staff
        .from("bookings")
        .update({ currency: "EUR", final_amount: 0, customer_id: randomUUID() })
        .eq("id", b.id)
    ).error,
  );
  const uid = ok(await staff.auth.getUser()).user.id,
    current = await get(b);
  const output = sql(
    `BEGIN; UPDATE public.booking_deposit_receipts SET currency='EUR' WHERE id='${r}'; SELECT set_config('request.jwt.claim.sub','${uid}',true); DO $$ BEGIN BEGIN PERFORM public.phase4_booking_action('${b.id}','${randomUUID()}','confirm','{}','${current.updated_at}'); RAISE EXCEPTION 'expected missing'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'verified deposit insufficient' THEN RAISE; END IF; END; END $$; SELECT 'wrong currency excluded'; ROLLBACK;`,
  );
  assert.ok(output.endsWith("wrong currency excluded"));
});

test("operation IDs cannot change payload and authorization cannot combine an admin role in another tenant", async () => {
  const b = await booking();
  const a = args(await get(b), "requirement", { amount: "10" });
  ok(await staff.rpc("phase4_booking_action", a));
  assert.ok((await staff.rpc("phase4_booking_action", { ...a, _payload: { amount: "0" } })).error);
  const c = await identity("SUPPORT", bu),
    uid = ok(await c.auth.getUser()).user.id;
  const otherUnit = ok(await other.auth.getUser()).user.id;
  const role = ok(
    await admin.from("user_roles").select("business_unit_id").eq("user_id", otherUnit).single(),
  );
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: uid, business_unit_id: role.business_unit_id, role: "ADMIN" }),
  );
  assert.ok((await act(b, "requirement", { amount: "0" }, c)).error);
  assert.ok((await act(b, "requirement", { amount: "0", authoritative: true })).error);
});

test("trusted SUPER_ADMIN can act cross-tenant; anonymous cannot execute workflow functions", async () => {
  const b = await booking();
  const elevated = await identity("SUPER_ADMIN", null);
  ok(await act(b, "requirement", { amount: "0" }, elevated));
  assert.ok((await anon.rpc("can_manage_booking", { _business_unit_id: bu })).error);
  const uid = ok(await elevated.auth.getUser()).user.id;
  assert.equal(ok(await elevated.rpc("can_manage_booking", { _business_unit_id: bu })), true);
  assert.ok(uid);
});

test("hosted-like broad grants are removed, including whole-table and trigger privileges", () => {
  const result = JSON.parse(
    sql(
      `SELECT jsonb_agg(jsonb_build_object('table',c.relname,'role',r.name,'privilege',p.name,'allowed',has_table_privilege(r.name,c.oid,p.name))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'))r(name) CROSS JOIN (VALUES('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(name) WHERE n.nspname='public' AND c.relname IN ('bookings','activities');`,
    ),
  );
  assert.ok(result.length > 0);
  assert.ok(result.every((row) => row.allowed === false));
  assert.equal(
    sql(
      `SELECT has_table_privilege('authenticated','public.bookings','SELECT') AND has_table_privilege('authenticated','public.activities','SELECT') AND NOT has_table_privilege('anon','public.bookings','SELECT') AND NOT has_function_privilege('anon','public.log_activity(text,uuid,text,text,jsonb)','EXECUTE');`,
    ),
    "t",
  );
  for (const privilege of ["TRUNCATE", "TRIGGER", "REFERENCES", "MAINTAIN"])
    assert.equal(
      sql(`SELECT has_table_privilege('authenticated','public.user_roles','${privilege}');`),
      "f",
    );
});

test("staff cannot replace, add or delete their roles, and scoped team reads remain available", async () => {
  for (const role of ["SUPPORT", "DISPATCHER", "CONTENT_MANAGER", "ADMIN", "MANAGER"]) {
    const c = await identity(role, bu),
      uid = ok(await c.auth.getUser()).user.id;
    const own = ok(await c.from("user_roles").select("*").eq("user_id", uid).single());
    const update = await c
      .from("user_roles")
      .update({ role: "ADMIN" })
      .eq("id", own.id)
      .select("id");
    assert.deepEqual(ok(update), []);
    assert.ok(
      (await c.from("user_roles").insert({ user_id: uid, business_unit_id: bu, role: "ADMIN" }))
        .error,
    );
    assert.deepEqual(ok(await c.from("user_roles").delete().eq("id", own.id).select("id")), []);
    assert.equal(
      ok(await admin.from("user_roles").select("role").eq("id", own.id).single()).role,
      role,
    );
    const visible = ok(await c.from("user_roles").select("user_id,business_unit_id"));
    assert.ok(visible.some((r) => r.user_id === uid));
    assert.ok(visible.every((r) => r.business_unit_id === bu));
  }
});

test("only trusted SUPER_ADMIN manages scoped roles and restricted users cannot edit another tenant", async () => {
  const elevated = await identity("SUPER_ADMIN", null),
    target = await identity("SUPPORT", bu),
    uid = ok(await target.auth.getUser()).user.id;
  const row = ok(await elevated.from("user_roles").select("*").eq("user_id", uid).single());
  assert.deepEqual(
    ok(await other.from("user_roles").update({ role: "ADMIN" }).eq("id", row.id).select("id")),
    [],
  );
  assert.deepEqual(
    ok(await staff.from("user_roles").update({ role: "ADMIN" }).eq("id", row.id).select("id")),
    [],
  );
  assert.equal(
    ok(
      await elevated
        .from("user_roles")
        .update({ role: "MANAGER" })
        .eq("id", row.id)
        .select("role")
        .single(),
    ).role,
    "MANAGER",
  );
  const assigned = ok(
    await elevated
      .from("user_roles")
      .insert({ user_id: uid, business_unit_id: bu, role: "ADMIN" })
      .select("id")
      .single(),
  );
  assert.equal(
    ok(await elevated.from("user_roles").delete().eq("id", assigned.id).select("id")).length,
    1,
  );
  assert.ok(
    (
      await anon.rpc("log_activity", {
        _entity_type: "booking",
        _entity_id: randomUUID(),
        _activity_type: "NOTE",
        _description: "TEST ONLY",
        _metadata: {},
      })
    ).error,
  );
});

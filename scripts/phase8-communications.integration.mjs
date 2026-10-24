// Prepared integration coverage. Requires separate approval and an already-applied local migration.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
assert.equal(
  process.env.SKYRUN_PHASE8_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 8 isolated test approval is required",
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
  sql("SELECT to_regprocedure('public.phase8_snapshot()') IS NOT NULL;"),
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
      name: "TEST ONLY Phase8 other",
      slug: "phase8-" + unit,
      business_type: "LIMO",
    }),
  );
  staff = await identity("ADMIN", bu);
  other = await identity("ADMIN", unit);
  ordinary = await identity("SUPPORT", bu);
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

const snapshot = async (who = staff) => ok(await who.rpc("phase8_snapshot"));
const events = async (source, who = staff) =>
  ok(await who.from("staff_notifications").select("*").eq("source_key", source));
const prefs = {
  in_app: true,
  sound: true,
  volume: 0.4,
  normal: true,
  important: true,
  urgent: true,
  categories: {},
  email_urgent: false,
};
test("authoritative enquiry retries create one personal notification with scoped RLS", async () => {
  const o = await offer();
  const own = await events("lead/" + o.lead_id);
  assert.equal(own.length, 1);
  assert.equal(own[0].kind, "RIDE_ENQUIRY");
  assert.equal((await events("lead/" + o.lead_id, other)).length, 0);
  assert.equal((await events("lead/" + o.lead_id, ordinary)).length, 1);
  assert.ok((await anon.from("staff_notifications").select("*")).error);
  assert.ok((await staff.from("staff_notifications").insert({ title: "forged" })).error);
  assert.ok((await staff.rpc("phase8_claim", { _attempt: randomUUID() })).error);
  const key = randomUUID();
  const rr = ok(await admin.from("ride_requests").select("*").eq("id", o.ride_request_id).single());
  // Stable first-party retry uses the original persisted submission key and customer fields.
  const cu = ok(await admin.from("customers").select("*").eq("id", rr.customer_id).single());
  const retry = {
    _business_unit_id: bu,
    _submission_key: rr.submission_key,
    _name: cu.full_name,
    _email: cu.email,
    _phone: cu.phone,
    _subject: "TEST ONLY NO CUSTOMER CONTACT",
    _service: "Airport transfer",
    _pickup_location: rr.pickup_location,
    _dropoff_location: rr.dropoff_location,
    _travel_date: rr.travel_date,
    _pickup_time: rr.pickup_time,
    _passenger_count: rr.passenger_count,
    _vehicle_preference: "",
    _notes: "Synthetic isolated retry",
  };
  ok(await admin.rpc("create_ride_enquiry", retry));
  assert.equal((await events("lead/" + o.lead_id)).length, 1);
});
test("quote acceptance emits one combined pending-booking alert under concurrent retries", async () => {
  const o = await offer();
  const accepted = await Promise.all(Array.from({ length: 4 }, () => access(o, true)));
  accepted.forEach(ok);
  const b = ok(await admin.from("bookings").select("*").eq("quote_id", o.quoteId).single());
  const n = ok(await staff.from("staff_notifications").select("*").eq("entity_id", b.id));
  assert.equal(n.length, 1);
  assert.equal(n[0].kind, "BOOKING_CREATED");
  assert.equal(
    (await ordinary.from("staff_notifications").select("*").eq("entity_id", b.id)).data.length,
    0,
  );
});
test("read-all is race-safe and preferences are own-user validated, persisted and audited", async () => {
  const first = await snapshot();
  const o = await offer();
  ok(await staff.rpc("phase8_user_action", { _action: "read_all", _through: first.through }));
  assert.equal((await events("lead/" + o.lead_id))[0].read_at, null);
  const n = (await events("lead/" + o.lead_id))[0];
  ok(await staff.rpc("phase8_user_action", { _action: "read", _id: n.id }));
  assert.ok((await events("lead/" + o.lead_id))[0].read_at);
  ok(await staff.rpc("phase8_user_action", { _action: "preferences", _preferences: prefs }));
  ok(await staff.rpc("phase8_user_action", { _action: "preferences", _preferences: prefs }));
  assert.equal((await snapshot()).preferences.volume, 0.4);
  assert.ok(
    (
      await staff.rpc("phase8_user_action", {
        _action: "preferences",
        _preferences: { ...prefs, user_id: randomUUID() },
      })
    ).error,
  );
  assert.ok(
    (
      await staff.rpc("log_activity", {
        _entity_type: "profile",
        _entity_id: ok(await staff.auth.getUser()).user.id,
        _activity_type: "NOTIFICATION_PREFERENCES_UPDATED",
        _description: "forged",
        _metadata: {},
      })
    ).error,
  );
});
test("mixed roles and revoked scope cannot read previously created payloads", async () => {
  const mixed = await identity("ADMIN", bu);
  const id = ok(await mixed.auth.getUser()).user.id;
  const o = await offer();
  assert.equal((await events("lead/" + o.lead_id, mixed)).length, 1);
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: id, business_unit_id: bu, role: "CONTENT_MANAGER" }),
  );
  assert.equal((await events("lead/" + o.lead_id, mixed)).length, 0);
});
test("customer messages and handoff persist alerts, staff replies never emit customer-message alerts", async () => {
  const token = createHash("sha256").update(randomBytes(32)).digest("hex");
  const c = ok(
    await admin.rpc("chat_start_conversation", {
      _business_unit_id: bu,
      _session_token_hash: token,
    }),
  );
  const op = randomUUID();
  for (let i = 0; i < 2; i++)
    ok(
      await admin.rpc("chat_send_message", {
        _session_token_hash: token,
        _operation_id: op,
        _message: "TEST ONLY customer",
        _reply: "TEST ONLY bot",
      }),
    );
  let rows = ok(await ordinary.from("staff_notifications").select("*").eq("entity_id", c));
  assert.equal(rows.filter((n) => n.kind === "CHAT_MESSAGE").length, 1);
  for (let i = 0; i < 2; i++)
    ok(await admin.rpc("chat_request_handoff", { _session_token_hash: token }));
  rows = ok(await ordinary.from("staff_notifications").select("*").eq("entity_id", c));
  assert.equal(rows.filter((n) => n.kind === "CHAT_HANDOFF").length, 1);
  ok(
    await ordinary.rpc("chat_staff_action", {
      _conversation_id: c,
      _operation_id: randomUUID(),
      _action: "claim",
      _message: "",
    }),
  );
  ok(
    await ordinary.rpc("chat_staff_action", {
      _conversation_id: c,
      _operation_id: randomUUID(),
      _action: "reply",
      _message: "TEST ONLY staff",
    }),
  );
  assert.equal(
    ok(await ordinary.from("staff_notifications").select("*").eq("entity_id", c)).filter(
      (n) => n.kind === "CHAT_MESSAGE",
    ).length,
    1,
  );
});
test("failed business operations leave no notification or email; confirmed booking queues immutable recipient snapshot", async () => {
  const b = await booking();
  assert.ok((await act(b, "confirm")).error);
  assert.equal(
    ok(await staff.from("communication_outbox").select("*").eq("entity_id", b.id)).length,
    0,
  );
  ok(await act(b, "requirement", { amount: "0" }));
  const version = await get(b);
  const op = randomUUID();
  const results = await Promise.all([
    staff.rpc("phase4_booking_action", args(version, "confirm", {}, op)),
    staff.rpc("phase4_booking_action", args(version, "confirm", {}, op)),
  ]);
  results.forEach(ok);
  const c = ok(await staff.from("communication_outbox").select("*").eq("entity_id", b.id).single());
  assert.equal(c.kind, "BOOKING_CONFIRMED");
  assert.equal(c.payload.status, "CONFIRMED");
  assert.equal(c.state, "QUEUED");
  assert.ok(c.recipient.endsWith("@acceptance.example.test"));
  assert.equal(
    (await other.from("communication_outbox").select("*").eq("id", c.id)).data.length,
    0,
  );
  assert.equal(
    (await ordinary.from("communication_outbox").select("*").eq("id", c.id)).data.length,
    0,
  );
  assert.ok(
    (
      await staff
        .from("communication_outbox")
        .update({ recipient: "wrong@example.test" })
        .eq("id", c.id)
    ).error,
  );
  const attempts = await Promise.all([
    admin.rpc("phase8_claim", { _attempt: randomUUID(), _id: c.id }),
    admin.rpc("phase8_claim", { _attempt: randomUUID(), _id: c.id }),
  ]);
  attempts.forEach(ok);
  const claimed = attempts.map((x) => x.data).filter(Boolean);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, c.id);
  const frozenArgs = {
    _id: c.id,
    _attempt: claimed[0].attempt_id,
    _subject: "TEST ONLY confirmed",
    _text: "TEST ONLY immutable text",
    _html: "<p>TEST ONLY immutable</p>",
  };
  const first = ok(await admin.rpc("phase8_freeze", frozenArgs));
  const second = ok(
    await admin.rpc("phase8_freeze", { ...frozenArgs, _text: "Changed deployment template" }),
  );
  assert.equal(second.text, first.text);
  assert.ok((await staff.rpc("phase8_freeze", frozenArgs)).error);
  const provider = randomUUID();
  ok(
    await admin.rpc("phase8_finish", {
      _id: c.id,
      _attempt: claimed[0].attempt_id,
      _provider: provider,
    }),
  );
  assert.equal(
    ok(await staff.from("communication_outbox").select("*").eq("id", c.id).single()).state,
    "PROVIDER_ACCEPTED",
  );
  const event = {
    _event: "TEST-" + randomUUID(),
    _provider: provider,
    _kind: "email.delivered",
    _recipient: c.recipient,
    _sender: "support@skyrunlimo.com",
    _hash: "a".repeat(64),
  };
  ok(await admin.rpc("phase8_delivery_event", event));
  ok(await admin.rpc("phase8_delivery_event", event));
  assert.equal(
    ok(await staff.from("communication_outbox").select("*").eq("id", c.id).single()).state,
    "DELIVERED",
  );
  assert.equal((await get(b)).status, "CONFIRMED");
  assert.ok((await staff.rpc("phase8_retry", { _id: c.id })).error);
});
test("late audit failure rolls back booking, notification and outbox together", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "0" }));
  const current = await get(b),
    uid = ok(await staff.auth.getUser()).user.id,
    op = randomUUID();
  const result = sql(
    `BEGIN;CREATE FUNCTION pg_temp.phase8_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${b.id}' AND NEW.kind='BOOKING_CONFIRMED' THEN RAISE EXCEPTION 'phase8 injected';END IF;RETURN NEW;END $$;CREATE TRIGGER phase8_fail BEFORE INSERT ON public.communication_outbox FOR EACH ROW EXECUTE FUNCTION pg_temp.phase8_fail();SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true);SET LOCAL ROLE authenticated;DO $$ BEGIN BEGIN PERFORM public.phase4_booking_action('${b.id}','${op}','confirm','{}','${current.updated_at}');RAISE EXCEPTION 'expected failure';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'phase8 injected' THEN RAISE;END IF;END;END $$;RESET ROLE;SELECT status FROM public.bookings WHERE id='${b.id}';ROLLBACK;`,
  );
  assert.equal(result.split("\n").at(-1), "PENDING");
  assert.equal(
    ok(await staff.from("communication_outbox").select("*").eq("entity_id", b.id)).length,
    0,
  );
});

test("bounded expired leases reconcile without a fourth provider attempt", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "0" }));
  ok(await act(b, "confirm"));
  const c = ok(await staff.from("communication_outbox").select("*").eq("entity_id", b.id).single());
  sql(
    `UPDATE public.communication_outbox SET state='PROCESSING',attempts=3,first_attempt_at=now()-interval '10 minutes',lease_until=now()-interval '1 minute',next_attempt_at=now()-interval '1 minute' WHERE id='${c.id}';`,
  );
  assert.equal(ok(await admin.rpc("phase8_claim", { _attempt: randomUUID(), _id: c.id })), null);
  assert.equal(
    ok(await staff.from("communication_outbox").select("*").eq("id", c.id).single()).state,
    "RECONCILE",
  );
  assert.equal((await get(b)).status, "CONFIRMED");
  assert.ok((await staff.rpc("phase8_retry", { _id: c.id })).error);
});
test("recipient changes cancel queued envelopes; cancellation mail retains the accepted trip snapshot", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "0" }));
  ok(await act(b, "confirm"));
  const c = ok(await staff.from("communication_outbox").select("*").eq("entity_id", b.id).single());
  // Only this synthetic customer's address is changed to exercise stale-recipient safety.
  sql(
    `UPDATE public.customers SET email='changed-${randomUUID()}@acceptance.example.test' WHERE id='${b.customer_id}';`,
  );
  assert.equal(ok(await admin.rpc("phase8_claim", { _attempt: randomUUID(), _id: c.id })), null);
  assert.equal(
    ok(await staff.from("communication_outbox").select("*").eq("id", c.id).single()).state,
    "CANCELLED",
  );
  ok(await act(b, "cancel", { reason: "TEST ONLY cancellation" }));
  const cancel = ok(
    await staff
      .from("communication_outbox")
      .select("*")
      .eq("entity_id", b.id)
      .eq("kind", "BOOKING_CANCELLED")
      .single(),
  );
  assert.equal(cancel.payload.status, "CANCELLED");
  assert.equal(cancel.payload.pickup, b.pickup_location);
  const claim = ok(await admin.rpc("phase8_claim", { _attempt: randomUUID(), _id: cancel.id }));
  assert.equal(claim.id, cancel.id);
  ok(
    await admin.rpc("phase8_finish", {
      _id: claim.id,
      _attempt: claim.attempt_id,
      _provider: null,
    }),
  );
  assert.equal((await get(b)).status, "CANCELLED");
});
test("staff urgent email requires opt-in and failures cannot form an email loop", async () => {
  ok(
    await ordinary.rpc("phase8_user_action", {
      _action: "preferences",
      _preferences: { ...prefs, email_urgent: true },
    }),
  );
  const hash = createHash("sha256").update(randomBytes(32)).digest("hex"),
    id = ok(
      await admin.rpc("chat_start_conversation", {
        _business_unit_id: bu,
        _session_token_hash: hash,
      }),
    );
  ok(await admin.rpc("chat_request_handoff", { _session_token_hash: hash }));
  const uid = ok(await ordinary.auth.getUser()).user.id;
  assert.equal(
    sql(
      `SELECT count(*) FROM public.communication_outbox WHERE entity_id='${id}' AND staff_id='${uid}' AND kind='STAFF_URGENT';`,
    ),
    "1",
  );
  sql(
    `SELECT public.phase8_emit('${bu}','TEST-loop-${id}','COMMUNICATION_FAILED','URGENT','TEST ONLY failed delivery','conversation','${id}');`,
  );
  assert.equal(
    sql(`SELECT count(*) FROM public.communication_outbox WHERE source_key='TEST-loop-${id}';`),
    "0",
  );
  ok(await ordinary.rpc("phase8_user_action", { _action: "preferences", _preferences: prefs }));
  const staffEnvelopeId = sql(
    `SELECT id FROM public.communication_outbox WHERE entity_id='${id}' AND staff_id='${uid}';`,
  );
  const claimed = ok(
    await admin.rpc("phase8_claim", { _attempt: randomUUID(), _id: staffEnvelopeId }),
  );
  assert.equal(claimed, null);
  assert.equal(
    sql(
      `SELECT state FROM public.communication_outbox WHERE entity_id='${id}' AND staff_id='${uid}';`,
    ),
    "CANCELLED",
  );
});

test(
  "real local browser observes notifications, unlocks sound, persists mute and opens exact records",
  { timeout: 180000 },
  async () => {
    const email = randomUUID() + "@acceptance.example.test",
      password = randomUUID() + randomUUID();
    const user = ok(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    ).user;
    ok(
      await admin
        .from("user_roles")
        .insert({ user_id: user.id, business_unit_id: bu, role: "ADMIN" }),
    );
    const appUrl = "http://127.0.0.1:56500",
      server = spawn(
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
            TEMP: "F:/DockerData",
            TMP: "F:/DockerData",
            COMMUNICATION_EMAIL_MODE: "disabled",
            COMMUNICATION_DISPATCH_SECRET: "",
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
      page,
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
      browser = await chromium.launch({
        headless: true,
        env: { ...process.env, TEMP: "F:/DockerData", TMP: "F:/DockerData" },
      });
      const context = await browser.newContext();
      await context.route("**/*", (route) =>
        [appUrl, status.API_URL].includes(new URL(route.request().url()).origin)
          ? route.continue()
          : route.abort(),
      );
      await context.addInitScript(() => {
        window.__phase8Audio = 0;
        const Original = window.AudioContext;
        if (Original)
          window.AudioContext = class extends Original {
            createOscillator() {
              const node = super.createOscillator(),
                start = node.start.bind(node);
              node.start = (...args) => {
                window.__phase8Audio++;
                return start(...args);
              };
              return node;
            }
          };
      });
      page = await context.newPage();
      page.setDefaultTimeout(25000);
      stage = "login";
      await page.goto(appUrl + "/j1s30MRp_geRZtdPP860Rw/");
      await page.waitForFunction(() => {
        const input = document.querySelector('input[type="email"]');
        return input && Object.keys(input).some((k) => k.startsWith("__reactProps$"));
      });
      await page.getByLabel("Email address", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("**/admin");
      stage = "sound and preferences";
      await page.goto(appUrl + "/admin/settings");
      await page.getByRole("button", { name: "Enable / test normal", exact: true }).click();
      await page
        .getByText("Audio initialized for this browser session.", { exact: true })
        .waitFor();
      assert.ok(await page.evaluate(() => window.__phase8Audio >= 2));
      const volume = page.getByLabel("Sound volume");
      await volume.press("ArrowLeft");
      await volume.press("ArrowLeft");
      await volume.press("ArrowLeft");
      assert.equal(await volume.inputValue(), "0.2");
      await page
        .getByRole("button", { name: "Save notification preferences", exact: true })
        .click();
      await page.getByText("Notification preferences saved.", { exact: true }).waitFor();
      stage = "new enquiry live arrival";
      const before = await page.evaluate(() => window.__phase8Audio);
      const o = await offer();
      await page.getByText("New ride enquiry", { exact: true }).waitFor();
      await page.locator('a[aria-label="Notifications, 1 unread"]').waitFor();
      assert.ok(await page.evaluate((previous) => window.__phase8Audio > previous, before));
      stage = "persistent history and related navigation";
      await page.locator('a[aria-label="Notifications, 1 unread"]').click();
      await page.getByRole("heading", { name: "1 unread notifications", exact: true }).waitFor();
      const related = page.getByRole("link", { name: "Open related record", exact: true });
      assert.equal(await related.getAttribute("href"), "/admin/leads/" + o.lead_id);
      await page.getByRole("button", { name: "Mark read", exact: true }).click();
      await page.getByRole("heading", { name: "0 unread notifications", exact: true }).waitFor();
      await page.reload();
      await page.getByRole("heading", { name: "0 unread notifications", exact: true }).waitFor();
      stage = "mute persists with visual updates";
      await page.goto(appUrl + "/admin/settings");
      await page.getByLabel("Notification sounds", { exact: true }).uncheck();
      await page
        .getByRole("button", { name: "Save notification preferences", exact: true })
        .click();
      await page.getByText("Notification preferences saved.", { exact: true }).waitFor();
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelector('input[type="range"]') &&
          !document.querySelector('input[type="range"]').matches(":disabled"),
      );
      assert.equal(
        await page.getByLabel("Notification sounds", { exact: true }).isChecked(),
        false,
      );
      assert.equal(await volume.inputValue(), "0.2");
      await offer();
      await page.getByText("New ride enquiry", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__phase8Audio), 0);
      stage = "responsive notification views";
      mkdirSync("F:/DockerData/phase8-verification", { recursive: true });
      await page.goto(appUrl + "/admin/m/notifications");
      await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor();
      await page.getByText("Loading notifications…", { exact: true }).waitFor({ state: "hidden" });
      await page.getByRole("heading", { name: "1 unread notifications", exact: true }).waitFor();
      for (const [name, width, height] of [
        ["desktop", 1440, 900],
        ["laptop", 1024, 768],
        ["tablet", 768, 1024],
        ["mobile", 390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        await page.screenshot({
          path: `F:/DockerData/phase8-verification/notifications-${name}.png`,
          fullPage: false,
        });
      }
      stage = "chat deep link";
      const token = createHash("sha256").update(randomBytes(32)).digest("hex"),
        chat = ok(
          await admin.rpc("chat_start_conversation", {
            _business_unit_id: bu,
            _session_token_hash: token,
          }),
        );
      ok(
        await admin.rpc("chat_send_message", {
          _session_token_hash: token,
          _operation_id: randomUUID(),
          _message: "TEST ONLY phase8 focused chat",
          _reply: "TEST ONLY bot",
        }),
      );
      await page.goto(appUrl + "/admin/chat-conversations?conversation=" + chat);
      await page.getByText("TEST ONLY phase8 focused chat", { exact: true }).last().waitFor();
      assert.ok(page.url().includes("conversation=" + chat));
    } catch {
      if (page && !page.isClosed() && stage !== "login") {
        mkdirSync("F:/DockerData/phase8-verification", { recursive: true });
        await page
          .screenshot({
            path: "F:/DockerData/phase8-verification/browser-failure.png",
            fullPage: false,
          })
          .catch(() => {});
      }
      throw Error(
        "Isolated Phase8 browser failed during " + stage + "; sensitive diagnostics withheld.",
      );
    } finally {
      await browser?.close();
      server.kill();
    }
  },
);

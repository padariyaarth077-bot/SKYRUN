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
  process.env.SKYRUN_PHASE3_DELIVERY_APPROVAL,
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
  sql(
    "SELECT to_regprocedure('public.begin_quote_delivery(uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,uuid)') IS NOT NULL;",
  ),
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
const recipient = "padariyaarth077@gmail.com",
  origin = "http://127.0.0.1:56500";
async function draft() {
  const r = ok(
    await admin.rpc("create_ride_enquiry", {
      _business_unit_id: bu,
      _submission_key: randomUUID(),
      _name: "TEST ONLY DELIVERY - NO RIDE",
      _email: recipient,
      _phone: "TEST-" + randomUUID().slice(0, 25),
      _subject: "TEST ONLY NO REAL EMAIL",
      _service: "Airport transfer",
      _pickup_location: "TEST ONLY Airport",
      _dropoff_location: "TEST ONLY Hotel",
      _travel_date: "2099-11-06",
      _pickup_time: "14:30",
      _passenger_count: 2,
      _vehicle_preference: "",
      _notes: "Synthetic local delivery fixture",
    }),
  );
  ok(await admin.from("leads").update({ status: "GENUINE" }).eq("id", r.lead_id));
  const id = randomUUID();
  ok(
    await staff.rpc("save_quote_draft", {
      _quote_id: id,
      _ride_request_id: r.ride_request_id,
      _amount: "125.50",
      _currency: "USD",
      _valid_until: new Date(Date.now() + 86400000).toISOString(),
      _notes: "TEST ONLY",
      _expected_updated_at: null,
    }),
  );
  const q = ok(await staff.from("quotes").select("*").eq("id", id).single()),
    ride = ok(await staff.from("ride_requests").select("*").eq("id", r.ride_request_id).single());
  const deliveryId = randomUUID(),
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const args = {
    _quote_id: id,
    _delivery_id: deliveryId,
    _token_hash: await hash(token),
    _expected_updated_at: q.updated_at,
    _expected_ride_updated_at: ride.updated_at,
    _reviewed_recipient: recipient,
    _public_origin: origin,
    _is_test: true,
    _attempt_id: randomUUID(),
  };
  return { q, ride, args };
}
async function event(
  providerId,
  type = "email.delivered",
  to = recipient,
  eventId = "msg_" + randomUUID(),
) {
  ok(
    await admin.rpc("store_quote_delivery_event", {
      _event_id: eventId,
      _provider_email_id: providerId,
      _event_type: type,
      _recipient: to,
      _sender: "support@skyrunlimo.com",
      _payload_hash: "ab".repeat(32),
    }),
  );
  ok(await admin.rpc("process_quote_delivery_events", { _provider_email_id: providerId }));
  return eventId;
}
before(async () => {
  const unit = randomUUID();
  ok(
    await admin.from("business_units").insert({
      id: unit,
      organization_id: "00000000-0000-0000-0000-000000000001",
      name: "TEST ONLY delivery tenant",
      slug: "delivery-" + unit,
      business_type: "LIMO",
    }),
  );
  staff = await identity("ADMIN", bu);
  other = await identity("ADMIN", unit);
  ordinary = await identity();
});
test("concurrent staff sends claim one lease and freeze one exact template without a plaintext token", async () => {
  const o = await draft();
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      staff.rpc("begin_quote_delivery", { ...o.args, _attempt_id: randomUUID() }),
    ),
  );
  assert.equal(results.map(ok).filter((r) => r.proceed).length, 1);
  const d = ok(
    await admin.from("quote_deliveries").select("*").eq("id", o.args._delivery_id).single(),
  );
  assert.equal(d.state, "IN_FLIGHT");
  assert.ok(d.message_text.includes("USD 125.50"));
  assert.ok(!d.message_text.includes("#token="));
  assert.equal(
    ok(await staff.from("quotes").select("status").eq("id", o.q.id).single()).status,
    "DRAFT",
  );
});
test("recipient/trip review and actual JWT tenant/role/private-table boundaries are enforced", async () => {
  const o = await draft();
  for (const c of [other, ordinary, anon])
    assert.ok((await c.rpc("begin_quote_delivery", o.args)).error);
  assert.ok(
    (
      await staff.rpc("begin_quote_delivery", {
        ...o.args,
        _reviewed_recipient: "other@example.test",
      })
    ).error,
  );
  assert.ok(
    (
      await staff.rpc("begin_quote_delivery", {
        ...o.args,
        _expected_ride_updated_at: "2000-01-01T00:00:00Z",
      })
    ).error,
  );
  for (const c of [staff, other, ordinary, anon]) {
    assert.ok((await c.from("quote_deliveries").select("*")).error);
    assert.ok(
      (
        await c.rpc("finish_quote_delivery", {
          _delivery_id: o.args._delivery_id,
          _attempt_id: o.args._attempt_id,
          _provider_email_id: null,
        })
      ).error,
    );
  }
});
test("ambiguous attempts retry the same saved template; provider acceptance alone never marks SENT", async () => {
  const o = await draft();
  ok(await staff.rpc("begin_quote_delivery", o.args));
  ok(
    await admin.rpc("finish_quote_delivery", {
      _delivery_id: o.args._delivery_id,
      _attempt_id: o.args._attempt_id,
      _provider_email_id: null,
    }),
  );
  const retry = { ...o.args, _attempt_id: randomUUID() };
  assert.equal(ok(await staff.rpc("begin_quote_delivery", retry)).proceed, true);
  const providerId = randomUUID();
  ok(
    await admin.rpc("finish_quote_delivery", {
      _delivery_id: retry._delivery_id,
      _attempt_id: retry._attempt_id,
      _provider_email_id: providerId,
    }),
  );
  assert.equal(
    ok(await staff.from("quotes").select("status").eq("id", o.q.id).single()).status,
    "DRAFT",
  );
  assert.ok(
    (
      await admin.rpc("customer_quote_acceptance", {
        _token_hash: o.args._token_hash,
        _accept: false,
      })
    ).error,
  );
  assert.equal(ok(await staff.rpc("begin_quote_delivery", retry)).proceed, false);
});
test("early verified-event fixtures survive the send-response race and exact replay produces no repeated activity", async () => {
  const o = await draft();
  ok(await staff.rpc("begin_quote_delivery", o.args));
  const providerId = randomUUID();
  const eventId = await event(providerId);
  ok(
    await admin.rpc("finish_quote_delivery", {
      _delivery_id: o.args._delivery_id,
      _attempt_id: o.args._attempt_id,
      _provider_email_id: providerId,
    }),
  );
  ok(await admin.rpc("process_quote_delivery_events", { _provider_email_id: providerId }));
  assert.equal(
    ok(await staff.from("quotes").select("status").eq("id", o.q.id).single()).status,
    "SENT",
  );
  const beforeActs = ok(await staff.from("activities").select("id").eq("entity_id", o.q.id)).length;
  await event(providerId, "email.delivered", recipient, eventId);
  assert.equal(
    ok(await staff.from("activities").select("id").eq("entity_id", o.q.id)).length,
    beforeActs,
  );
});
test("mismatched recipients cannot activate a link; failures win over later delivery without cancelling an accepted booking", async () => {
  const o = await draft();
  ok(await staff.rpc("begin_quote_delivery", o.args));
  const providerId = randomUUID();
  ok(
    await admin.rpc("finish_quote_delivery", {
      _delivery_id: o.args._delivery_id,
      _attempt_id: o.args._attempt_id,
      _provider_email_id: providerId,
    }),
  );
  await event(providerId, "email.delivered", "other@example.test");
  assert.ok(
    (
      await admin.rpc("customer_quote_acceptance", {
        _token_hash: o.args._token_hash,
        _accept: false,
      })
    ).error,
  );
  await event(providerId, "email.bounced");
  await event(providerId);
  assert.equal(
    ok(await admin.from("quote_deliveries").select("state").eq("id", o.args._delivery_id).single())
      .state,
    "FAILED",
  );
  assert.ok(
    (
      await admin.rpc("customer_quote_acceptance", {
        _token_hash: o.args._token_hash,
        _accept: true,
      })
    ).error,
  );
  const accepted = await draft();
  ok(await staff.rpc("begin_quote_delivery", accepted.args));
  const acceptedProvider = randomUUID();
  ok(
    await admin.rpc("finish_quote_delivery", {
      _delivery_id: accepted.args._delivery_id,
      _attempt_id: accepted.args._attempt_id,
      _provider_email_id: acceptedProvider,
    }),
  );
  await event(acceptedProvider);
  ok(
    await admin.rpc("customer_quote_acceptance", {
      _token_hash: accepted.args._token_hash,
      _accept: true,
    }),
  );
  await event(acceptedProvider, "email.complained");
  assert.equal(
    ok(await admin.from("bookings").select("status").eq("quote_id", accepted.q.id).single()).status,
    "PENDING",
  );
});
test("an ambiguous attempt beyond the provider idempotency window requires reconciliation rather than a new send", async () => {
  const o = await draft();
  ok(await staff.rpc("begin_quote_delivery", o.args));
  ok(
    await admin.rpc("finish_quote_delivery", {
      _delivery_id: o.args._delivery_id,
      _attempt_id: o.args._attempt_id,
      _provider_email_id: null,
    }),
  );
  const uid = ok(await staff.auth.getUser()).user.id;
  const result =
    sql(`BEGIN; UPDATE public.quote_deliveries SET first_attempt_at=now()-interval '24 hours' WHERE id='${o.args._delivery_id}';
    SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true);
    DO $$ BEGIN BEGIN PERFORM public.begin_quote_delivery('${o.q.id}','${o.args._delivery_id}','${o.args._token_hash}','${o.q.updated_at}','${o.ride.updated_at}','${recipient}','${origin}',true,'${randomUUID()}'); RAISE EXCEPTION 'expected missing';
      EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'delivery reconciliation required' THEN RAISE; END IF; END; END $$; SELECT 'retry window protected'; ROLLBACK;`);
  assert.ok(result.endsWith("retry window protected"));
});
test("late audit failure rolls back snapshot, outbox and send lease together", async () => {
  const o = await draft();
  const uid = ok(await staff.auth.getUser()).user.id;
  const result =
    sql(`BEGIN; CREATE FUNCTION pg_temp.delivery_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description='Staff requested quote email delivery' THEN RAISE EXCEPTION 'delivery injected failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER delivery_test_failure BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.delivery_fail();
    SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true);
    DO $$ BEGIN BEGIN PERFORM public.begin_quote_delivery('${o.q.id}','${o.args._delivery_id}','${o.args._token_hash}','${o.q.updated_at}','${o.ride.updated_at}','${recipient}','${origin}',true,'${o.args._attempt_id}'); RAISE EXCEPTION 'expected missing';
      EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'delivery injected failure' THEN RAISE; END IF; END; END $$;
    RESET ROLE; DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.quote_deliveries WHERE id='${o.args._delivery_id}') OR EXISTS(SELECT 1 FROM public.quote_acceptance_links WHERE id='${o.args._delivery_id}') THEN RAISE EXCEPTION 'partial delivery survived'; END IF; END $$; SELECT 'delivery rollback verified'; ROLLBACK;`);
  assert.ok(result.endsWith("delivery rollback verified"));
});
test("real local browser sends only after staff clicks; a signed synthetic webhook enables customer acceptance", async () => {
  const o = await draft(),
    appUrl = origin;
  const linkKey = "ab".repeat(32),
    webhookSecret = "whsec_" + btoa("a".repeat(32));
  const email = randomUUID() + "@delivery.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: user.id, business_unit_id: bu, role: "ADMIN" }),
  );
  const server = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("scripts/phase3-resend-fake.mjs")).href,
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
        QUOTE_EMAIL_MODE: "test",
        QUOTE_PUBLIC_ORIGIN: appUrl,
        QUOTE_LINK_SECRET: linkKey,
        RESEND_API_KEY: "invalid-local-fixture",
        RESEND_WEBHOOK_SECRET: webhookSecret,
      },
    },
  );
  let browser,
    stage = "startup";
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error();
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
    await context.route("**/*", (r) =>
      [appUrl, status.API_URL].includes(new URL(r.request().url()).origin)
        ? r.continue()
        : r.abort(),
    );
    const page = await context.newPage();
    stage = "staff login";
    await page.goto(`${appUrl}/j1s30MRp_geRZtdPP860Rw`);
    await page.waitForFunction(() => {
      const input = document.querySelector('input[type="password"]');
      return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"));
    });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL(/\/admin\/?$/);
    stage = "manual approval";
    await page.goto(`${appUrl}/admin/quote/${o.q.id}`);
    const button = page.getByRole("button", { name: "Send Quote", exact: true });
    await button.waitFor();
    assert.equal(await button.isDisabled(), true);
    assert.equal(
      ok(await admin.from("quote_deliveries").select("id")).filter(
        (d) => d.id === o.args._delivery_id,
      ).length,
      0,
    );
    await page.getByRole("checkbox").check();
    await button.click();
    await page.getByText(/Delivery is not yet verified/).waitFor();
    const delivery = ok(await staff.rpc("quote_delivery_status", { _quote_id: o.q.id }));
    stage = "signed local delivery event";
    const body = JSON.stringify({
        type: "email.delivered",
        data: {
          email_id: delivery.deliveryId,
          to: [recipient],
          from: "Skyrun Limo <support@skyrunlimo.com>",
        },
      }),
      id = "msg_" + randomUUID(),
      timestamp = String(Math.floor(Date.now() / 1000));
    const signing = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("a".repeat(32)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      signing,
      new TextEncoder().encode(`${id}.${timestamp}.${body}`),
    );
    assert.equal(
      (
        await fetch(appUrl + "/api/webhooks/resend", {
          method: "POST",
          body,
          headers: {
            "svix-id": id,
            "svix-timestamp": timestamp,
            "svix-signature": "v1," + btoa(String.fromCharCode(...new Uint8Array(sig))),
          },
        })
      ).status,
      204,
    );
    await page.getByRole("button", { name: "Refresh delivery status" }).click();
    await page.getByText(/Delivery to the recipient's mail server is verified/).waitFor();
    stage = "customer acceptance";
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(linkKey.match(/../g), (v) => parseInt(v, 16)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`skyrun-quote-acceptance/v1/${delivery.deliveryId}`),
      ),
      token = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    await page.goto(`${appUrl}/quote/accept#token=${token}`);
    await page.getByText("USD 125.50", { exact: true }).waitFor();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Accept quote", exact: true }).click();
    await page.getByText(/Quote accepted\. Booking reference:/).waitFor();
    assert.equal(ok(await admin.from("bookings").select("id").eq("quote_id", o.q.id)).length, 1);
  } catch {
    throw new Error(
      `Isolated delivery browser check failed during ${stage}; sensitive diagnostics withheld.`,
    );
  } finally {
    await browser?.close();
    server.kill();
  }
});

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
  process.env.SKYRUN_PHASE7_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 7 isolated test approval is required",
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
    "SELECT to_regprocedure('public.phase7_save(uuid,text,uuid,jsonb,timestamp with time zone)') IS NOT NULL;",
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
      name: "TEST ONLY Phase7 other",
      slug: "phase7-" + unit,
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

const save = (who, kind, id, payload, version = null, op = randomUUID()) =>
  who.rpc("phase7_save", {
    _operation_id: op,
    _kind: kind,
    _entity_id: id,
    _payload: payload,
    _expected_updated_at: version,
  });
const report = (who, kind, extras = {}) =>
  who.rpc("phase7_report", {
    _kind: kind,
    _from: null,
    _to: null,
    _status: "",
    _source: "",
    _search: "",
    _unit: null,
    _offset: 0,
    _limit: 50,
    ...extras,
  });
test("scoped profile settings are audited and unknown fields remain empty", async () => {
  const old = ok(
    await staff.from("document_profiles").select("*").eq("business_unit_id", bu).maybeSingle(),
  );
  const op = randomUUID(),
    payload = { legal_name: "TEST ONLY business", email: "office@phase7.example.test" };
  ok(await save(staff, "profile", bu, payload, old?.updated_at ?? null, op));
  ok(await save(staff, "profile", bu, payload, old?.updated_at ?? null, op));
  const row = ok(
    await staff.from("document_profiles").select("*").eq("business_unit_id", bu).single(),
  );
  assert.equal(row.address, "");
  assert.equal(
    sql(`SELECT count(*) FROM public.activities WHERE metadata->>'phase7_operation_id'='${op}';`),
    "1",
  );
  assert.ok(
    (
      await save(
        staff,
        "profile",
        bu,
        { ...payload, service_role_key: "forbidden" },
        row.updated_at,
      )
    ).error,
  );
});
test("support, cross-tenant, anonymous and roleless document actions fail closed", async () => {
  const b = await booking();
  for (const who of [ordinary, other, anon, await identity()])
    assert.ok((await save(who, "draft", b.id, { description: "denied" })).error);
  assert.ok((await report(ordinary, "deposits")).error);
  assert.ok((await report(anon, "enquiries")).error);
  assert.ok((await report(other, "bookings", { _unit: bu })).error);
});
test("concurrent duplicate draft actions create one immutable booking snapshot and audit", async () => {
  const b = await booking(),
    op = randomUUID(),
    payload = { description: "TEST ONLY invoice draft" };
  const results = await Promise.all([
    save(staff, "draft", b.id, payload, null, op),
    save(staff, "draft", b.id, payload, null, op),
  ]);
  assert.equal(ok(results[0]), ok(results[1]));
  const d = ok(await staff.from("invoice_drafts").select("*").eq("booking_id", b.id).single());
  assert.equal(d.amount, b.final_amount);
  assert.equal(d.currency, b.currency);
  assert.equal(d.customer_id, b.customer_id);
  assert.ok((await save(staff, "draft", b.id, { description: "conflict" }, null, op)).error);
  assert.equal(
    sql(`SELECT count(*) FROM public.activities WHERE metadata->>'phase7_operation_id'='${op}';`),
    "1",
  );
  assert.ok((await staff.from("invoice_drafts").update({ amount: 1 }).eq("id", d.id)).error);
  assert.ok(
    (
      await staff.rpc("log_activity", {
        _entity_type: "booking",
        _entity_id: b.id,
        _activity_type: "FINANCE_DRAFT_CREATED",
        _description: "forged",
        _metadata: {},
      })
    ).error,
  );
});
test("draft edits require a current version; financial terms cannot be supplied by callers", async () => {
  const b = await booking(),
    id = ok(await save(staff, "draft", b.id, { description: "Original" })),
    d = ok(await staff.from("invoice_drafts").select("*").eq("id", id).single());
  assert.ok(
    (await save(staff, "draft", b.id, { description: "Changed", amount: 1 }, d.updated_at)).error,
  );
  ok(await save(staff, "draft", b.id, { description: "Changed" }, d.updated_at));
  assert.ok((await save(staff, "draft", b.id, { description: "Stale" }, d.updated_at)).error);
  const changed = ok(await staff.from("invoice_drafts").select("*").eq("id", id).single());
  assert.equal(changed.amount, d.amount);
  assert.deepEqual(changed.customer_snapshot, d.customer_snapshot);
});
test("reports filter source/status/date/search and page without leaking other units", async () => {
  const b = await booking();
  const result = ok(
    await report(staff, "bookings", {
      _search: b.id,
      _status: "PENDING",
      _from: "2099-11-06",
      _to: "2099-11-06",
    }),
  );
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].amount, "125.50");
  assert.equal(ok(await report(other, "bookings", { _search: b.id })).total, 0);
  assert.equal(
    ok(await report(staff, "bookings", { _search: b.id, _from: "2099-11-07" })).total,
    0,
  );
  assert.ok((await report(staff, "bookings", { _from: "2099-11-07", _to: "2099-11-06" })).error);
  assert.ok((await report(staff, "bookings", { _limit: 10001 })).error);
});
test("deposit reports count only matching verified unreversed evidence and preserve exact decimal totals", async () => {
  const b = await booking();
  ok(await act(b, "requirement", { amount: "30.00" }));
  for (const amount of ["10.10", "19.90"])
    ok(
      await act(b, "receipt", {
        amount,
        reference: "TEST ONLY " + randomUUID(),
        currency: "USD",
        receivedAt: "2026-10-20T12:00:00Z",
      }),
    );
  let rows = ok(await staff.from("booking_deposit_receipts").select("*").eq("booking_id", b.id));
  let data = ok(await report(staff, "deposits", { _search: b.id })).rows[0];
  assert.equal(data.verified, "0");
  assert.equal(data.shortfall, "30.00");
  for (const r of rows) ok(await act(b, "verify", { receiptId: r.id, attested: true }));
  data = ok(await report(staff, "deposits", { _search: b.id })).rows[0];
  assert.equal(Number(data.verified), 30);
  assert.equal(Number(data.shortfall), 0);
  ok(await act(b, "confirm"));
  ok(await act(b, "reverse", { receiptId: rows[0].id, reason: "TEST ONLY reversal" }));
  data = ok(await report(staff, "deposits", { _search: b.id })).rows[0];
  assert.equal(data.payment_exception, true);
  assert.equal(Number(data.verified), Number(rows[1].amount));
  const evidence = ok(await report(staff, "receipts", { _search: rows[0].id }));
  assert.equal(evidence.rows[0].status, "REVERSED");
});
test("late audit failure rolls draft and activity back atomically", async () => {
  const b = await booking(),
    uid = ok(await staff.auth.getUser()).user.id,
    op = randomUUID();
  const result = sql(`BEGIN;
 CREATE FUNCTION pg_temp.phase7_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.metadata->>'phase7_operation_id'='${op}' THEN RAISE EXCEPTION 'phase7 injected'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER phase7_failure BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.phase7_fail();
 SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true);SET LOCAL ROLE authenticated;
 DO $$ BEGIN BEGIN PERFORM public.phase7_save('${op}','draft','${b.id}','{"description":"TEST ONLY rollback"}',NULL);RAISE EXCEPTION 'expected failure';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'phase7 injected' THEN RAISE; END IF;END;END $$;
 RESET ROLE;SELECT count(*) FROM public.invoice_drafts WHERE booking_id='${b.id}';ROLLBACK;`);
  assert.equal(result.split("\n").at(-1), "0");
});

test("local browser saves and reloads a draft, exports reports and renders PDF previews", async () => {
  const b = await booking();
  const email = randomUUID() + "@acceptance.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: user.id, business_unit_id: bu, role: "MANAGER" }),
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
        TEMP: "F:/DockerData",
        TMP: "F:/DockerData",
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
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    stage = "login";
    await page.goto(appUrl + "/j1s30MRp_geRZtdPP860Rw/");
    await page.waitForFunction(() => {
      const i = document.querySelector('input[type="email"]');
      return i && Object.keys(i).some((k) => k.startsWith("__reactProps$"));
    });
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/admin");
    stage = "draft page load";
    await page.goto(appUrl + "/admin/document/invoice/new?bookingId=" + b.id);
    stage = "draft description entry";
    await page
      .getByLabel("Draft description")
      .fill("TEST ONLY preview. " + "Long description for page layout. ".repeat(40));
    stage = "draft save click";
    await page.getByRole("button", { name: "Save invoice draft", exact: true }).click();
    stage = "draft save confirmation";
    await page.getByText("DRAFT — NOT ISSUED", { exact: true }).waitFor();
    stage = "saved draft reload";
    await page.reload();
    await page.getByText("DRAFT — NOT ISSUED", { exact: true }).waitFor();
    assert.equal(
      ok(await staff.from("invoice_drafts").select("id").eq("booking_id", b.id)).length,
      1,
    );
    stage = "PDF and responsive preview";
    mkdirSync("F:/DockerData/phase7-verification", { recursive: true });
    for (const format of ["A4", "Letter"]) {
      const pdf = await page.pdf({
        format,
        printBackground: true,
        preferCSSPageSize: false,
        path: "F:/DockerData/phase7-verification/draft-" + format + ".pdf",
      });
      assert.ok(pdf.length > 1000);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "F:/DockerData/phase7-verification/draft-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    stage = "report download";
    await page.goto(appUrl + "/admin/m/invoices");
    await page.getByRole("heading", { name: "Invoice Drafts", exact: true }).waitFor();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: /CSV/i }).click();
    const download = await downloadEvent;
    assert.ok(download.suggestedFilename().endsWith(".csv"));
    await download.saveAs("F:/DockerData/phase7-verification/invoice-drafts.csv");
    stage = "verified payment preview and reversal recheck";
    ok(await act(b, "requirement", { amount: "30.00" }));
    ok(
      await act(b, "receipt", {
        amount: "30.00",
        reference: "TEST ONLY " + randomUUID(),
        currency: "USD",
        receivedAt: "2026-10-20T12:00:00Z",
      }),
    );
    const receipt = ok(
      await staff.from("booking_deposit_receipts").select("*").eq("booking_id", b.id).single(),
    );
    stage = "unverified payment page";
    await page.goto(appUrl + "/admin/document/receipt/" + receipt.id);
    const printButton = page.getByRole("button", { name: "Print / Save PDF preview", exact: true });
    await page.getByRole("heading", { name: "Payment evidence preview", exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (x) => x.textContent.includes("Print / Save PDF preview") && x.disabled,
      ),
    );
    stage = "payment verification";
    ok(await act(b, "verify", { receiptId: receipt.id, attested: true }));
    stage = "verified payment reload";
    await page.reload();
    await page.getByText("PAYMENT PREVIEW — NOT AN ISSUED RECEIPT", { exact: true }).waitFor();
    assert.equal(await printButton.isEnabled(), true);
    stage = "verified payment PDFs";
    for (const format of ["A4", "Letter"]) {
      const pdf = await page.pdf({
        format,
        printBackground: true,
        path: "F:/DockerData/phase7-verification/payment-" + format + ".pdf",
      });
      assert.ok(pdf.length > 1000);
    }
    await page.evaluate(() => {
      window.__phase7Printed = false;
      window.print = () => {
        window.__phase7Printed = true;
      };
    });
    stage = "reversal and stale print check";
    ok(
      await act(b, "reverse", {
        receiptId: receipt.id,
        reason: "TEST ONLY stale preview protection",
      }),
    );
    await printButton.click();
    await page
      .getByRole("alert")
      .filter({
        hasText:
          "Payment eligibility changed or could not be verified. Refresh the booking before printing.",
      })
      .waitFor();
    assert.equal(await printButton.isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__phase7Printed), false);
    stage = "sidebar route smoke checks";
    const sidebarPaths = await page
      .locator(".admin nav a[href]")
      .evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute("href")))].filter((href) =>
          href?.startsWith("/admin"),
        ),
      );
    assert.ok(sidebarPaths.length >= 15);
    for (const path of sidebarPaths) {
      const response = await page.goto(appUrl + path);
      assert.ok(response && response.status() < 400);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      assert.equal(await page.getByText("Something went wrong!", { exact: true }).count(), 0);
    }
    stage = "mobile reports layout";
    await page.goto(appUrl + "/admin/m/analytics");
    await page.getByRole("heading", { name: "Reports", exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent.includes("Export CSV") && !button.disabled,
      ),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "F:/DockerData/phase7-verification/reports-mobile.png",
      fullPage: true,
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  } catch {
    if (page && !page.isClosed() && stage !== "login") {
      await page
        .screenshot({
          path: "F:/DockerData/phase7-verification/browser-failure.png",
          fullPage: true,
        })
        .catch(() => {});
    }
    throw new Error(
      "Local Phase 7 browser failed during " + stage + "; sensitive diagnostics withheld.",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
});

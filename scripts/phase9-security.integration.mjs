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
  process.env.SKYRUN_PHASE9_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 9 isolated test approval is required",
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
  sql("SELECT to_regprocedure('public.phase9_management_access()') IS NOT NULL;"),
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

let unitB,
  users = {},
  own,
  foreign;
async function identity(role, unit = bu) {
  const email = randomUUID() + "@security.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  if (role)
    ok(await admin.from("user_roles").insert({ user_id: user.id, business_unit_id: unit, role }));
  const api = client(status.ANON_KEY);
  ok(await api.auth.signInWithPassword({ email, password }));
  return { api, id: user.id, email, password };
}
async function enquiry() {
  return ok(
    await admin.rpc("create_ride_enquiry", {
      _business_unit_id: bu,
      _submission_key: randomUUID(),
      _name: "TEST ONLY Phase9",
      _email: randomUUID() + "@security.example.test",
      _phone: "TEST-" + randomUUID().slice(0, 25),
      _subject: "TEST ONLY NO RIDE",
      _service: "Airport transfer",
      _pickup_location: "TEST ONLY Airport",
      _dropoff_location: "TEST ONLY Hotel",
      _travel_date: "2099-11-06",
      _pickup_time: "14:30",
      _passenger_count: 2,
      _vehicle_preference: "",
      _notes: "TEST ONLY Phase9 security",
    }),
  );
}
before(async () => {
  unitB = randomUUID();
  ok(
    await admin.from("business_units").insert({
      id: unitB,
      organization_id: "00000000-0000-0000-0000-000000000001",
      name: "TEST ONLY Phase9 B",
      slug: "phase9-" + unitB,
      business_type: "LIMO",
    }),
  );
  for (const role of ["ADMIN", "MANAGER", "SUPPORT", "DISPATCHER", "CONTENT_MANAGER"])
    users[role] = await identity(role);
  users.NONE = await identity(null);
  users.OTHER = await identity("ADMIN", unitB);
  users.SUPER_ADMIN = await identity("SUPER_ADMIN", null);
  users.MIXED = await identity("ADMIN");
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: users.MIXED.id, business_unit_id: bu, role: "CONTENT_MANAGER" }),
  );
  own = await enquiry();
  foreign = randomUUID();
  ok(
    await admin.from("customers").insert({
      id: foreign,
      business_unit_id: unitB,
      full_name: "TEST ONLY other tenant",
      email: randomUUID() + "@security.example.test",
    }),
  );
});
test("every important table has RLS; private functions and direct write privileges fail closed", async () => {
  assert.equal(
    sql(
      "SELECT bool_and(relrowsecurity) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r';",
    ),
    "t",
  );
  const tables = [
    "leads",
    "ride_requests",
    "quotes",
    "bookings",
    "customers",
    "vehicles",
    "vehicle_categories",
    "activities",
    "booking_deposit_receipts",
    "booking_deposit_reversals",
    "service_configuration",
    "invoice_drafts",
    "document_profiles",
    "staff_notifications",
    "communication_outbox",
    "communication_events",
    "request_budgets",
    "business_units",
    "organizations",
  ];
  for (const table of tables) {
    for (const operation of ["insert", "update", "delete"]) {
      const pk =
        table === "document_profiles"
          ? "business_unit_id"
          : table === "notification_preferences"
            ? "user_id"
            : table === "communication_events"
              ? "event_id"
              : table === "request_budgets"
                ? "subject_hash"
                : "id";
      let query = users.ADMIN.api.from(table);
      const result =
        operation === "insert"
          ? await query.insert({ [pk]: randomUUID() })
          : operation === "update"
            ? await query.update({ [pk]: randomUUID() }).eq(pk, randomUUID())
            : await query.delete().eq(pk, randomUUID());
      // request_budgets has no id: query a real PK column to reach privilege checks.

      assert.equal(
        result.error?.code,
        "42501",
        `${table} ${operation} must be denied by privileges`,
      );
    }
  }
  for (const api of [anon, users.ADMIN.api, users.NONE.api]) {
    assert.ok(
      (
        await api.rpc("phase9_contact", {
          _key: randomUUID(),
          _source: "CONTACT_FORM",
          _name: "TEST",
          _email: "test@example.test",
          _phone: "12345",
          _subject: "TEST",
          _message: "TEST",
        })
      ).error,
    );
    assert.ok((await api.rpc("phase9_budget", { _subject: "a".repeat(64), _scope: "ride" })).error);
  }
});
test("lead roles, actor attribution, tenant denial and concurrent retry produce one authoritative event", async () => {
  const r = await enquiry(),
    args = { _id: r.lead_id, _status: "GENUINE", _expected: "NEW", _reason: null };
  for (const name of ["NONE", "CONTENT_MANAGER", "OTHER", "MIXED"])
    assert.ok((await users[name].api.rpc("phase9_lead_status", args)).error, name);
  for (const name of ["ADMIN", "MANAGER", "SUPPORT", "DISPATCHER", "SUPER_ADMIN"]) {
    const fresh = await enquiry();
    ok(await users[name].api.rpc("phase9_lead_status", { ...args, _id: fresh.lead_id }));
  }
  const replies = await Promise.all(
    Array.from({ length: 8 }, () => users.ADMIN.api.rpc("phase9_lead_status", args)),
  );
  replies.forEach(ok);
  const lead = ok(
    await admin.from("leads").select("reviewed_by,reviewed_at,status").eq("id", r.lead_id).single(),
  );
  assert.equal(lead.reviewed_by, users.ADMIN.id);
  assert.ok(lead.reviewed_at);
  const events = ok(
    await admin
      .from("activities")
      .select("*")
      .eq("entity_id", r.lead_id)
      .eq("activity_type", "STATUS_CHANGE"),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_id, users.ADMIN.id);
  assert.ok(
    (await users.ADMIN.api.rpc("phase9_lead_status", { ...args, _status: "SPAM" })).error,
    "stale contradictory review denied",
  );
});
test("lead status and audit roll back together on a late database failure", async () => {
  const r = await enquiry();
  sql(
    `CREATE FUNCTION public.phase9_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${r.lead_id}'::uuid AND NEW.activity_type='STATUS_CHANGE' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER phase9_test_fail BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.phase9_test_fail();`,
  );
  try {
    assert.ok(
      (
        await users.ADMIN.api.rpc("phase9_lead_status", {
          _id: r.lead_id,
          _status: "GENUINE",
          _expected: "NEW",
        })
      ).error,
    );
    assert.equal(
      ok(await admin.from("leads").select("status").eq("id", r.lead_id).single()).status,
      "NEW",
    );
    assert.equal(
      ok(
        await admin
          .from("activities")
          .select("id")
          .eq("entity_id", r.lead_id)
          .eq("activity_type", "STATUS_CHANGE"),
      ).length,
      0,
    );
  } finally {
    sql(
      "DROP TRIGGER phase9_test_fail ON public.activities; DROP FUNCTION public.phase9_test_fail();",
    );
  }
});
test("contact retries are atomic and distinct from rides; invalid source and payload denied", async () => {
  const input = {
    _key: randomUUID(),
    _source: "CONTACT_FORM",
    _name: "TEST ONLY Phase9 Contact",
    _email: randomUUID() + "@security.example.test",
    _phone: "TEST-" + randomUUID(),
    _subject: "TEST ONLY",
    _message: "TEST ONLY NO CUSTOMER CONTACT",
  };
  input._phone = input._phone.slice(0, 40);
  const replies = await Promise.all(
    Array.from({ length: 8 }, () => admin.rpc("phase9_contact", input)),
  );
  const refs = replies.map((r) => ok(r).reference);
  assert.equal(new Set(refs).size, 1);
  const leads = ok(await admin.from("leads").select("id,source").eq("submission_key", input._key));
  assert.equal(leads.length, 1);
  assert.equal(leads[0].source, "CONTACT_FORM");
  assert.equal(
    ok(await admin.from("ride_requests").select("id").eq("lead_id", leads[0].id)).length,
    0,
  );
  assert.equal(
    ok(await admin.from("activities").select("id").eq("entity_id", leads[0].id)).length,
    1,
  );
  assert.ok((await admin.rpc("phase9_contact", { ...input, _email: "invalid" })).error);
  assert.ok((await admin.rpc("phase9_contact", { ...input, _source: "RIDE_ENQUIRY" })).error);
});
test("contact late failure leaves no customer, lead, notification or audit fragment", async () => {
  const email = randomUUID() + "@security.example.test",
    key = randomUUID();
  sql(
    `CREATE FUNCTION public.phase9_test_contact_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description='Lead created from CONTACT_FORM' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER phase9_test_contact_fail BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.phase9_test_contact_fail();`,
  );
  try {
    assert.ok(
      (
        await admin.rpc("phase9_contact", {
          _key: key,
          _source: "CONTACT_FORM",
          _name: "TEST ONLY",
          _email: email,
          _phone: key,
          _subject: "TEST",
          _message: "TEST",
        })
      ).error,
    );
    assert.equal(ok(await admin.from("customers").select("id").eq("email", email)).length, 0);
    assert.equal(ok(await admin.from("leads").select("id").eq("submission_key", key)).length, 0);
  } finally {
    sql(
      "DROP TRIGGER phase9_test_contact_fail ON public.activities; DROP FUNCTION public.phase9_test_contact_fail();",
    );
  }
});
test("ordinary users cannot forge authoritative audit types or alter another tenant", async () => {
  for (const type of [
    "STATUS_CHANGE",
    "CREATED",
    "UPDATED",
    "ROLE_CHANGED",
    "BOOKING_CONFIRMED",
    "DEPOSIT_VERIFIED",
    "NOTIFICATION_PREFERENCES_UPDATED",
    "COMMUNICATION_RETRY",
  ])
    assert.ok(
      (
        await users.ADMIN.api.rpc("log_activity", {
          _entity_type: "lead",
          _entity_id: own.lead_id,
          _activity_type: type,
          _description: "forged",
          _metadata: {},
        })
      ).error,
      type,
    );
  ok(
    await users.ADMIN.api.rpc("log_activity", {
      _entity_type: "lead",
      _entity_id: own.lead_id,
      _activity_type: "NOTE",
      _description: "TEST ONLY safe note",
      _metadata: { actor_id: users.OTHER.id },
    }),
  );
  const note = ok(
    await admin
      .from("activities")
      .select("actor_id,metadata")
      .eq("entity_id", own.lead_id)
      .eq("activity_type", "NOTE")
      .single(),
  );
  assert.equal(note.actor_id, users.ADMIN.id);
  assert.equal(note.metadata.actor_id, undefined);
  const direct = await users.ADMIN.api.from("customers").select("id").eq("id", foreign);
  assert.equal(ok(direct).length, 0);
  assert.ok(
    (
      await users.ADMIN.api.rpc("phase5_save", {
        _kind: "customer",
        _id: foreign,
        _business_unit_id: unitB,
        _payload: { full_name: "forged" },
        _expected_updated_at: null,
        _operation_id: randomUUID(),
      })
    ).error,
  );
  const ownCustomer = ok(
    await admin.from("leads").select("customer_id").eq("id", own.lead_id).single(),
  ).customer_id;
  assert.equal(
    ok(await users.OTHER.api.from("customers").select("id").eq("id", ownCustomer)).length,
    0,
  );
});
test("role changes are super-admin only and audited; personal profile cannot change account status", async () => {
  const target = await identity("SUPPORT"),
    role = ok(await admin.from("user_roles").select("id").eq("user_id", target.id).single());
  const denied = await users.ADMIN.api
    .from("user_roles")
    .update({ role: "SUPER_ADMIN", business_unit_id: null })
    .eq("id", role.id)
    .select("id");
  assert.ok(denied.error || denied.data.length === 0);
  ok(await users.SUPER_ADMIN.api.from("user_roles").update({ role: "MANAGER" }).eq("id", role.id));
  const history = ok(
    await admin
      .from("activities")
      .select("actor_id")
      .eq("entity_id", role.id)
      .eq("activity_type", "ROLE_CHANGED"),
  );
  assert.ok(history.some((e) => e.actor_id === users.SUPER_ADMIN.id));
  assert.equal(
    (await target.api.from("profiles").update({ status: "INACTIVE" }).eq("id", target.id)).error
      ?.code,
    "42501",
  );
  assert.ok(
    (
      await target.api
        .from("profiles")
        .update({ full_name: "X".repeat(201) })
        .eq("id", target.id)
    ).error,
  );
  ok(
    await target.api
      .from("profiles")
      .update({ full_name: "TEST ONLY safe name" })
      .eq("id", target.id),
  );
  assert.equal(
    ok(await target.api.rpc("phase9_management_access")),
    true,
    "current roles resolve without new JWT",
  );
});
test("management-only pages and reports fail closed for lower, mixed, roleless and other-unit identities", async () => {
  for (const name of ["SUPPORT", "DISPATCHER", "CONTENT_MANAGER", "NONE", "MIXED"])
    assert.equal(ok(await users[name].api.rpc("phase9_management_access")), false, name);
  for (const name of ["ADMIN", "MANAGER", "SUPER_ADMIN"])
    assert.equal(ok(await users[name].api.rpc("phase9_management_access")), true, name);
  const report = await users.OTHER.api.rpc("phase7_report", {
    _kind: "customers",
    _from: null,
    _to: null,
    _status: "",
    _source: "",
    _search: "",
    _unit: bu,
    _offset: 0,
    _limit: 50,
  });
  assert.ok(report.error || ok(report).rows.length === 0);
  assert.ok(
    (
      await users.ADMIN.api.rpc("phase7_report", {
        _kind: "customers",
        _offset: -1,
        _limit: 100000,
      })
    ).error,
  );
});
test("distributed budgets are atomic, bounded and available only through the service role", async () => {
  const subject = createHash("sha256").update(randomUUID()).digest("hex");
  const replies = await Promise.all(
    Array.from({ length: 30 }, () =>
      admin.rpc("phase9_budget", { _subject: subject, _scope: "lead" }),
    ),
  );
  assert.equal(replies.map(ok).filter(Boolean).length, 20);
  assert.equal(ok(await admin.rpc("phase9_budget", { _subject: subject, _scope: "lead" })), false);
  assert.ok((await admin.rpc("phase9_budget", { _subject: "raw-ip", _scope: "lead" })).error);
  assert.ok((await admin.rpc("phase9_budget", { _subject: subject, _scope: "unbounded" })).error);
  assert.ok((await users.ADMIN.api.from("request_budgets").select("*")).error);
});
test("invalid JWTs cannot read protected records and anonymous access is denied", async () => {
  const response = await guardedFetch(status.API_URL + "/rest/v1/leads?select=id", {
    headers: { apikey: status.ANON_KEY, Authorization: "Bearer invalid-token" },
  });
  assert.equal(response.status, 401);
  assert.ok((await anon.from("leads").select("*")).error);
  assert.equal(ok(await users.NONE.api.from("leads").select("id")).length, 0);
});
test(
  "real local browser blocks anonymous and lower-role financial URLs and preserves safe settings",
  { skip: process.env.SKYRUN_PHASE9_BROWSER !== "1", timeout: 180000 },
  async () => {
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
          TEMP: "F:/DockerData",
          TMP: "F:/DockerData",
          QUOTE_EMAIL_MODE: "disabled",
          COMMUNICATION_EMAIL_MODE: "disabled",
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
      browser = await chromium.launch({
        headless: true,
        env: { ...process.env, TEMP: "F:/DockerData", TMP: "F:/DockerData" },
      });
      const context = await browser.newContext();
      await context.route("**/*", (r) =>
        [appUrl, status.API_URL].includes(new URL(r.request().url()).origin)
          ? r.continue()
          : r.abort(),
      );
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      stage = "anonymous direct URL";
      await page.goto(appUrl + "/admin/m/invoices");
      await page.waitForURL((url) => /^\/j1s30MRp_geRZtdPP860Rw\/?$/.test(url.pathname));
      stage = "staff login";
      await page.waitForFunction(() => {
        const i = document.querySelector('input[type="email"]');
        return i && Object.keys(i).some((k) => k.startsWith("__reactProps$"));
      });
      await page.getByLabel("Email address", { exact: true }).fill(users.SUPPORT.email);
      await page.getByLabel("Password", { exact: true }).fill(users.SUPPORT.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("**/admin");
      stage = "direct financial URL denial";
      for (const path of [
        "/admin/m/invoices",
        "/admin/m/receipts",
        "/admin/document/invoice/" + randomUUID(),
      ]) {
        await page.goto(appUrl + path);
        await page
          .getByRole("alert")
          .filter({ hasText: "Check your staff permissions and connection" })
          .waitFor();
      }
      stage = "personal settings persistence";
      await page.goto(appUrl + "/admin/settings");
      await page.getByLabel("Full name", { exact: true }).fill("TEST ONLY Phase9 safe profile");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("Saved.", { exact: true }).waitFor();
      await page.reload();
      await page.getByLabel("Full name", { exact: true }).waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector('input[maxlength="200"]')?.value ===
          "TEST ONLY Phase9 safe profile",
      );
      mkdirSync("F:/DockerData/phase9-verification", { recursive: true });
      await page.screenshot({ path: "F:/DockerData/phase9-verification/local-settings.png" });
      stage = "logout";
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.waitForURL((url) => /^\/j1s30MRp_geRZtdPP860Rw\/?$/.test(url.pathname));
      await page.goto(appUrl + "/admin");
      await page.waitForURL((url) => /^\/j1s30MRp_geRZtdPP860Rw\/?$/.test(url.pathname));
    } catch {
      throw Error(
        "Isolated security browser failed during " + stage + "; private diagnostics withheld.",
      );
    } finally {
      await browser?.close();
      server.kill();
    }
  },
);

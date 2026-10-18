// Prepared integration coverage. Requires separate approval and an already-applied local migration.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
assert.equal(
  process.env.SKYRUN_PHASE3_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 3 local test approval is required",
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
assert.ok(Object.values(labels).includes(project));
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
    "SELECT to_regprocedure('public.save_quote_draft(uuid,uuid,numeric,text,timestamptz,text,timestamptz)') IS NOT NULL;",
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
const bu = "00000000-0000-0000-0000-000000000002",
  otherBu = randomUUID(),
  run = randomUUID();
const ok = (r) => {
  if (r.error) throw new Error("Local operation failed: " + (r.error.code ?? "unknown"));
  return r.data;
};
let staff, other, ordinary, userId, rideId, leadId;
const draftId = randomUUID(),
  newUntil = () => new Date(Date.now() + 86400000).toISOString();
const draft = {
  _quote_id: draftId,
  _ride_request_id: null,
  _amount: "125.50",
  _currency: "USD",
  _valid_until: newUntil(),
  _notes: "TEST ONLY local quote",
  _expected_updated_at: null,
};
async function identity(role, unit) {
  const email = randomUUID() + "@phase3.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  if (role)
    ok(await admin.from("user_roles").insert({ user_id: user.id, business_unit_id: unit, role }));
  const session = client(status.ANON_KEY);
  ok(await session.auth.signInWithPassword({ email, password }));
  return { session, user };
}
async function request(genuine = true) {
  const result = ok(
    await admin.rpc("create_ride_enquiry", {
      _business_unit_id: bu,
      _submission_key: randomUUID(),
      _name: "TEST ONLY Phase3 " + run,
      _email: randomUUID() + "@phase3.example.test",
      _phone: "TEST-" + randomUUID().slice(0, 25),
      _subject: "TEST ONLY quote fixture",
      _service: "Airport transfer",
      _pickup_location: "Local airport",
      _dropoff_location: "Local hotel",
      _travel_date: "2099-11-06",
      _pickup_time: "14:30",
      _passenger_count: 2,
      _vehicle_preference: "",
      _notes: "Local fixture",
    }),
  );
  if (genuine) ok(await admin.from("leads").update({ status: "GENUINE" }).eq("id", result.lead_id));
  return result;
}
before(async () => {
  ok(
    await admin.from("business_units").insert({
      id: otherBu,
      organization_id: "00000000-0000-0000-0000-000000000001",
      name: "Phase3 isolated tenant",
      slug: "phase3-" + run,
      business_type: "LIMO",
    }),
  );
  const s = await identity("ADMIN", bu);
  staff = s.session;
  userId = s.user.id;
  other = (await identity("ADMIN", otherBu)).session;
  ordinary = (await identity()).session;
  const r = await request();
  rideId = r.ride_request_id;
  leadId = r.lead_id;
  draft._ride_request_id = rideId;
});
test("eligible staff creates a draft with server-derived customer/trip and one activity", async () => {
  assert.equal(ok(await staff.rpc("save_quote_draft", draft)), draftId);
  const q = ok(await staff.from("quotes").select("*").eq("id", draftId).single());
  const r = ok(await staff.from("ride_requests").select("*").eq("id", rideId).single());
  assert.equal(q.status, "DRAFT");
  assert.equal(q.customer_id, r.customer_id);
  assert.equal(q.business_unit_id, bu);
  assert.equal(q.created_by, userId);
  assert.equal(q.pickup_location, r.pickup_location);
  assert.equal(q.amount, 125.5);
  const a = ok(
    await staff.from("activities").select("*").eq("entity_type", "quote").eq("entity_id", draftId),
  );
  assert.equal(a.length, 1);
  assert.equal(a[0].actor_id, userId);
});
test("concurrent identical retries create no duplicate quote/activity", async () => {
  const result = await Promise.all(
    Array.from({ length: 8 }, () => staff.rpc("save_quote_draft", draft)),
  );
  for (const r of result) assert.equal(ok(r), draftId);
  assert.equal(ok(await admin.from("quotes").select("id").eq("id", draftId)).length, 1);
  assert.equal(
    ok(
      await admin
        .from("activities")
        .select("id")
        .eq("entity_type", "quote")
        .eq("entity_id", draftId),
    ).length,
    1,
  );
});
test("draft edit checks the exact version and logs one update", async () => {
  const old = ok(await staff.from("quotes").select("updated_at").eq("id", draftId).single());
  const edit = { ...draft, _amount: "150.00", _expected_updated_at: old.updated_at };
  assert.equal(ok(await staff.rpc("save_quote_draft", edit)), draftId);
  const stale = await staff.rpc("save_quote_draft", { ...edit, _amount: "160.00" });
  assert.ok(stale.error);
  assert.equal(
    ok(await staff.from("quotes").select("amount").eq("id", draftId).single()).amount,
    150,
  );
});
test("invalid prices, currency and expired deadlines are rejected without insertion", async () => {
  for (const change of [
    { _amount: "-1" },
    { _amount: "1.001" },
    { _currency: "usd" },
    { _valid_until: "2000-01-01T00:00:00Z" },
  ]) {
    const id = randomUUID();
    assert.ok((await staff.rpc("save_quote_draft", { ...draft, _quote_id: id, ...change })).error);
    assert.equal(ok(await admin.from("quotes").select("id").eq("id", id)).length, 0);
  }
});
test("NEW and SPAM enquiries cannot be quoted", async () => {
  const r = await request(false);
  for (const status of ["NEW", "SPAM"]) {
    ok(await admin.from("leads").update({ status }).eq("id", r.lead_id));
    assert.ok(
      (
        await staff.rpc("save_quote_draft", {
          ...draft,
          _quote_id: randomUUID(),
          _ride_request_id: r.ride_request_id,
        })
      ).error,
    );
  }
});
test("tenant isolation, roleless/anonymous denial and direct-write restriction hold", async () => {
  for (const c of [other, ordinary, anon])
    assert.ok((await c.rpc("save_quote_draft", { ...draft, _quote_id: randomUUID() })).error);
  assert.deepEqual(ok(await other.from("quotes").select("id").eq("id", draftId)), []);
  const q = ok(await admin.from("quotes").select("*").eq("id", draftId).single());
  assert.ok((await staff.from("quotes").insert({ ...q, id: randomUUID() })).error);
});
test("accepted quotes cannot be edited and no booking is fabricated", async () => {
  ok(await admin.from("quotes").update({ status: "ACCEPTED" }).eq("id", draftId));
  assert.ok((await staff.rpc("save_quote_draft", { ...draft, _amount: "200.00" })).error);
  assert.equal(ok(await admin.from("bookings").select("id").eq("quote_id", draftId)).length, 0);
});
test("late activity failure rolls back draft creation in a local transaction", () => {
  const id = randomUUID();
  const result = sql(`BEGIN;
 CREATE FUNCTION pg_temp.phase3_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'phase3 injected failure'; END $$;
 CREATE TRIGGER phase3_test_failure BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.phase3_fail();
 SET LOCAL ROLE authenticated;
 SELECT set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated"}',true);
 DO $$ BEGIN
   BEGIN PERFORM public.save_quote_draft('${id}','${rideId}',125.50,'USD',now()+interval '1 day','TEST ONLY rollback',NULL); RAISE EXCEPTION 'expected failure missing';
   EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'phase3 injected failure' THEN RAISE; END IF; END;
   IF EXISTS(SELECT 1 FROM public.quotes WHERE id='${id}') THEN RAISE EXCEPTION 'partial quote survived'; END IF;
 END $$;
 SELECT 'rollback verified'; ROLLBACK;`);
  assert.ok(result.endsWith("rollback verified"));
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname='phase3_test_failure';"), "0");
});

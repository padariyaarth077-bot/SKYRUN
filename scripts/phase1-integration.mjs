// Runs only against the explicitly approved disposable Supabase project.
// Local credentials stay in memory; no hosted environment files are loaded.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const workspace = "F:/SKYRUN/skyrun-phase1-core";
const project = "skyrun-phase1-core";
const container = `supabase_db_${project}`;
assert.match(
  readFileSync(`${workspace}/supabase/config.toml`, "utf8"),
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
        workspace,
        "-o",
        "json",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        cwd: workspace,
        env: { ...process.env, SUPABASE_PROJECT_ID: project },
      },
    ),
  );
} catch {
  throw new Error("The approved isolated Supabase project must be running before this test.");
}
assert.equal(status.API_URL, "http://127.0.0.1:56341");
assert.ok(
  status.SERVICE_ROLE_KEY && status.ANON_KEY,
  "Local credentials must be available in memory",
);
const labels = JSON.parse(
  execFileSync("docker", ["inspect", "--format", "{{json .Config.Labels}}", container], {
    encoding: "utf8",
  }),
);
assert.ok(Object.values(labels).includes(project), "Database must belong to the isolated project");
const localFetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : (input.url ?? input.href));
  assert.equal(
    url.origin,
    status.API_URL,
    "Integration tests cannot contact any non-local backend",
  );
  return fetch(input, init);
};
const client = (key) =>
  createClient(status.API_URL, key, {
    global: { fetch: localFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = client(status.SERVICE_ROLE_KEY);
const anonymous = client(status.ANON_KEY);
const bu = "00000000-0000-0000-0000-000000000002";
const run = randomUUID();
const otherBu = randomUUID();
const fixture = (overrides = {}) => ({
  _business_unit_id: bu,
  _submission_key: randomUUID(),
  _name: `Phase1 ${run}`,
  _email: `${randomUUID()}@phase1.example.test`,
  _phone: randomUUID(),
  _subject: `Ride request — Phase1 ${run}`,
  _service: "Airport transfer",
  _pickup_location: "Local test airport",
  _dropoff_location: "Local test hotel",
  _travel_date: "2026-11-06",
  _pickup_time: "14:30",
  _passenger_count: 2,
  _vehicle_preference: "Luxury SUV",
  _notes: "Two carry-on bags",
  ...overrides,
});
function ok(result) {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
async function submit(input) {
  return ok(await admin.rpc("create_ride_enquiry", input));
}
function sql(statement) {
  // Fixed container; no connection URLs, passwords or remote clients.
  return execFileSync(
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
    { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
let primaryInput, primary, customerId, staff, outsider, ordinary;

test("fresh local database has all six migrations, seeded tenant, RLS and restricted RPC grants", () => {
  assert.equal(Number(sql("select count(*) from supabase_migrations.schema_migrations;")), 6);
  assert.equal(sql(`select slug from public.business_units where id = '${bu}';`), "skyrun-limo");
  assert.equal(
    sql(
      "select bool_and(relrowsecurity) from pg_class where oid in ('public.customers'::regclass,'public.leads'::regclass,'public.ride_requests'::regclass,'public.activities'::regclass);",
    ),
    "t",
  );
  const signature =
    "public.create_ride_enquiry(uuid,uuid,text,text,text,text,text,text,text,date,time,integer,text,text)";
  assert.equal(
    sql(
      `select has_function_privilege('anon','${signature}','EXECUTE'), has_function_privilege('authenticated','${signature}','EXECUTE'), has_function_privilege('service_role','${signature}','EXECUTE');`,
    ),
    "f|f|t",
  );
  assert.equal(
    sql(
      `select prosecdef, array_to_string(proconfig, ',') from pg_proc where oid = '${signature}'::regprocedure;`,
    ),
    't|search_path=""',
  );
});

test("real PostgREST RPC creates related customer, lead, structured request and two activities", async () => {
  primaryInput = fixture();
  primary = await submit(primaryInput);
  assert.equal(primary.duplicate, false);
  assert.match(primary.reference, /^SR-/);
  const lead = ok(
    await admin
      .from("leads")
      .select("*, customers(*), ride_requests(*)")
      .eq("id", primary.lead_id)
      .single(),
  );
  customerId = lead.customer_id;
  assert.equal(lead.source, "RIDE_ENQUIRY");
  assert.equal(lead.status, "NEW");
  assert.equal(lead.business_unit_id, bu);
  assert.equal(lead.customers.email, primaryInput._email);
  const ride = lead.ride_requests[0];
  assert.equal(lead.ride_requests.length, 1);
  assert.equal(ride.id, primary.ride_request_id);
  assert.equal(ride.customer_id, customerId);
  assert.equal(ride.lead_id, lead.id);
  assert.equal(ride.status, "SUBMITTED");
  assert.equal(ride.trip_type, "ONE_WAY");
  assert.equal(ride.passenger_count, 2);
  assert.equal(ride.travel_date, "2026-11-06");
  assert.equal(ride.pickup_time, "14:30:00");
  assert.equal(ride.pickup_location, primaryInput._pickup_location);
  assert.equal(ride.dropoff_location, primaryInput._dropoff_location);
  assert.match(ride.notes, /Luxury SUV/);
  assert.match(ride.notes, /Two carry-on bags/);
  const acts = ok(await admin.from("activities").select("*").in("entity_id", [lead.id, ride.id]));
  assert.equal(acts.length, 2);
  assert.ok(acts.every((a) => a.activity_type === "CREATED" && a.business_unit_id === bu));
});

test("hourly chauffeur enquiries preserve the hourly trip type", async () => {
  const result = await submit(fixture({ _service: "Hourly chauffeur" }));
  const ride = ok(
    await admin.from("ride_requests").select("trip_type").eq("id", result.ride_request_id).single(),
  );
  assert.equal(ride.trip_type, "HOURLY");
});

test("retry reuses reference with no additional business records; a new key creates a new enquiry", async () => {
  const duplicate = await submit(primaryInput);
  assert.equal(duplicate.reference, primary.reference);
  assert.equal(duplicate.duplicate, true);
  const next = await submit({ ...primaryInput, _submission_key: randomUUID() });
  assert.notEqual(next.lead_id, primary.lead_id);
  const leads = ok(await admin.from("leads").select("id").eq("customer_id", customerId));
  const rides = ok(await admin.from("ride_requests").select("id").eq("customer_id", customerId));
  assert.equal(leads.length, 2);
  assert.equal(rides.length, 2);
  const acts = ok(
    await admin
      .from("activities")
      .select("id")
      .in("entity_id", [...leads.map((r) => r.id), ...rides.map((r) => r.id)]),
  );
  assert.equal(acts.length, 4);
});

test("email and phone conflicts match existing scoped customers without overwriting them", async () => {
  const emailMatch = await submit(fixture({ _email: primaryInput._email.toUpperCase() }));
  const phoneMatch = await submit(fixture({ _phone: primaryInput._phone }));
  for (const result of [emailMatch, phoneMatch]) {
    assert.equal(
      ok(await admin.from("leads").select("customer_id").eq("id", result.lead_id).single())
        .customer_id,
      customerId,
    );
  }
  assert.equal(
    ok(await admin.from("customers").select("email").eq("id", customerId).single()).email,
    primaryInput._email,
  );
});

test("twelve simultaneous duplicate HTTP RPCs create one customer, lead, ride and two activities", async () => {
  const input = fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => submit(input)));
  assert.equal(new Set(results.map((r) => r.lead_id)).size, 1);
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.equal(
    ok(await admin.from("ride_requests").select("id").eq("submission_key", input._submission_key))
      .length,
    1,
  );
  assert.equal(
    ok(
      await admin
        .from("customers")
        .select("id")
        .eq("email", input._email)
        .eq("business_unit_id", bu),
    ).length,
    1,
  );
  assert.equal(
    ok(
      await admin
        .from("leads")
        .select("id")
        .eq("subject", input._subject)
        .eq(
          "customer_id",
          ok(
            await admin
              .from("ride_requests")
              .select("customer_id")
              .eq("id", results[0].ride_request_id)
              .single(),
          ).customer_id,
        ),
    ).length,
    1,
  );
  assert.equal(
    ok(
      await admin
        .from("activities")
        .select("id")
        .in("entity_id", [results[0].lead_id, results[0].ride_request_id]),
    ).length,
    2,
  );
});

test("concurrent different enquiries sharing contact details reuse one customer", async () => {
  const input = fixture();
  const results = await Promise.all(
    Array.from({ length: 6 }, () => submit({ ...input, _submission_key: randomUUID() })),
  );
  assert.equal(new Set(results.map((r) => r.lead_id)).size, 6);
  const customers = ok(
    await admin.from("customers").select("id").eq("email", input._email).eq("business_unit_id", bu),
  );
  assert.equal(customers.length, 1);
  assert.equal(
    ok(await admin.from("ride_requests").select("id").eq("customer_id", customers[0].id)).length,
    6,
  );
});

test("invalid RPC inputs and unauthorized business units fail without writes", async () => {
  for (const overrides of [
    { _business_unit_id: null },
    { _business_unit_id: otherBu },
    { _service: null },
    { _service: "Unsupported" },
    { _name: "" },
    { _passenger_count: 0 },
    { _travel_date: "2026-02-30" },
    { _pickup_time: "25:00" },
  ]) {
    const input = fixture(overrides);
    const result = await admin.rpc("create_ride_enquiry", input);
    assert.ok(result.error, "Invalid input must be rejected");
    assert.equal(
      ok(await admin.from("customers").select("id").eq("email", input._email)).length,
      0,
    );
    assert.equal(
      ok(await admin.from("ride_requests").select("id").eq("submission_key", input._submission_key))
        .length,
      0,
    );
  }
});

test("late database failure rolls back customer, lead, ride and activities in the real Supabase database", () => {
  const input = fixture();
  const args = Object.values(input).map(literal).join(",");
  const result = sql(`BEGIN;
    CREATE FUNCTION pg_temp.phase1_fail_activity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'phase1 injected failure'; END; $$;
    CREATE TRIGGER phase1_test_failure BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.phase1_fail_activity();
    SET LOCAL ROLE service_role;
    DO $$ DECLARE before_counts text; after_counts text; failed boolean := false;
    BEGIN
      SELECT concat((select count(*) from public.customers),':',(select count(*) from public.leads),':',(select count(*) from public.ride_requests),':',(select count(*) from public.activities)) INTO before_counts;
      BEGIN PERFORM public.create_ride_enquiry(${args});
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'phase1 injected failure' THEN RAISE; END IF; failed := true;
      END;
      IF NOT failed THEN RAISE EXCEPTION 'Failure injection did not execute'; END IF;
      SELECT concat((select count(*) from public.customers),':',(select count(*) from public.leads),':',(select count(*) from public.ride_requests),':',(select count(*) from public.activities)) INTO after_counts;
      IF before_counts <> after_counts THEN RAISE EXCEPTION 'Partial writes survived failure'; END IF;
    END; $$;
    SELECT 'rollback verified'; ROLLBACK;`);
  assert.equal(result, "rollback verified");
  assert.equal(sql("select count(*) from pg_trigger where tgname = 'phase1_test_failure';"), "0");
});

test("unique submission index rejects duplicate inserts independently of advisory locking", () => {
  assert.equal(
    sql(`BEGIN; DO $$ DECLARE constraint_name text;
    BEGIN
      BEGIN INSERT INTO public.ride_requests (business_unit_id, customer_id, request_number, pickup_location, dropoff_location, travel_date, submission_key)
        SELECT business_unit_id, customer_id, 'TEST-' || gen_random_uuid(), pickup_location, dropoff_location, travel_date, submission_key FROM public.ride_requests WHERE id = '${primary.ride_request_id}';
        RAISE EXCEPTION 'Unique index did not reject duplicate';
      EXCEPTION WHEN unique_violation THEN GET STACKED DIAGNOSTICS constraint_name = CONSTRAINT_NAME;
        IF constraint_name <> 'uq_ride_requests_submission_key' THEN RAISE; END IF;
      END;
    END; $$; SELECT 'uniqueness verified'; ROLLBACK;`),
    "uniqueness verified",
  );
});

test("local Auth sessions enforce staff business-unit isolation through PostgREST", async () => {
  ok(
    await admin.from("business_units").insert({
      id: otherBu,
      organization_id: "00000000-0000-0000-0000-000000000001",
      name: "Phase1 isolated tenant",
      slug: `phase1-${run}`,
      business_type: "LIMO",
    }),
  );
  ok(
    await admin.from("customers").insert({
      business_unit_id: otherBu,
      full_name: "Other tenant",
      email: primaryInput._email,
      phone: primaryInput._phone,
    }),
  );
  async function signIn(roleBu) {
    const email = `${randomUUID()}@phase1.example.test`;
    const password = randomUUID() + randomUUID();
    const user = ok(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    ).user;
    if (roleBu)
      ok(
        await admin
          .from("user_roles")
          .insert({ user_id: user.id, business_unit_id: roleBu, role: "ADMIN" }),
      );
    const sessionClient = client(status.ANON_KEY);
    ok(await sessionClient.auth.signInWithPassword({ email, password }));
    return sessionClient;
  }
  staff = await signIn(bu);
  outsider = await signIn(otherBu);
  ordinary = await signIn(null);
  const visible = ok(
    await staff
      .from("leads")
      .select("*, customers(*), ride_requests(*)")
      .eq("status", "NEW")
      .eq("id", primary.lead_id),
  );
  assert.equal(visible.length, 1);
  assert.equal(visible[0].customers.id, customerId);
  assert.equal(visible[0].ride_requests[0].id, primary.ride_request_id);
  for (const [table, column, value] of [
    ["leads", "id", primary.lead_id],
    ["customers", "id", customerId],
    ["ride_requests", "id", primary.ride_request_id],
    ["activities", "entity_id", primary.lead_id],
  ]) {
    assert.equal(ok(await outsider.from(table).select("*").eq(column, value)).length, 0);
    assert.equal(ok(await ordinary.from(table).select("*").eq(column, value)).length, 0);
    const anonResult = await anonymous.from(table).select("*").eq(column, value);
    assert.ok(anonResult.error || anonResult.data.length === 0);
  }
  const blocked = await outsider
    .from("leads")
    .update({ status: "GENUINE" })
    .eq("id", primary.lead_id)
    .select("id");
  assert.ok(blocked.error || blocked.data.length === 0);
  const ownCustomer = ok(
    await staff.from("customers").select("id").eq("email", primaryInput._email),
  );
  assert.deepEqual(
    ownCustomer.map((c) => c.id),
    [customerId],
  );
});

test("RPC privileges and JWT validation reject untrusted callers", async () => {
  for (const caller of [anonymous, staff, outsider, ordinary]) {
    const result = await caller.rpc("create_ride_enquiry", fixture());
    assert.ok(result.error);
    assert.equal(result.error.code, "42501");
  }
  const forged = await localFetch(`${status.API_URL}/rest/v1/leads?select=id`, {
    headers: { apikey: status.ANON_KEY, Authorization: "Bearer invalid-token" },
  });
  assert.equal(forged.status, 401);
});

test("authorized staff can review the enquiry while trip status remains pending", async () => {
  ok(
    await staff
      .from("leads")
      .update({ status: "GENUINE", reviewed_at: new Date().toISOString() })
      .eq("id", primary.lead_id),
  );
  assert.equal(
    ok(await staff.from("leads").select("status").eq("id", primary.lead_id).single()).status,
    "GENUINE",
  );
  assert.equal(
    ok(
      await staff.from("ride_requests").select("status").eq("id", primary.ride_request_id).single(),
    ).status,
    "SUBMITTED",
  );
});

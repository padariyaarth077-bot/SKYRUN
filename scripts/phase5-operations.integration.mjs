// Prepared integration coverage. Requires separate approval and an already-applied local migration.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomInt, randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
assert.equal(
  process.env.SKYRUN_PHASE5_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 5 isolated test approval is required",
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
    "SELECT to_regprocedure('public.phase5_save(text,uuid,uuid,jsonb,timestamp with time zone,uuid)') IS NOT NULL;",
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

// Only synthetic fixtures in the guarded, preserved local stack. No emails or cleanup.
let manager, support, outsider, customer, foreignUnit, vehicle;
const contact = {
  full_name: "TEST ONLY Phase5",
  email: randomUUID() + "@phase5.example.test",
  phone: "+1" + randomInt(1000000000, 10000000000),
  company_name: "",
  notes: "Isolated fixture",
};
const payload = {
  name: "TEST ONLY " + randomUUID(),
  description: "Synthetic configuration",
  is_active: true,
};
async function identity(role, unit) {
  const email = randomUUID() + "@phase5.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  if (role)
    ok(await admin.from("user_roles").insert({ user_id: user.id, business_unit_id: unit, role }));
  const session = client(status.ANON_KEY);
  ok(await session.auth.signInWithPassword({ email, password }));
  return session;
}
function save(session, kind, id, unit, data, version = null, operation = randomUUID()) {
  return session.rpc("phase5_save", {
    _kind: kind,
    _id: id,
    _business_unit_id: unit,
    _payload: data,
    _expected_updated_at: version,
    _operation_id: operation,
  });
}
before(async () => {
  const parent = ok(
    await admin.from("business_units").select("organization_id").eq("id", bu).single(),
  );
  foreignUnit = randomUUID();
  ok(
    await admin.from("business_units").insert({
      id: foreignUnit,
      organization_id: parent.organization_id,
      name: "TEST ONLY Phase5 other",
      slug: "phase5-" + randomUUID(),
      business_type: "LIMO",
    }),
  );
  manager = await identity("MANAGER", bu);
  support = await identity("SUPPORT", bu);
  outsider = await identity("ADMIN", foreignUnit);
  customer = ok(
    await admin
      .from("customers")
      .insert({ business_unit_id: bu, full_name: contact.full_name, email: contact.email })
      .select("*")
      .single(),
  );
  const category = ok(
    await admin
      .from("vehicle_categories")
      .insert({ business_unit_id: bu, name: "TEST ONLY Photo", slug: randomUUID() })
      .select("id")
      .single(),
  );
  vehicle = ok(
    await admin
      .from("vehicles")
      .insert({
        business_unit_id: bu,
        vehicle_category_id: category.id,
        make: "TEST ONLY Cadillac",
        model: "Escalade ESV",
      })
      .select("*")
      .single(),
  );
});
test("only scoped management roles can mutate", async () => {
  for (const role of ["ADMIN", "MANAGER", "DISPATCHER", "SUPPORT", "CONTENT_MANAGER", null]) {
    const actor = await identity(role, bu);
    assert.equal(
      ok(await actor.rpc("can_manage_operations", { _business_unit_id: bu })),
      role === "ADMIN" || role === "MANAGER",
    );
    if (role !== "ADMIN" && role !== "MANAGER")
      assert.ok((await save(actor, "service", randomUUID(), bu, payload)).error);
  }
  const superAdmin = await identity("SUPER_ADMIN", null);
  assert.equal(
    ok(await superAdmin.rpc("can_manage_operations", { _business_unit_id: foreignUnit })),
    true,
  );
  const mixed = await identity("MANAGER", bu),
    mixedUser = ok(await mixed.auth.getUser()).user;
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: mixedUser.id, business_unit_id: bu, role: "SUPPORT" }),
  );
  assert.equal(ok(await mixed.rpc("can_manage_operations", { _business_unit_id: bu })), false);

  assert.equal(ok(await manager.rpc("can_manage_operations", { _business_unit_id: bu })), true);
  assert.equal(ok(await support.rpc("can_manage_operations", { _business_unit_id: bu })), false);
  assert.equal(ok(await outsider.rpc("can_manage_operations", { _business_unit_id: bu })), false);
  assert.ok((await save(support, "service", randomUUID(), bu, payload)).error);
  assert.ok((await save(outsider, "service", randomUUID(), bu, payload)).error);
});
test("concurrent identical configuration retries create one record and one audit", async () => {
  const id = randomUUID(),
    operation = randomUUID();
  const results = await Promise.all([
    save(manager, "service", id, bu, payload, null, operation),
    save(manager, "service", id, bu, payload, null, operation),
  ]);
  results.forEach((result) => assert.equal(ok(result), id));
  assert.equal(ok(await manager.from("service_configuration").select("id").eq("id", id)).length, 1);
  assert.equal(
    sql(
      `SELECT count(*) FROM public.activities WHERE metadata->>'phase5_operation_id'='${operation}';`,
    ),
    "1",
  );
  assert.ok(
    (await save(manager, "service", id, bu, { ...payload, name: "Changed retry" }, null, operation))
      .error,
  );
});
test("customer update persists atomically with attributed audit and retries safely", async () => {
  const operation = randomUUID();
  assert.equal(
    ok(await save(manager, "customer", customer.id, bu, contact, customer.updated_at, operation)),
    customer.id,
  );
  assert.equal(
    ok(await save(manager, "customer", customer.id, bu, contact, customer.updated_at, operation)),
    customer.id,
  );
  const saved = ok(await manager.from("customers").select("*").eq("id", customer.id).single());
  assert.equal(saved.phone, contact.phone);
  assert.notEqual(saved.updated_at, customer.updated_at);
  assert.equal(
    sql(
      `SELECT count(*) FROM public.activities WHERE entity_id='${customer.id}' AND actor_id IS NOT NULL AND metadata->>'phase5_operation_id'='${operation}';`,
    ),
    "1",
  );
  assert.ok(
    (
      await save(
        manager,
        "customer",
        customer.id,
        bu,
        { ...contact, notes: "Stale edit" },
        customer.updated_at,
      )
    ).error,
  );
});
test("duplicate contact failure rolls back the contact change and activity", async () => {
  const other = ok(
    await admin
      .from("customers")
      .insert({
        business_unit_id: bu,
        full_name: "TEST ONLY Existing",
        email: randomUUID() + "@phase5.example.test",
      })
      .select("*")
      .single(),
  );
  const current = ok(await manager.from("customers").select("*").eq("id", customer.id).single()),
    operation = randomUUID();
  assert.ok(
    (
      await save(
        manager,
        "customer",
        customer.id,
        bu,
        { ...contact, email: other.email },
        current.updated_at,
        operation,
      )
    ).error,
  );
  assert.equal(
    ok(await manager.from("customers").select("email").eq("id", customer.id).single()).email,
    current.email,
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM public.activities WHERE metadata->>'phase5_operation_id'='${operation}';`,
    ),
    "0",
  );
});
test("cross-tenant entity IDs and RLS reads cannot cross the boundary", async () => {
  const current = ok(await manager.from("customers").select("*").eq("id", customer.id).single());
  assert.ok(
    (await save(outsider, "customer", customer.id, foreignUnit, contact, current.updated_at)).error,
  );
  assert.deepEqual(ok(await outsider.from("customers").select("id").eq("id", customer.id)), []);
});
test("direct customer/configuration writes and anonymous RPC are denied", async () => {
  assert.ok(
    (await manager.from("customers").update({ full_name: "Bypass" }).eq("id", customer.id)).error,
  );
  assert.ok(
    (
      await manager
        .from("service_configuration")
        .insert({ id: randomUUID(), business_unit_id: bu, kind: "service", ...payload })
    ).error,
  );
  assert.ok((await save(anon, "service", randomUUID(), bu, payload)).error);
});
test("validation rejects unsupported fields, invalid email, URL images and unknown kind", async () => {
  const current = ok(await manager.from("customers").select("*").eq("id", customer.id).single());
  for (const data of [
    { ...contact, email: "invalid" },
    { ...contact, full_name: " " },
    { ...contact, business_unit_id: foreignUnit },
  ])
    assert.ok((await save(manager, "customer", customer.id, bu, data, current.updated_at)).error);
  assert.ok((await save(manager, "service", randomUUID(), bu, { ...payload, price: 50 })).error);
  assert.ok((await save(manager, "unknown", randomUUID(), bu, payload)).error);
  assert.ok(
    (
      await save(
        manager,
        "vehicle",
        vehicle.id,
        bu,
        { image_path: "https://example.test/private.jpg" },
        vehicle.updated_at,
      )
    ).error,
  );
});
test("fleet image assignment is audited and direct authenticated edits are denied", async () => {
  const path = "/vehicle-images/cadillac-escalade-esv-2.jpg";
  assert.equal(
    ok(await save(manager, "vehicle", vehicle.id, bu, { image_path: path }, vehicle.updated_at)),
    vehicle.id,
  );
  assert.equal(
    ok(await manager.from("vehicles").select("image_path").eq("id", vehicle.id).single())
      .image_path,
    path,
  );
  assert.ok(
    (await manager.from("vehicles").update({ image_path: null }).eq("id", vehicle.id)).error,
  );
  assert.ok(
    (
      await manager
        .from("vehicle_categories")
        .update({ image_path: path })
        .eq("id", vehicle.vehicle_category_id)
    ).error,
  );
});
test("generic activity logger cannot forge Phase5 audit or reserve retry IDs", async () => {
  for (const args of [
    { _activity_type: "PHASE5_SAVED", _metadata: {} },
    { _activity_type: "NOTE", _metadata: { phase5_operation_id: randomUUID() } },
  ]) {
    assert.ok(
      (
        await manager.rpc("log_activity", {
          _entity_type: "customer",
          _entity_id: customer.id,
          _description: "Forged audit",
          ...args,
        })
      ).error,
    );
  }
});
test("catalogue edits preserve type, reject stale versions, and deactivate without deletion", async () => {
  const id = randomUUID();
  ok(await save(manager, "service_area", id, bu, payload));
  const record = ok(await manager.from("service_configuration").select("*").eq("id", id).single());
  assert.ok(
    (await save(manager, "service_area", id, bu, { ...payload, is_active: false }, null)).error,
  );
  ok(
    await save(
      manager,
      "service_area",
      id,
      bu,
      { ...payload, is_active: false },
      record.updated_at,
    ),
  );
  const saved = ok(await manager.from("service_configuration").select("*").eq("id", id).single());
  assert.equal(saved.kind, "service_area");
  assert.equal(saved.is_active, false);
});

test("late audit failure rolls back the customer edit and audit together", async () => {
  const current = ok(await manager.from("customers").select("*").eq("id", customer.id).single());
  const actor = ok(await manager.auth.getUser()).user.id,
    operation = randomUUID();
  const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
  const result = sql(`BEGIN;
    CREATE FUNCTION pg_temp.phase5_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.entity_id='${customer.id}'::uuid AND NEW.activity_type='PHASE5_SAVED'
      THEN RAISE EXCEPTION 'injected phase5 audit failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER phase5_rollback_test BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.phase5_audit_failure();
    SET LOCAL ROLE authenticated;
    DO $$ BEGIN PERFORM set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',true); END $$;
    DO $$ BEGIN
      BEGIN
        PERFORM public.phase5_save('customer','${customer.id}','${bu}',${literal(JSON.stringify({ ...contact, notes: "TEST ONLY should roll back" }))}::jsonb,'${current.updated_at}'::timestamptz,'${operation}');
        RAISE EXCEPTION 'audit failure was not reached';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'injected phase5 audit failure' THEN RAISE; END IF;
      END;
    END $$;
    RESET ROLE;
    SELECT jsonb_build_object('unchanged',(SELECT updated_at='${current.updated_at}'::timestamptz FROM public.customers WHERE id='${customer.id}'),
      'no_audit',NOT EXISTS(SELECT 1 FROM public.activities WHERE metadata->>'phase5_operation_id'='${operation}'));
    ROLLBACK;`);
  assert.deepEqual(JSON.parse(result), { unchanged: true, no_audit: true });
});

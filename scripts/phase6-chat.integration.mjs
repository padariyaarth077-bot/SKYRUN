// Prepared integration coverage. Requires separate approval and an already-applied local migration.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
assert.equal(
  process.env.SKYRUN_PHASE6_LOCAL_APPROVAL,
  "skyrun-phase1-core",
  "Explicit Phase 6 isolated test approval is required",
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
  sql("SELECT to_regprocedure('public.chat_staff_action(uuid,uuid,text,text)') IS NOT NULL;"),
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

// All identities and records below are synthetic and retained in this isolated project.
let handler, otherHandler, reader, outsider, handlerId;
async function identity(role, unit) {
  const email = randomUUID() + "@phase6.example.test",
    password = randomUUID() + randomUUID();
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  if (role)
    ok(await admin.from("user_roles").insert({ user_id: user.id, business_unit_id: unit, role }));
  const session = client(status.ANON_KEY);
  ok(await session.auth.signInWithPassword({ email, password }));
  return { session, id: user.id, email, password };
}
async function conversation() {
  const hash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const id = ok(
    await admin.rpc("chat_start_conversation", {
      _business_unit_id: bu,
      _session_token_hash: hash,
    }),
  );
  return { id, hash };
}
const load = (c, session = admin) =>
  session.rpc("chat_load_page", {
    _session_token_hash: c.hash,
    _before_created_at: null,
    _before_id: null,
  });
const send = (c, operation = randomUUID(), message = "TEST ONLY visitor") =>
  admin.rpc("chat_send_message", {
    _session_token_hash: c.hash,
    _operation_id: operation,
    _message: message,
    _reply: "TEST ONLY preset answer",
  });
const action = (session, c, kind, message = "", operation = randomUUID()) =>
  session.rpc("chat_staff_action", {
    _conversation_id: c.id,
    _operation_id: operation,
    _action: kind,
    _message: message,
  });
before(async () => {
  const parent = ok(
    await admin.from("business_units").select("organization_id").eq("id", bu).single(),
  );
  const foreign = randomUUID();
  ok(
    await admin.from("business_units").insert({
      id: foreign,
      organization_id: parent.organization_id,
      name: "TEST ONLY Phase6 other",
      slug: "phase6-" + randomUUID(),
      business_type: "LIMO",
    }),
  );
  const first = await identity("SUPPORT", bu);
  handler = first.session;
  handlerId = first.id;
  otherHandler = (await identity("DISPATCHER", bu)).session;
  reader = (await identity("CONTENT_MANAGER", bu)).session;
  outsider = (await identity("ADMIN", foreign)).session;
});
test("session retries are stable; visitor loading is read-only and does not expose capability hashes", async () => {
  const c = await conversation();
  assert.equal(
    ok(
      await admin.rpc("chat_start_conversation", {
        _business_unit_id: bu,
        _session_token_hash: c.hash,
      }),
    ),
    c.id,
  );
  const before = sql(`SELECT updated_at FROM public.conversations WHERE id='${c.id}';`);
  const page = ok(await load(c));
  assert.equal(page.conversation.id, c.id);
  assert.equal(JSON.stringify(page).includes(c.hash), false);
  assert.equal(sql(`SELECT updated_at FROM public.conversations WHERE id='${c.id}';`), before);
  assert.ok((await load(c, anon)).error);
  assert.ok(
    (
      await admin.rpc("chat_message_page", {
        _conversation_id: c.id,
        _before_created_at: null,
        _before_id: null,
      })
    ).error,
  );
});
test("concurrent visitor retries atomically save one message and one matching preset reply", async () => {
  const c = await conversation(),
    op = randomUUID();
  const results = await Promise.all([send(c, op), send(c, op)]);
  assert.equal(ok(results[0]).message_id, ok(results[1]).message_id);
  const page = ok(await load(c));
  assert.equal(page.messages.filter((m) => m.sender_type === "CUSTOMER").length, 1);
  assert.equal(page.messages.filter((m) => m.message === "TEST ONLY preset answer").length, 1);
  assert.ok((await send(c, op, "changed payload")).error);
  assert.ok((await send(c, randomUUID(), "")).error);
  assert.ok((await send(c, randomUUID(), "x".repeat(1501))).error);
  assert.ok((await send(c)).error, "new rapid message must be throttled");
});
test("handoff is idempotent and suppresses preset responses", async () => {
  const c = await conversation();
  for (let i = 0; i < 2; i++)
    ok(await admin.rpc("chat_request_handoff", { _session_token_hash: c.hash }));
  assert.equal(ok(await send(c)).reply, null);
  assert.equal(ok(await load(c)).messages.filter((m) => m.sender_type === "SYSTEM").length, 1);
  assert.equal(
    sql(
      `SELECT count(*) FROM public.activities WHERE entity_id='${c.id}' AND activity_type='CHAT_HANDOFF';`,
    ),
    "1",
  );
});
test("concurrent staff claims have one owner; repeated reply and resolve are idempotent", async () => {
  const c = await conversation();
  const results = await Promise.all([
    action(handler, c, "claim"),
    action(otherHandler, c, "claim"),
  ]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  const owner = results[0].error ? otherHandler : handler,
    op = randomUUID();
  const replies = await Promise.all([
    action(owner, c, "reply", "TEST ONLY staff", op),
    action(owner, c, "reply", "TEST ONLY staff", op),
  ]);
  replies.forEach(ok);
  assert.equal(ok(await load(c)).messages.filter((m) => m.sender_type === "ADMIN").length, 1);
  assert.equal(
    sql(
      `SELECT count(*) FROM public.activities WHERE entity_id='${c.id}' AND activity_type='CHAT_REPLY';`,
    ),
    "1",
  );
  assert.ok((await action(owner, c, "reply", "different", op)).error);
  const close = randomUUID();
  ok(await action(owner, c, "resolve", "", close));
  ok(await action(owner, c, "resolve", "", close));
  assert.equal(ok(await load(c)).conversation.status, "RESOLVED");
  assert.ok((await send(c)).error);
  assert.ok((await action(owner, c, "claim")).error);
});
test("read-only, roleless, mixed-role and cross-tenant staff cannot handle chats", async () => {
  const c = await conversation();
  for (const session of [reader, outsider, anon, admin, (await identity(null, bu)).session])
    assert.ok((await action(session, c, "claim")).error);
  const mixed = await identity("MANAGER", bu);
  ok(
    await admin
      .from("user_roles")
      .insert({ user_id: mixed.id, business_unit_id: bu, role: "CONTENT_MANAGER" }),
  );
  assert.ok((await action(mixed.session, c, "claim")).error);
  assert.equal(ok(await outsider.from("chat_inbox").select("id").eq("id", c.id)).length, 0);
  assert.ok(
    (
      await outsider.rpc("chat_staff_load", {
        _conversation_id: c.id,
        _before_created_at: null,
        _before_id: null,
      })
    ).error,
  );
  assert.ok(
    (await handler.from("conversations").select("session_token_hash").eq("id", c.id)).error,
  );
  assert.ok(
    (await handler.from("conversations").update({ status: "RESOLVED" }).eq("id", c.id)).error,
  );
  assert.ok(
    (
      await handler
        .from("conversation_messages")
        .insert({ conversation_id: c.id, sender_type: "ADMIN", message: "forged" })
    ).error,
  );
  assert.ok(
    (
      await handler.rpc("log_activity", {
        _entity_type: "conversation",
        _entity_id: c.id,
        _activity_type: "CHAT_REPLY",
        _description: "forged",
        _metadata: {},
      })
    ).error,
  );
});
test("read markers cannot swallow messages that arrived after the observed page", async () => {
  const c = await conversation(),
    first = ok(await send(c));
  assert.equal(
    ok(
      await handler.rpc("chat_mark_read", {
        _conversation_id: c.id,
        _last_customer_message_id: first.message_id,
      }),
    ),
    true,
  );
  // Local test only: simulate a later visitor message without waiting for the UI rate limiter.
  const next = randomUUID();
  sql(
    `INSERT INTO public.conversation_messages(id,conversation_id,sender_type,message,created_at) VALUES('${next}','${c.id}','CUSTOMER','TEST ONLY later',clock_timestamp());`,
  );
  assert.equal(
    ok(
      await handler.rpc("chat_mark_read", {
        _conversation_id: c.id,
        _last_customer_message_id: first.message_id,
      }),
    ),
    false,
  );
  assert.equal(
    ok(await handler.from("chat_inbox").select("unread").eq("id", c.id).single()).unread,
    true,
  );
  assert.equal(
    ok(
      await handler.rpc("chat_mark_read", {
        _conversation_id: c.id,
        _last_customer_message_id: next,
      }),
    ),
    true,
  );
});
test("visitor capabilities and sensitive RPC grants are restricted to intended roles", async () => {
  const c = await conversation(),
    other = await conversation();
  ok(await send(c));
  assert.equal(
    ok(await load(other)).messages.some((m) => m.sender_type === "CUSTOMER"),
    false,
  );
  const serviceFunctions = [
    "chat_load_page(text,timestamp with time zone,uuid)",
    "chat_send_message(text,uuid,text,text)",
    "chat_start_conversation(uuid,text)",
    "chat_load_conversation(text)",
    "chat_append_visitor_message(text,text)",
    "chat_append_bot_message(text,text)",
    "chat_request_handoff(text)",
    "chat_capture_contact(text,text,text,text,text)",
  ];
  for (const name of serviceFunctions) {
    assert.equal(
      sql(
        `SELECT has_function_privilege('anon','public.${name}','EXECUTE') OR has_function_privilege('authenticated','public.${name}','EXECUTE');`,
      ),
      "f",
    );
    assert.equal(
      sql(`SELECT has_function_privilege('service_role','public.${name}','EXECUTE');`),
      "t",
    );
  }
  for (const role of ["anon", "authenticated", "service_role"])
    assert.equal(
      sql(
        `SELECT has_function_privilege('${role}','public.chat_message_page(uuid,timestamp with time zone,uuid)','EXECUTE');`,
      ),
      "f",
    );
});

test("keyset history pagination returns every retained message without duplicates", async () => {
  const c = await conversation();
  sql(
    `INSERT INTO public.conversation_messages(conversation_id,sender_type,message,created_at) SELECT '${c.id}','SYSTEM','TEST ONLY page '||i,clock_timestamp()+i*interval '1 second' FROM generate_series(1,205) i;`,
  );
  let page = ok(await load(c)),
    seen = new Set(page.messages.map((m) => m.id));
  assert.equal(page.messages.length, 100);
  assert.equal(page.has_more, true);
  while (page.has_more) {
    const cursor = page.messages[0];
    page = ok(
      await admin.rpc("chat_load_page", {
        _session_token_hash: c.hash,
        _before_created_at: cursor.created_at,
        _before_id: cursor.id,
      }),
    );
    for (const m of page.messages) {
      assert.equal(seen.has(m.id), false);
      seen.add(m.id);
    }
  }
  assert.equal(seen.size, 206);
});
test("contact capture matches scoped customers and creates one CHATBOT lead, no ride or booking", async () => {
  const c = await conversation(),
    email = randomUUID() + "@phase6.example.test",
    phone = "+1" + randomBytes(5).readUIntBE(0, 5).toString().padStart(12, "0");
  const customer = ok(
    await admin
      .from("customers")
      .insert({
        business_unit_id: bu,
        full_name: "TEST ONLY existing",
        email,
        phone,
      })
      .select("id")
      .single(),
  );
  const args = {
    _session_token_hash: c.hash,
    _name: "TEST ONLY caller",
    _email: email,
    _phone: phone,
    _trip_details: "TEST ONLY no ride",
  };
  const first = ok(await admin.rpc("chat_capture_contact", args));
  assert.equal(ok(await admin.rpc("chat_capture_contact", args)).reference, first.reference);
  const page = ok(await load(c));
  assert.equal(page.conversation.customer_id, customer.id);
  assert.equal(
    ok(await admin.from("leads").select("source").eq("id", page.conversation.lead_id).single())
      .source,
    "CHATBOT",
  );
  assert.equal(
    sql(`SELECT count(*) FROM public.ride_requests WHERE lead_id='${page.conversation.lead_id}';`),
    "0",
  );
});
test("late preset write failure rolls back the visitor message", async () => {
  const c = await conversation(),
    op = randomUUID();
  // Temporary trigger and fixture mutation are contained in an explicitly rolled-back transaction.
  const output = sql(`BEGIN;
    CREATE FUNCTION pg_temp.phase6_fail_bot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.conversation_id='${c.id}' AND NEW.sender_type='BOT' THEN RAISE EXCEPTION 'phase6 injected'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER phase6_failure BEFORE INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION pg_temp.phase6_fail_bot();
    SET LOCAL ROLE service_role;
    DO $$ BEGIN BEGIN PERFORM public.chat_send_message('${c.hash}','${op}','TEST ONLY rollback','TEST ONLY fail');
    RAISE EXCEPTION 'expected injected failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'phase6 injected' THEN RAISE; END IF; END; END $$;
    RESET ROLE;
    SELECT count(*) FROM public.conversation_messages WHERE conversation_id='${c.id}' AND client_operation_id='${op}';
    ROLLBACK;`);
  assert.equal(output, "0");
});
test("late authoritative audit failure rolls back staff message and status", async () => {
  const c = await conversation();
  ok(await action(handler, c, "claim"));
  const op = randomUUID();
  const output = sql(`BEGIN;
    CREATE FUNCTION pg_temp.phase6_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.entity_id='${c.id}' AND NEW.activity_type='CHAT_REPLY' THEN RAISE EXCEPTION 'phase6 injected'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER phase6_failure BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION pg_temp.phase6_fail_audit();
    SELECT set_config('request.jwt.claims','{"sub":"${handlerId}","role":"authenticated"}',true);
    SET LOCAL ROLE authenticated;
    DO $$ BEGIN BEGIN PERFORM public.chat_staff_action('${c.id}','${op}','reply','TEST ONLY rollback');
    RAISE EXCEPTION 'expected injected failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'phase6 injected' THEN RAISE; END IF; END; END $$;
    RESET ROLE;
    SELECT status='HUMAN_HANDLING' AND NOT EXISTS(SELECT 1 FROM public.conversation_messages WHERE conversation_id='${c.id}' AND client_operation_id='${op}') FROM public.conversations WHERE id='${c.id}';
    ROLLBACK;`);
  assert.equal(output.split("\n").at(-1), "t");
});

test(
  "isolated browser visitor and staff exchange persisted messages, resolve, and view public catalogue",
  { timeout: 180000 },
  async () => {
    const actor = await identity("SUPPORT", bu),
      appUrl = "http://127.0.0.1:56500";
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
          NODE_OPTIONS: "--max-old-space-size=512",
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
      stage = "local startup";
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
      const visitor = await browser.newContext(),
        staff = await browser.newContext();
      for (const context of [visitor, staff])
        await context.route("**/*", (route) =>
          [appUrl, status.API_URL].includes(new URL(route.request().url()).origin)
            ? route.continue()
            : route.abort(),
        );
      const page = await visitor.newPage(),
        inbox = await staff.newPage();
      page.setDefaultTimeout(20000);
      inbox.setDefaultTimeout(20000);
      stage = "visitor contact capture";
      await page.goto(appUrl);
      await page.getByRole("button", { name: "Open chat", exact: true }).click();
      await page.getByRole("button", { name: "Share contact details", exact: true }).click();
      const name = "TEST ONLY Browser " + randomUUID();
      await page.getByPlaceholder("Name", { exact: true }).fill(name);
      await page
        .getByPlaceholder("Email", { exact: true })
        .fill(randomUUID() + "@phase6.example.test");
      await page
        .getByPlaceholder("Phone", { exact: true })
        .fill("+1" + randomBytes(5).readUIntBE(0, 5).toString().padStart(12, "0"));
      await page.getByRole("button", { name: "Save enquiry", exact: true }).click();
      await page.getByText(/Your enquiry was saved as/).waitFor();
      const first = "TEST ONLY browser visitor " + randomUUID();
      await page.getByLabel("Chat message", { exact: true }).fill(first);
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await page.getByText(first, { exact: true }).waitFor();
      await page.getByRole("button", { name: "Talk to a person" }).click();
      stage = "staff login";
      await inbox.goto(appUrl + "/j1s30MRp_geRZtdPP860Rw/");
      await inbox.waitForFunction(() => {
        const input = document.querySelector('input[type="email"]');
        return input && Object.keys(input).some((k) => k.startsWith("__reactProps$"));
      });
      await inbox.getByLabel("Email address", { exact: true }).fill(actor.email);
      await inbox.getByLabel("Password", { exact: true }).fill(actor.password);
      await inbox.getByRole("button", { name: "Sign in", exact: true }).click();
      await inbox.waitForURL("**/admin");
      stage = "staff takeover";
      await inbox.goto(appUrl + "/admin/chat-conversations");
      await inbox.getByLabel("Search conversations").fill(name);
      await inbox.getByRole("button", { name: new RegExp(name) }).click();
      await inbox.getByText(first, { exact: true }).waitFor();
      await inbox.getByRole("button", { name: "Take over", exact: true }).click();
      const reply = "TEST ONLY saved staff " + randomUUID();
      await inbox.getByLabel("Reply to visitor", { exact: true }).fill(reply);
      stage = "staff reply persistence";
      await inbox.getByRole("button", { name: "Send reply", exact: true }).click();
      await inbox.getByText(reply, { exact: true }).waitFor();
      await page.getByText(reply, { exact: true }).waitFor();
      await inbox.reload();
      await inbox.getByLabel("Search conversations").fill(name);
      await inbox.getByRole("button", { name: new RegExp(name) }).click();
      await inbox.getByText(reply, { exact: true }).waitFor();
      stage = "manual share link";
      const wa = await inbox
        .getByRole("link", { name: "Open WhatsApp", exact: true })
        .getAttribute("href");
      assert.ok(wa.startsWith("https://wa.me/"));
      assert.ok(decodeURIComponent(wa).includes(appUrl + "/catalogue"));
      assert.equal(wa.includes("/admin/"), false);
      // Never click the outbound link: this test must not open or send a real message.
      stage = "resolution";
      inbox.once("dialog", (dialog) => dialog.accept());
      await inbox.getByRole("button", { name: "Resolve conversation", exact: true }).click();
      await page.getByLabel("Chat message", { exact: true }).waitFor({ state: "visible" });
      await page.waitForFunction(
        () => document.querySelector('input[aria-label="Chat message"]')?.disabled === true,
      );
      stage = "public catalogue";
      await page.goto(appUrl + "/catalogue");
      await page.getByRole("heading", { name: "Skyrun vehicle catalogue", exact: true }).waitFor();
      stage = "public catalogue model and image counts";
      assert.equal(await page.locator("main article").count(), 13);
      assert.equal(await page.locator("main article img").count(), 14);
      stage = "public catalogue image loading";
      for (const photo of await page.locator("main article img").all()) {
        await photo.scrollIntoViewIfNeeded();
        await photo.evaluate((image) => image.decode());
        assert.ok(await photo.evaluate((image) => image.naturalWidth > 0));
      }
      stage = "public catalogue search";
      await page.waitForFunction(() => {
        const input = document.querySelector("main input");
        return input && Object.keys(input).some((k) => k.startsWith("__reactProps$"));
      });
      await page.getByLabel("Search vehicle models").fill("Escalade");
      await page.waitForFunction(() => document.querySelectorAll("main article").length === 1);
    } catch {
      throw new Error(
        "Local Phase 6 browser failed during " + stage + "; sensitive diagnostics withheld.",
      );
    } finally {
      await browser?.close();
      server.kill();
    }
  },
);

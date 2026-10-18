// Local-only end-to-end test. Uses already bundled Playwright; installs nothing.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const isolated = "F:/SKYRUN/skyrun-phase1-core";
const project = "skyrun-phase1-core";
const appUrl = "http://127.0.0.1:56500";
let status;
try {
  status = JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/supabase/dist/supabase.js"),
        "status",
        "--workdir",
        isolated,
        "-o",
        "json",
      ],
      {
        cwd: isolated,
        env: { ...process.env, SUPABASE_PROJECT_ID: project },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
} catch {
  throw new Error("The isolated local Supabase project must be running.");
}
assert.equal(status.API_URL, "http://127.0.0.1:56341");
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { chromium } = await import(
  pathToFileURL(
    "C:/Users/padar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ).href
);
const env = {
  ...process.env,
  NODE_OPTIONS: "--max-old-space-size=384",
  SUPABASE_PROJECT_ID: project,
  VITE_SUPABASE_PROJECT_ID: project,
  SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_URL: status.API_URL,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
};
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
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
// Keep diagnostics in memory; the catch block redacts credentials before reporting failures.
let serverOutput = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => {
    serverOutput = (serverOutput + chunk.toString()).slice(-6000);
  });
let browser;
let page;
const sensitive = [status.ANON_KEY, status.SERVICE_ROLE_KEY];
const ok = (result) => {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Local app server exited before becoming ready: ${serverOutput}`);
    try {
      const response = await fetch(appUrl);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(1000);
  }
  assert.ok(ready, "Local application must become ready");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let privilegedKeyExposed = false;
  const assetChecks = [];
  context.on("response", (response) => {
    if (
      response.request().resourceType() === "script" &&
      new URL(response.url()).origin === appUrl
    ) {
      assetChecks.push(
        response
          .text()
          .then((body) => {
            if (body.includes(status.SERVICE_ROLE_KEY)) privilegedKeyExposed = true;
          })
          .catch(() => {}),
      );
    }
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return [appUrl, status.API_URL].includes(url.origin) ? route.continue() : route.abort();
  });
  page = await context.newPage();
  await page.goto(`${appUrl}/admin/leads/`);
  await page.waitForURL(/j1s30MRp_geRZtdPP860Rw/);
  console.log("PASS: unauthenticated admin access redirects to login");

  await page.goto(`${appUrl}/book`);
  await page.waitForFunction(() => {
    const input = document.querySelector('input[name="name"]');
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"));
  });
  const name = `Phase1 Browser ${randomUUID()}`;
  const email = `${randomUUID()}@phase1.example.test`;
  const fields = {
    name,
    email,
    phone: randomUUID(),
    pickup: "Browser local airport",
    dropoff: "Browser local hotel",
    date: "2026-11-06",
    time: "14:30",
    passengers: "2",
    notes: "Two bags; browser workflow",
  };
  for (const [field, value] of Object.entries(fields))
    await page.locator(`[name="${field}"]`).fill(value);
  await page.locator('[name="service"]').selectOption({ label: "Airport transfer" });
  await page.locator('[name="vehicle"]').selectOption({ label: "Luxury SUV" });
  let failureInjected = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (![appUrl, status.API_URL].includes(new URL(request.url()).origin)) return route.abort();
    if (
      !failureInjected &&
      request.method() === "POST" &&
      new URL(request.url()).origin === appUrl
    ) {
      failureInjected = true;
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("button", { name: /Send ride request/ }).click();
  await page.getByRole("status").filter({ hasText: "Something went wrong" }).waitFor();
  assert.equal(await page.locator('[name="name"]').inputValue(), name);
  assert.equal(await page.locator('[name="pickup"]').inputValue(), fields.pickup);
  console.log("PASS: failed browser submission preserves values and shows safe retry feedback");

  await page.getByRole("button", { name: /Send ride request/ }).click();
  await page.getByRole("status").filter({ hasText: "awaiting review" }).waitFor({ timeout: 30000 });
  const confirmation = await page
    .getByRole("status")
    .filter({ hasText: "awaiting review" })
    .innerText();
  const reference = confirmation.match(/\(ref ([^)]+)\)/)?.[1];
  assert.ok(reference);
  assert.equal(await page.locator('[name="name"]').inputValue(), "");
  const lead = ok(
    await admin
      .from("leads")
      .select("*, customers(*), ride_requests(*)")
      .eq("lead_number", reference)
      .single(),
  );
  assert.equal(lead.source, "RIDE_ENQUIRY");
  assert.equal(lead.status, "NEW");
  assert.equal(lead.customers.email, email);
  assert.equal(lead.ride_requests.length, 1);
  assert.equal(lead.ride_requests[0].pickup_location, fields.pickup);
  await page.screenshot({ path: resolve("phase2-public-confirmation.png"), fullPage: true });
  console.log(
    "PASS: real public form/server/RPC submission persists linked records and resets after confirmation",
  );

  const staffEmail = `${randomUUID()}@phase1.example.test`;
  const password = randomUUID() + randomUUID();
  sensitive.push(password);
  const user = ok(
    await admin.auth.admin.createUser({ email: staffEmail, password, email_confirm: true }),
  ).user;
  ok(
    await admin.from("user_roles").insert({
      user_id: user.id,
      business_unit_id: "00000000-0000-0000-0000-000000000002",
      role: "ADMIN",
    }),
  );
  await page.goto(`${appUrl}/j1s30MRp_geRZtdPP860Rw`);
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="password"]');
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"));
  });
  await page.locator('input[type="email"]').fill(staffEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/, { timeout: 30000 });
  await page.goto(`${appUrl}/admin/leads/?status=NEW&q=${encodeURIComponent(reference)}`);
  await page.getByRole("link", { name: reference }).click();
  await page.goto(`${appUrl}/admin/m/contact-messages`);
  await page.getByText("No records yet.", { exact: true }).waitFor();
  assert.equal(await page.getByText(reference, { exact: true }).count(), 0);
  await page.goto(`${appUrl}/admin/m/ride-enquiries`);
  await page.getByRole("link", { name: reference, exact: true }).click();
  await page.getByText(`Ride enquiry ${lead.ride_requests[0].request_number}`).waitFor();
  await page.goto(`${appUrl}/admin/m/ride-requests`);
  await page.getByRole("link", { name: lead.ride_requests[0].request_number, exact: true }).click();
  console.log(
    "PASS: ride enquiry/request lists link to details and contact filtering excludes ride enquiries",
  );
  await page.getByRole("link", { name: "Open linked lead and activity" }).click();
  await page.getByText(`Ride enquiry ${lead.ride_requests[0].request_number}`).waitFor();
  await page.getByText(`Pickup: ${fields.pickup}`, { exact: true }).waitFor();
  await page.getByText(name, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mark Genuine", exact: true }).click();
  await page.getByRole("button", { name: "Mark Genuine", exact: true }).last().click();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Mark Genuine",
      )?.disabled,
  );
  assert.equal(
    ok(await admin.from("leads").select("status").eq("id", lead.id).single()).status,
    "GENUINE",
  );
  assert.equal(
    ok(
      await admin
        .from("ride_requests")
        .select("status")
        .eq("id", lead.ride_requests[0].id)
        .single(),
    ).status,
    "SUBMITTED",
  );
  await page.screenshot({ path: resolve("phase2-admin-enquiry.png"), fullPage: true });
  console.log(
    "PASS: real local staff login, NEW filtering, customer/trip details and review workflow",
  );
  const noteText = `Phase2 local-only note ${randomUUID()}`;
  await page.getByRole("textbox", { name: "Activity note" }).fill(noteText);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText(noteText, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(noteText, { exact: true }).waitFor();
  const notes = ok(
    await admin
      .from("activities")
      .select("actor_id")
      .eq("entity_id", lead.id)
      .eq("description", noteText),
  );
  assert.equal(notes.length, 1);
  assert.equal(notes[0].actor_id, user.id);
  console.log(
    "PASS: actual authenticated note persists once, refreshes and records the staff actor",
  );
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("link", { name: reference, exact: true }).waitFor();
  await page.getByRole("link", { name: lead.ride_requests[0].request_number, exact: true }).click();
  await page.getByText(`Pickup: ${fields.pickup}`, { exact: true }).waitFor();
  console.log("PASS: real customer history and dedicated ride detail retain entity relationships");
  if (process.env.SKYRUN_PHASE3_LOCAL_APPROVAL === project) {
    await page.goto(`${appUrl}/admin/leads/${lead.id}`);
    await page.getByRole("link", { name: "Prepare quote draft", exact: true }).click();
    await page.getByRole("textbox", { name: "Quote amount" }).fill("125.50");
    await page.getByLabel("Quote expiry").fill("2099-11-06T14:30");
    await page.getByRole("textbox", { name: "Quote notes" }).fill("TEST ONLY local draft");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.waitForURL((url) => /\/admin\/quote\/[0-9a-f-]{36}$/.test(url.pathname));
    const quoteId = new URL(page.url()).pathname.split("/").at(-1);
    const quote = ok(await admin.from("quotes").select("*").eq("id", quoteId).single());
    assert.equal(quote.status, "DRAFT");
    assert.equal(quote.amount, 125.5);
    assert.equal(quote.ride_request_id, lead.ride_requests[0].id);
    assert.equal(quote.customer_id, lead.customer_id);
    assert.equal(quote.created_by, user.id);
    await page.reload();
    await page.getByRole("textbox", { name: "Quote amount" }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Quote amount" }).inputValue(), "125.50");
    assert.equal(
      await page.getByRole("button", { name: /send quote|accept quote|confirm booking/i }).count(),
      0,
    );
    console.log(
      "PASS: real authenticated draft save preserves trip/customer/actor and remains unsent after reload",
    );
    const updatedNotes = "TEST ONLY edited quote " + randomUUID();
    await page.getByRole("textbox", { name: "Quote notes" }).fill(updatedNotes);
    let failedQuoteSave = false;
    await page.route("**/*", (route) => {
      if (![appUrl, status.API_URL].includes(new URL(route.request().url()).origin))
        return route.abort();
      if (
        !failedQuoteSave &&
        route.request().method() === "POST" &&
        new URL(route.request().url()).origin === appUrl
      ) {
        failedQuoteSave = true;
        return route.abort();
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Your entries are preserved" }).waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "Quote notes" }).inputValue(),
      updatedNotes,
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Draft saved. It has not been sent." })
      .waitFor();
    await page.reload();
    await page.getByRole("textbox", { name: "Quote notes" }).waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "Quote notes" }).inputValue(),
      updatedNotes,
    );
    assert.equal(
      ok(
        await admin
          .from("activities")
          .select("id")
          .eq("entity_type", "quote")
          .eq("entity_id", quoteId),
      ).length,
      2,
    );
    assert.equal(ok(await admin.from("bookings").select("id").eq("quote_id", quoteId)).length, 0);
    console.log(
      "PASS: failed quote edit preserves entries; retry persists once with audit and no fabricated booking",
    );
  }
  await Promise.all(assetChecks);
  assert.equal(
    privilegedKeyExposed,
    false,
    "The service-role key must never appear in browser scripts",
  );
  console.log("PASS: loaded browser scripts contain no service-role key");
  console.log(
    `Browser workflow: ${process.env.SKYRUN_PHASE3_LOCAL_APPROVAL === project ? 10 : 8} checks passed; all browser requests restricted to local origins.`,
  );
} catch (error) {
  let message = error instanceof Error ? error.message : "Browser workflow failed";
  if (page && !page.isClosed()) {
    try {
      message += `\nPage: ${page.url()}\nVisible text: ${(await page.locator("body").innerText({ timeout: 3000 })).slice(0, 1200)}`;
      await page.screenshot({ path: resolve("phase2-browser-failure.png"), timeout: 5000 });
    } catch {}
  }
  for (const value of sensitive) if (value) message = message.replaceAll(value, "[redacted]");
  throw new Error(message.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted]"));
} finally {
  await browser?.close();
  server.kill();
}

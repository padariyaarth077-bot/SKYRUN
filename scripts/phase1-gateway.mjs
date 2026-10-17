// Separate fresh local gateway; never replaces an existing image or container.
// API credentials are written through stdin only into the new container's runtime config.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const workspace = "F:/SKYRUN/skyrun-phase1-core";
const project = "skyrun-phase1-core";
const gateway = `supabase_kong_${project}`;
const image = "docker.io/library/kong:2.8.5";
const docker = (args, input) =>
  execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
let servicesReady = false;
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    servicesReady = ["db", "auth", "rest"].every(
      (service) =>
        docker(["inspect", "--format", "{{.State.Running}}", `supabase_${service}_${project}`]) ===
        "true",
    );
    if (servicesReady) break;
  } catch {}
  await delay(500);
}
assert.ok(servicesReady, "Local database, Auth and PostgREST must be running");
const database = JSON.parse(docker(["inspect", `supabase_db_${project}`]))[0];
assert.equal(database.Config.Labels["com.supabase.cli.project"], project);
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
        cwd: workspace,
        env: { ...process.env, SUPABASE_PROJECT_ID: project },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
} catch {
  throw new Error("Cannot read the isolated local Supabase status.");
}
const apiUrl = "http://127.0.0.1:56341";
if (status.API_URL) assert.equal(status.API_URL, apiUrl);
assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY);
const existing = docker(["ps", "-a", "--filter", `name=^/${gateway}$`, "--format", "{{.Names}}"]);
if (existing) throw new Error("Gateway already exists; inspect and reuse it without replacement.");
const config = {
  _format_version: "2.1",
  _transform: true,
  consumers: [
    { username: "anon", keyauth_credentials: [{ key: status.ANON_KEY }] },
    { username: "service_role", keyauth_credentials: [{ key: status.SERVICE_ROLE_KEY }] },
  ],
  acls: [
    { consumer: "anon", group: "anon" },
    { consumer: "service_role", group: "admin" },
  ],
  services: [
    {
      name: "rest-ready",
      url: `http://supabase_rest_${project}:3001/ready`,
      routes: [{ name: "rest-ready", paths: ["/rest-admin/v1/ready"], strip_path: true }],
    },
    {
      name: "auth-v1",
      url: `http://supabase_auth_${project}:9999/`,
      routes: [{ name: "auth-v1", paths: ["/auth/v1/"], strip_path: true }],
      plugins: [
        { name: "cors" },
        { name: "key-auth", config: { hide_credentials: false } },
        { name: "acl", config: { allow: ["anon", "admin"], hide_groups_header: true } },
      ],
    },
    {
      name: "rest-v1",
      url: `http://supabase_rest_${project}:3000/`,
      routes: [{ name: "rest-v1", paths: ["/rest/v1/"], strip_path: true }],
      plugins: [
        { name: "cors" },
        { name: "key-auth", config: { hide_credentials: true } },
        { name: "acl", config: { allow: ["anon", "admin"], hide_groups_header: true } },
      ],
    },
  ],
};
docker([
  "run",
  "-d",
  "--name",
  gateway,
  "--network",
  `supabase_network_${project}`,
  "--label",
  `com.supabase.cli.project=${project}`,
  "--label",
  `com.supabase.cli.workdir=${workspace}`,
  "-p",
  "127.0.0.1:56341:8000",
  "-e",
  "KONG_DATABASE=off",
  "-e",
  "KONG_NGINX_WORKER_PROCESSES=1",
  "-e",
  "KONG_DECLARATIVE_CONFIG=/tmp/kong.yml",
  "-e",
  "KONG_PROXY_LISTEN=0.0.0.0:8000",
  "-e",
  "KONG_ADMIN_LISTEN=127.0.0.1:8001",
  "--health-cmd",
  "kong health",
  "--health-interval",
  "5s",
  "--health-retries",
  "12",
  "--entrypoint",
  "/bin/sh",
  image,
  "-c",
  "while [ ! -s /tmp/kong.yml ]; do sleep 1; done; exec /docker-entrypoint.sh kong docker-start",
]);
docker(
  [
    "exec",
    "-i",
    gateway,
    "/bin/sh",
    "-c",
    "cat > /tmp/kong.pending && mv /tmp/kong.pending /tmp/kong.yml",
  ],
  JSON.stringify(config),
);
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(`${apiUrl}/rest/v1/`, {
      headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}` },
    });
    if (response.ok) {
      const denied = await fetch(`${apiUrl}/rest/v1/`);
      assert.equal(denied.status, 401, "Gateway must reject requests without API credentials");
      console.log(
        "Local gateway ready; API-key authentication is enforced. Existing images and containers were not replaced.",
      );
      process.exit(0);
    }
  } catch {}
  await delay(1000);
}
throw new Error("Local gateway failed its authenticated readiness check.");

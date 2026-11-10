import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const read = (path) => readFileSync(path, "utf8");
const html = read("index.html");
const sw = read("sw.js");
const routes = JSON.parse(read("_routes.json"));
const pkg = JSON.parse(read("package.json"));

const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inline = tags.filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
assert.equal(inline.length, 0, "Browser scripts must live in ordered external assets.");

const sources = tags.map(([, attrs]) => attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1]).filter(Boolean);
assert(sources.some((url) => url.includes("exceljs@4.4.0")), "Pinned ExcelJS dependency is missing.");
for (const url of sources.filter((url) => url.startsWith("/assets/js/"))) {
  const path = url.split("?")[0].replace(/^\//, "");
  assert(existsSync(path), "Missing browser script: " + path);
  new vm.Script(read(path), { filename: path });
}

assert(html.includes("/assets/css/mytime.css?v=1.2.0"), "Versioned app stylesheet is missing.");
assert(existsSync("assets/css/mytime.css"), "Main stylesheet asset is missing.");
assert(!/<style\b/i.test(html), "Main document should not contain inline CSS.");
assert(sw.includes("foss-mytime-shell-v4"), "Service worker cache version is not updated.");
assert(sw.includes("url.pathname.startsWith('/api/')"), "API requests must bypass service-worker caching.");
assert(sw.includes("cache: 'no-store'"), "API requests must use a fresh network response.");
assert(!/cache\.(?:put|add|addAll)\([^)]*api\//i.test(sw), "API responses must never be added to Cache Storage.");

for (const path of [
  "functions/_shared/access-auth.js",
  "functions/api/records.js",
  "functions/api/whoami.js",
  "functions/api/make-webhook.js",
  "functions/api/power-automate.js",
  "functions/_middleware.js",
  "sw.js",
]) {
  const check = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  assert.equal(check.status, 0, path + " syntax failed: " + check.stderr);
}

assert(routes.include.includes("/api/*"), "Pages API routes are not included.");
assert(read("functions/api/records.js").includes("WHERE email = ? AND revision = ?"), "D1 record writes must compare the expected revision.");
assert(read("functions/api/make-webhook.js").includes("filter(isCalendarDate)"), "Make weekly reports must use strict date validation.");
assert(read("functions/api/power-automate.js").includes("time.fossna.cloud"), "Power Automate must allow the production app origin.");
assert(pkg.scripts?.test, "Repository test script is missing.");

console.log("myTIME audit passed: browser assets, syntax, Access auth, D1 revision guards, webhook routing, and service-worker policy.");

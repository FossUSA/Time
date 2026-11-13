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

assert(html.includes("/assets/css/mytime.css?v=1.3.0"), "Versioned app stylesheet is missing.");
assert(existsSync("assets/css/mytime.css"), "Main stylesheet asset is missing.");
assert(!/<style\b/i.test(html), "Main document should not contain inline CSS.");
assert(sw.includes("foss-mytime-shell-v14"), "Service worker cache version is not updated.");
assert(sw.includes("url.pathname.startsWith('/api/')"), "API requests must bypass service-worker caching.");
assert(sw.includes("cache: 'no-store'"), "API requests must use a fresh network response.");
assert(html.includes("/assets/js/05-cloud-merge.js?v=1.3.0"), "The punch conflict merger must load before app core.");
assert(read("assets/js/05-cloud-merge.js").includes("mergePunches"), "The punch conflict helper is required.");
assert(read("assets/js/10-app-core.js").includes("window.MyTimeCloudMerge.mergePunches(base,local,remote)"), "Punch conflicts must use identity-aware three-way merging.");
assert(read("assets/js/10-app-core.js").includes("await window.myTimeFlushCloudSync()"), "Workday settings must await Cloudflare confirmation.");
assert(read("assets/js/10-app-core.js").includes("latest.payload.settings,settings"), "Settings must be read back from D1 before confirming.");
assert(read("assets/js/20-navigation.js").includes("originalPunches.filter(item=>!selectedOriginal.has(item))"), "Editing core punches must preserve separate break events.");
assert(read("assets/js/20-navigation.js").includes("before,after"), "Manual corrections must retain before/after audit values.");

const releaseChecker = read("assets/js/30-quality-of-life.js");
assert(releaseChecker.includes("release?.announcement===true"), "Only explicitly announced releases may show the update banner.");
assert(releaseChecker.includes("release.version!==currentRelease"), "The banner must be for a newer release than the open page.");
assert(!releaseChecker.includes("setInterval(checkPage,30000)"), "The old generic 30-second page hash checker must be removed.");
assert(!releaseChecker.includes("if(reg.waiting)announce()"), "Service-worker updates alone must never show the banner.");
assert(existsSync("release.json"), "Major release metadata is required.");
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
assert(read("functions/api/records.js").includes("unchanged: true"), "Repeated or UI-only payloads must not increment the D1 revision.");
assert(read("functions/api/records.js").includes("foss-time-recovery-snapshot-v1-status"), "Browser recovery snapshots must be excluded by the server too.");
assert(read("functions/api/make-webhook.js").includes("filter(isCalendarDate)"), "Make weekly reports must use strict date validation.");
assert(read("functions/api/power-automate.js").includes("time.fossna.cloud"), "Power Automate must allow the production app origin.");
const webhookUi = read("assets/js/40-webhook-integrations.js");
assert(webhookUi.includes(String.raw`powerplatform\.com`) && webhookUi.includes(String.raw`azure-apihub\.net`), "Power Automate browser allowlist must match its Pages API allowlist.");
assert(!webhookUi.includes(String.raw`flow\.microsoft\.com`) && !webhookUi.includes(String.raw`powerautomate\.com`), "Power Automate UI must not promise domains rejected by its API.");
assert(read("assets/js/10-app-core.js").includes("shouldSyncCloudStorageKey(key)"), "Cloud storage observation must use the explicit allowlist.");
assert(!read("assets/js/10-app-core.js").includes("String(key).startsWith('foss-time-')&&!cloudHydrating"), "Every local UI snapshot must not trigger a cloud write.");
assert(!read("assets/js/30-quality-of-life.js").includes("priorRender();snapshot()"), "The 15-second dashboard refresh must not write a recovery snapshot.");
assert(read("assets/js/10-app-core.js").includes("foss-time-recovery-snapshot-v1-status"), "Local recovery snapshots must stay out of the cloud-sync stream.");
const calendarUi = read("assets/js/20-navigation.js");
assert(calendarUi.includes("function calendarBreakSummary"), "Documented break entries must have one shared display formatter.");
assert(calendarUi.includes("calendarBreakSummary(rec,true)"), "The Records manager must display documented break entries.");
assert(calendarUi.includes("calendar-print-breaks"), "Printed calendars must display documented break entries separately from punches.");
assert(calendarUi.includes("hasDocumentedBreakRecord(rec)"), "Calendar must include days with documented breaks even when they have no punches.");
assert(calendarUi.includes("Lunch deducted from paid time"), "Calendar analysis must distinguish the paid-time lunch deduction.");
assert(calendarUi.includes("id=\'editSelectedDayInRecords\'") || calendarUi.includes("editSelectedDayInRecords"), "Calendar must link to the one correction form in Manage Records.");
assert(calendarUi.includes("window.myTimeShowPage('records')"), "Calendar edit links must open the Manage Records correction form.");
assert(!calendarUi.includes("calendarPunchControls") && !calendarUi.includes("calendarBreakControls"), "Calendar must not duplicate the Manage Records editor.");
assert(!calendarUi.includes("saveCalendarMakeUpNote"), "Make-up notes must be saved in the single Manage Records form.");
assert(!calendarUi.includes("Save selected-day changes"), "Calendar must not expose a second record save action.");
assert(calendarUi.includes("async function verifyDateRecordSaved"), "Manage Records must verify the exact edited date against D1.");
assert(calendarUi.includes("stableRecordJson(payload.payload.records?.[dateKey]||null)"), "Record save confirmation must compare the complete record, not just the request response.");
assert(calendarUi.includes("Lunch out and lunch in must both be entered"), "Record editor must reject incomplete lunch punch pairs.");
assert(calendarUi.includes("Enter both start and end times for '+name"), "Record editor must reject incomplete documented break ranges.");
assert(calendarUi.includes("record-date-select"), "The read-only history table must select a date into the single correction form.");
assert(!calendarUi.includes("record-row-actions"), "The records table must not contain a second Edit/Delete action area.");
assert(read("index.html").includes('id="editMakeUpNote"'), "Make-up notes must be edited in the single correction form.");
assert(calendarUi.includes("editMakeUpNote"), "The single record save must load and save make-up notes.");
const cloudCore = read("assets/js/10-app-core.js");
assert(cloudCore.includes("if(cloudSyncReady&&!cloudSyncBlocked)"), "A failed browser recovery write must not block an authenticated Cloudflare save.");
assert(cloudCore.includes("Cloudflare save continues"), "Recovery-storage failure should be non-blocking and reported.");
assert(cloudCore.includes("data=remote.records"), "Cloudflare records must be loaded into memory independently of browser storage.");
assert(cloudCore.includes("safeCloudStorageGet"), "Optional browser storage reads must be guarded.");
assert(pkg.scripts?.test, "Repository test script is missing.");

console.log("myTIME audit passed: browser assets, syntax, Access auth, D1 revision guards, webhook routing, and service-worker policy.");

const recordEditor = read("assets/js/20-navigation.js");
assert(html.includes('id="recordPaidTimePreview"'), "Record editor must show a paid-time preview.");
assert(html.includes('id="copyDocumentedLunchToPunches"'), "Record editor must offer an explicit documented-lunch to punch copy action.");
assert(recordEditor.includes("function calculateRecordPaidMinutes(input)"), "Paid time preview calculation is required.");
assert(recordEditor.includes("updateRecordPaidTimePreview()"), "Paid time preview must update when punch inputs change.");
assert(recordEditor.includes("document.getElementById('editLunchOut').value=start"), "Copy action must map documented lunch start to paid-time lunch-out.");
assert(recordEditor.includes("document.getElementById('editLunchIn').value=end"), "Copy action must map documented lunch end to paid-time lunch-in.");

assert(calendarUi.includes("calendarPunchOnlyIntervalMinutes"), "Read-only Calendar analysis must distinguish paid-time lunch from documented lunch.");
assert(calendarUi.includes("editSelectedDayInRecords"), "Calendar must open the single Manage Records correction form for a selected day.");
assert(!calendarUi.includes("calendarPunchControls") && !calendarUi.includes("calendarBreakControls"), "Calendar must not contain duplicate editable controls.");
assert(!calendarUi.includes("copyCalendarDocumentedLunchToPunches"), "Lunch corrections must be made only in Manage Records.");
assert(!calendarUi.includes("saveCalendarMakeUpNote"), "Calendar must not have a separate make-up note save action.");

const cloudCoreSave = read("assets/js/10-app-core.js");
const recordSaveUi = read("assets/js/20-navigation.js");
assert(cloudCoreSave.includes("window.myTimeSaveAndVerifyRecord=async function(dateKey,expectedRecord)"), "Save changes must have a direct Cloudflare save-and-verify path.");
assert(cloudCoreSave.includes("cloudSyncDirty=true;") && cloudCoreSave.includes("await window.myTimeFlushCloudSync();"), "The explicit save must force the D1 sync before read-back.");
assert(cloudCoreSave.includes("cloudValueEqual(cloudRecord,expectedRecord)"), "A save must verify the exact edited date against the D1 response.");
assert(recordSaveUi.includes("window.myTimeSaveAndVerifyRecord"), "Manage Records must use the immediate D1 verification helper.");
assert(recordSaveUi.includes("recordEditSaveStatus"), "Manage Records must show save confirmation beside Save changes.");
assert(html.includes('id="recordEditSaveStatus"'), "The record editor must contain its visible save status.");
assert(recordSaveUi.includes("hasMakeUpNoteEdit"), "A make-up-note-only correction must be saveable.");
assert(!recordSaveUi.includes("The browser could not store a temporary copy"), "Browser recovery storage must not be treated as the required record save.");

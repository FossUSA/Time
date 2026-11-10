import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedFossEmail, verifiedAccessEmail } from "../../functions/_shared/access-auth.js";
import { allowedAppOrigin, allowedFlowUrl } from "../../functions/api/power-automate.js";
import { isCalendarDate } from "../../functions/api/make-webhook.js";

test("FOSS account emails are case-insensitive and domain-specific", () => {
  assert.equal(isAuthorizedFossEmail("jowu@fossna.com"), true);
  assert.equal(isAuthorizedFossEmail("JOWU@FOSSNA.COM"), true);
  assert.equal(isAuthorizedFossEmail("jowu@example.com"), false);
  assert.equal(isAuthorizedFossEmail("jowu@fossna.com.attacker.test"), false);
  assert.equal(isAuthorizedFossEmail(""), false);
});

test("Access verification fails closed without its signed JWT", async () => {
  await assert.rejects(
    () => verifiedAccessEmail(new Request("https://time.fossna.cloud/api/records")),
    /signed identity token/
  );
});

test("Power Automate accepts only the production domain and Pages hostnames", () => {
  assert.equal(allowedAppOrigin("https://time.fossna.cloud"), true);
  assert.equal(allowedAppOrigin("https://foss-time.pages.dev"), true);
  assert.equal(allowedAppOrigin("https://preview.foss-time.pages.dev"), true);
  assert.equal(allowedAppOrigin("https://time.fossna.cloud.attacker.test"), false);
  assert.equal(allowedAppOrigin("http://time.fossna.cloud"), false);
  assert.equal(allowedAppOrigin("https://example.com"), false);
});

test("Power Automate accepts only approved HTTPS trigger hosts", () => {
  assert.equal(allowedFlowUrl("https://prod-01.logic.azure.com/workflows/abc/triggers/manual/paths/invoke"), true);
  assert.equal(allowedFlowUrl("https://example.azure-apihub.net/apim/flow"), true);
  assert.equal(allowedFlowUrl("http://prod.logic.azure.com/flow"), false);
  assert.equal(allowedFlowUrl("https://logic.azure.com.attacker.test/flow"), false);
  assert.equal(allowedFlowUrl("https://user:pass@logic.azure.com/flow"), false);
});

test("weekly Make report dates must be valid calendar dates", () => {
  assert.equal(isCalendarDate("2026-11-10"), true);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2026-13-01"), false);
  assert.equal(isCalendarDate("10/11/2026"), false);
  assert.equal(isCalendarDate("2026-11-10x"), false);
});

import { normalizeCloudPayload, stableCloudJson } from "../../functions/api/records.js";

test("D1 payloads exclude browser-local recovery snapshots", () => {
  const source = {
    records: { "2026-11-10": { punches: [{ type: "in", ts: 1 }] } },
    localState: {
      "foss-time-theme-v1": "dark",
      "foss-time-recovery-snapshot-v1": "{local copy}",
      "foss-time-recovery-snapshot-v1-status": "2026-11-10T12:00:00Z"
    }
  };
  const normalized = normalizeCloudPayload(source);
  assert.equal(normalized.localState["foss-time-theme-v1"], "dark");
  assert.equal("foss-time-recovery-snapshot-v1" in normalized.localState, false);
  assert.equal("foss-time-recovery-snapshot-v1-status" in normalized.localState, false);
  assert.equal("foss-time-recovery-snapshot-v1" in source.localState, true, "Normalization must not mutate the caller's payload.");
});

test("D1 payload comparison is stable across object-key ordering", () => {
  const a = { settings: { start: "08:00", end: "17:00" }, records: { "2026-11-10": { punches: [] } } };
  const b = { records: { "2026-11-10": { punches: [] } }, settings: { end: "17:00", start: "08:00" } };
  assert.equal(stableCloudJson(a), stableCloudJson(b));
});

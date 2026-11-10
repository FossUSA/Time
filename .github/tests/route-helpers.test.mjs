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

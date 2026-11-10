# FOSS myTIME

FOSS myTIME is FOSS North America's personal time clock, served at **https://time.fossna.cloud**.

## Runtime architecture

- **Cloudflare Access** authenticates FOSS users before the app and its APIs are available.
- **Cloudflare Pages Functions** provide identity, D1 records, webhook delivery, and MCP routes.
- **Cloudflare D1** is the authoritative per-account store for punches, lunch/rest-break records, schedules, time-bank entries, and profile preferences.
- **Browser storage** is a temporary cache/recovery layer only. It is never treated as a confirmed save. The primary status says `Cloud saved` only after D1 acknowledges the write.
- **The service worker** caches the app shell only. All `/api/*` requests go directly to the network and are never served from Cache Storage.
- **The optional encrypted backup panel** is a secondary recovery copy. It is independent of automatic D1 saving and cannot change the main D1 save status.
- **Make / Power Automate** handle outbound report delivery. They are independent of sign-in and D1 record storage.

## Repository layout

```text
assets/
  css/mytime.css                 Main application stylesheet
  js/
    00-cloud-startup.js          Hide the app until cloud data is loaded
    10-app-core.js               Clock, punches, cloud sync and primary UI
    20-navigation.js             Tab/page navigation
    30-quality-of-life.js        Analytics, recovery, theme and install
    40-webhook-integrations.js   Webhook settings and delivery
    50-encrypted-backup.js       Optional secondary encrypted backup
    60-email-renderer.js          Responsive FOSS weekly email renderer
functions/
  _shared/access-auth.js         Shared Cloudflare Access JWT verification
  _middleware.js                 OAuth and remote MCP routes
  api/                           Pages Function APIs
sw.js                            App-shell caching; API routes are network-only
wrangler.toml                    D1 and OAuth KV bindings
_headers                         Static asset cache and security headers
```

Browser scripts are classic scripts and must stay in the numbered loading order. Keep them synchronous unless a separately tested dependency audit proves that `defer` or modules are safe.

## Local checks

Use Node.js 22 or newer:

```sh
npm test
```

The test suite validates FOSS identity rules, webhook host/date validation, static asset references, JavaScript syntax, D1 revision guards, and service-worker cache policy. A local file preview does not reproduce Cloudflare Access or production D1 bindings.

## Data safety rules

- Never delete or recreate the production D1 database during routine maintenance.
- Never treat `localStorage` as the authoritative record store.
- Never upload an older browser snapshot over a newer D1 revision.
- D1 writes must use the integer revision compare-and-swap check.
- Failed saves must remain visibly unconfirmed and retain pending edits.
- Conflict resolution does not automatically download JSON files; JSON export is user-initiated only.

## Production services

- Primary app: https://time.fossna.cloud
- Pages fallback: https://foss-time.pages.dev
- MCP: https://mcp.fossna.cloud/api/mcp
- D1 binding: `MYTIME_DB`
- OAuth KV binding: `OAUTH_KV`

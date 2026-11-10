# FOSS myTIME MCP and OAuth

## Endpoints
- MCP Streamable HTTP: https://mcp.fossna.cloud/api/mcp
- OAuth issuer: https://mcp.fossna.cloud
- Authorization: https://mcp.fossna.cloud/authorize
- Token endpoint: https://mcp.fossna.cloud/oauth/token
- Protected-resource metadata: published by the OAuth provider for /api/mcp

## Identity and authorization
The OAuth authorization page is protected by Cloudflare Access at mcp.fossna.cloud/authorize. The Access application allows only the configured FOSS North America identity provider and @fossna.com email domain. The authenticated email is stored as the OAuth subject and encrypted token props. The MCP resource validates OAuth tokens and the resource audience before tools run.

Scopes:
- mytime:read — read only the authenticated user's records and schedule.
- mytime:write — reserved for approval-gated record changes; do not grant until write approvals and audit handling are deployed and tested.
- offline_access — refresh token access for supported clients.

## Current MCP tools
- mytime_status
- mytime_timecard_summary
- mytime_day_punches
- mytime_schedule
- mytime_time_bank
- mytime_analyze_week

All current tools are read-only. Write actions are intentionally withheld until a per-action approval mechanism, audit log, concurrency protection, and end-to-end tests are in place.

## ChatGPT connection
In ChatGPT web, open Settings > Apps (or Plugins, depending on the client UI), choose Add custom MCP server, and enter:
- Name: FOSS myTIME
- Server URL: https://mcp.fossna.cloud/api/mcp
- Authentication: OAuth

Complete the Cloudflare Access sign-in and review the requested scopes on the FOSS myTIME consent screen. ChatGPT must show the OAuth connection as connected before use.

## Email/report delivery
The MCP server does not send email. Weekly report delivery needs a verified sending provider or an approved Power Automate/Logic Apps webhook, sender-domain verification, and test delivery to the two configured recipients. Do not store provider secrets in the browser or Git repository.

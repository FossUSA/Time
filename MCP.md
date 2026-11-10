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
Read tools:
- mytime_status
- mytime_timecard_summary
- mytime_day_punches
- mytime_schedule
- mytime_time_bank
- mytime_analyze_week

Controlled write tool:
- mytime_correct_punch — corrects one existing punch for the authenticated account only. It requires the separate `mytime:write` OAuth scope, a correction reason, and `confirm: true`. It writes an audit entry and uses an updated_at compare-and-swap check to prevent overwriting concurrent edits. It cannot add or delete punches. The consent screen leaves `mytime:write` unchecked by default. Configure ChatGPT to ask before every invocation where that control is available.

## Weekly email delivery
The active Make scenario `myTIME — Weekly Timecard Email Intake` uses the existing Microsoft 365 connection. Its recipient list is explicitly set to:
- wuflestad@att.net
- jowu@fossna.com

The app's Friday clock-out hook flushes the latest cloud record first, then sends the complete Monday-Friday report to the managed Make webhook. A D1 delivery ledger prevents duplicate weekly sends and allows failed deliveries to be retried. The Integrations page has a **Send test email** action; it prefixes the subject with [TEST]. A successful webhook response means Make accepted the payload, not that the destination mailboxes have received it; verify the Make execution and the two mailboxes.

The email renderer uses the small white FOSS logo asset and a responsive Outlook-friendly layout. No IQX branding is used.

## ChatGPT connection
In ChatGPT web, open Settings > Apps (or Plugins, depending on the client UI), choose Add custom MCP server, and enter:
- Name: FOSS myTIME
- Server URL: https://mcp.fossna.cloud/api/mcp
- Authentication: OAuth

Complete the Cloudflare Access sign-in and review the requested scopes on the FOSS myTIME consent screen. ChatGPT must show the OAuth connection as connected before use.

## Email/report delivery
The MCP server does not send email. Weekly report delivery needs a verified sending provider or an approved Power Automate/Logic Apps webhook, sender-domain verification, and test delivery to the two configured recipients. Do not store provider secrets in the browser or Git repository.


## ChatGPT plan availability
OpenAI's current Help Center states that full custom MCP support with write actions is available on ChatGPT Business and Enterprise/Edu workspaces. Pro can connect custom MCP servers with read/fetch permissions; Free does not currently have full custom MCP support documented. If the account does not expose **Plugins > Add custom MCP server**, use a supported Business/Enterprise/Edu workspace for the full write-enabled connection.
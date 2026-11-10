# FOSS myTIME MCP Server

Endpoint: https://time.fossna.cloud/api/mcp

This MCP endpoint is served by Cloudflare Pages Functions using Cloudflare's stateless Agents SDK MCP handler.

## Authentication and data isolation
- The endpoint requires the Cloudflare Access identity header.
- Only authenticated `@fossna.com` identities are accepted.
- Every tool reads only the D1 row whose email exactly matches the authenticated identity.
- The initial tool set is read-only. No clock punches, record edits, deletes, or email sends can be triggered through MCP.

## Tools
- `mytime_status`: identity, cloud record status, schedule targets.
- `mytime_timecard_summary`: daily and aggregate paid time over a date range.
- `mytime_day_punches`: detailed punch timeline for one date.
- `mytime_schedule`: work schedule and break/lunch settings.
- `mytime_time_bank`: time-bank entries.

## Connecting an MCP client
Use Streamable HTTP with:
`https://time.fossna.cloud/api/mcp`

The client must complete Cloudflare Access authentication for the protected hostname. Do not share an Access service token or bypass the Access policy.

## Future extensions
After testing and approval, add explicit write tools with confirmation/idempotency for corrections and punch actions; add email preview/test/send tools; and add a report resource for weekly/monthly exports.

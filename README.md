# FOSS TIME

A lightweight, responsive time-clock prototype for FOSS North America.

## Run locally
Open `index.html` in a modern browser. No build step is required.

## Current features
- Live clock and today's punch timeline
- Clock in, start/end lunch, and clock out with sequence validation
- Paid time, remaining goal, and projected finish estimates
- Configurable schedule and daily paid-hours target
- Monthly timesheet, CSV export, JSON backup/restore, print view
- Punch correction flow requiring a reason and recording an audit entry
- Browser-local persistence

## Important limitations
This is a prototype, not an official payroll system. Records are stored only in the current browser's local storage. They do not sync across devices or employees and are not protected by user accounts or server-side access controls. Browser data can be cleared or changed by the user. Do not use it as an authoritative employee timekeeping or payroll record. Back up data regularly. No Microsoft integration or external data service is configured.

## Hosting
The site is a static HTML page and can be deployed on Cloudflare Pages. The GitHub repository is separate from the People Lookup project.


Cloudflare Pages project: `foss-time.pages.dev` (deployment status should be checked in Cloudflare).

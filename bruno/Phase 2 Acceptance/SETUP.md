# Phase 2 Acceptance — Bruno Setup

## Environment variables to fill before running

Open Bruno → Environments → local and set:

### Always required
| Variable | Value |
|---|---|
| `baseUrl` | `https://sublimetheme.test` |
| `testEmail` | `qa-phase2@sublimecrm.test` (unique — change if this email already has a ticket) |

### For requests 05–08 and 11 (session cookie)
After running request 03, check your email (or DB `wp_stcrm_tokens`) for the magic link.
Redeem the link in a browser tab. Then:
1. Open DevTools → Application → Cookies → `sublimetheme.test`
2. Copy the value of `stcrm_session`
3. Paste it into `sessionCookie` in the environment

### For requests 09–11 (admin — Application Password)
1. WP Admin → Users → your admin profile → scroll to **Application Passwords**
2. Enter name "Bruno" → **Add New Application Password**
3. Copy the generated password (shown once)
4. Set `adminUser` = your WP admin username
5. Set `adminAppPassword` = the generated password (spaces are fine, Bruno handles it)

### nonce variable (requests 09–10)
The admin endpoints also check `X-WP-Nonce`. With Application Password auth this is
optional for read requests but required by our `authenticate_admin()` for writes.

Easiest way to get a nonce:
1. Log into WP admin
2. Open browser console on any admin page
3. Run: `wpApiSettings.nonce`
4. Copy the value into the `nonce` environment variable

---

## Run order

Run requests 01–11 in sequence. Requests 05–11 depend on `ticketId` being set
by request 01's post-response script — run them in the same Bruno session.

After request 04, pause to redeem the magic link and set `sessionCookie` before continuing.

## Cleanup

After the run, delete the test contact/ticket from the DB or via phpMyAdmin
so the next run starts clean (or change `testEmail` in the environment).

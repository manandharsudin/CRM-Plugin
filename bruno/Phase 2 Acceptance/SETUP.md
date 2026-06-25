# Phase 2 Acceptance — Bruno Setup

## Environment variables to fill before running

Open Bruno → Environments → local and set:

### Always required
| Variable | Value |
|---|---|
| `baseUrl` | `https://sublimetheme.test` |
| `testEmail` | `qa-phase2@sublimecrm.test` (unique — change if this email already has a ticket) |

### For requests 09–10 (admin — Application Password)
1. WP Admin → Users → your admin profile → scroll to **Application Passwords**
2. Enter name "Bruno" → **Add New Application Password**
3. Copy the generated password (shown once)
4. Set `adminUser` = your WP admin username
5. Set `adminAppPassword` = the generated password (spaces are fine, Bruno handles it)

> `nonce` is not required when using Application Passwords — leave it empty.

### For requests 05–08 and 11 (session cookie)

Email is not configured in local dev, so magic links won't arrive. Use the PHP helper instead:

1. Run requests 01–02 first (creates the test contact in the DB)
2. Visit: `https://sublimetheme.test/stcrm-gen-test-session.php?email=qa-phase2@sublimecrm.test`
3. Copy the token shown on the page
4. Set `sessionCookie` = that token in Bruno Environments → local
5. Delete `stcrm-gen-test-session.php` from the WordPress root when done

---

## Run order

Run requests 01–11 in sequence. `ticketId` is captured from request 01's post-response
script and used by requests 05–11 — run them in the same Bruno session.

**Pause after request 02** to generate the session cookie (steps above) and fill in
`adminAppPassword` before continuing.

## Cleanup

After the run, delete the test contact/ticket from the DB (phpMyAdmin) or change
`testEmail` in the environment so the next run starts clean.

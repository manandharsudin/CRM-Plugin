# SublimeCRM — Phase Plan for ClickUp
> Ready to import as tasks. Structure: Phase = List · Task group = Section · Task = Task · Bullets = Subtasks

---

## PHASE 1 — Foundation
> Goal: Plugin installs cleanly, Freemius contacts sync, settings screen works.
> No ticket UI yet. Done when existing Freemius customers appear as contacts and a test purchase/cancel updates tier within seconds.

---

### 1.1 Plugin Scaffold

- [ ] Create main plugin file with WordPress headers, constants, bootstrap
  - Define `PLUGIN_FILE`, `PLUGIN_DIR`, `PLUGIN_URL`, `PLUGIN_VERSION`, `PRODUCT_ID`
  - Register activation / deactivation / uninstall hooks
- [ ] Set up PSR-4 autoloader (Composer or manual class map)
- [ ] Create folder structure: `app/Models`, `app/Controllers`, `app/Services`, `app/Hooks`, `includes/Database`, `includes/Api`, `src/blocks`, `build`, `assets`
- [ ] Add `composer.json` with Action Scheduler as a dependency
- [ ] Confirm plugin activates on local Laragon environment without errors

---

### 1.2 Database — Tables & Migrations

- [ ] Create `Database\Installer` class using `dbDelta()`
  - `wp_stcrm_contacts` table (all columns + indexes per spec §3.1)
  - `wp_stcrm_tickets` table (all columns + indexes per spec §3.2)
  - `wp_stcrm_messages` table (all columns + indexes per spec §3.3)
  - `wp_stcrm_tokens` table (all columns + indexes per spec §3.4)
- [ ] Store schema version in `wp_options` (`crm_db_version`)
- [ ] Write upgrade routine — check stored version vs current, run delta migrations
- [ ] Run installer on plugin activation hook
- [ ] Verify all 4 tables created correctly in Laragon database

---

### 1.3 Bundle Action Scheduler

- [ ] Require Action Scheduler via Composer or vendor copy
- [ ] Register Action Scheduler store on `init`
- [ ] Confirm Action Scheduler admin screen appears under Tools

---

### 1.4 Admin Menu Registration

- [ ] Register top-level "Support" menu page (ticket icon, capability `stcrm_manage_tickets`)
- [ ] Register submenu pages: Inbox, Contacts, Settings
- [ ] Register custom capability `stcrm_manage_tickets` — grant to Administrator role on activation
- [ ] Confirm menu appears in wp-admin with correct active states

---

### 1.5 Settings Screen

- [ ] Build Settings page controller (PHP class, registers `admin_menu` + `admin_init`)
- [ ] **Freemius tab**
  - Product ID field
  - API bearer token field (password input, encrypted save)
  - Product secret key field (password input, encrypted at rest via wp_salt-derived key)
  - Webhook URL field (read-only, auto-generated value, copy button)
  - Connection status notice (connected / disconnected)
  - "Run one-time backfill" button
- [ ] **Email tab**
  - From name field
  - From address field
  - Agent fallback address field
  - Notification debounce (minutes, default 10)
  - Auto-close after (days resolved, default 7)
  - Warning notice: "Customer emails never contain message content"
- [ ] **Tickets & guards tab**
  - Categories field (comma-separated, default: technical, billing, feature, presale, bug)
  - Default priority per tier (Free → Low, Pro → Normal)
  - Guard matrix table: Max open tickets (Free 1, Pro 5), Messages per turn (Free 3, Pro silent ceiling 10)
- [ ] Save button with success/error notices
- [ ] Sanitize and validate all inputs on save
- [ ] Enqueue settings assets only on this admin page (conditional enqueuing)

---

### 1.6 Freemius Webhook Receiver

- [ ] Register REST route: `POST /stcrm/v1/fs-webhook` (public, no auth)
- [ ] Validate HMAC SHA-256 signature: `hash_hmac('sha256', raw_body, secret_key)` vs `x-signature` header using `hash_equals()`. Mismatch → 401, log error.
- [ ] Respond 200 immediately; queue actual processing via Action Scheduler (so Freemius never times out)
- [ ] Write idempotent event handlers (upserts keyed on Freemius IDs):
  - `license.created` / `payment.created` → upsert contact: tier=pro, license_status=active, plan, expiry, fs IDs
  - `license.plan.changed` → update plan on contact
  - `license.extended` / `license.shortened` → update `license_expires`
  - `license.expired` → license_status=expired, tier=free
  - `license.cancelled` / `subscription.cancelled` / `license.deleted` → license_status=cancelled, tier=free
  - `user.updated` → refresh name/email
  - All other events → acknowledge and ignore
- [ ] Tier downgrades must NOT delete contacts or tickets — only update guard tier
- [ ] Test with Freemius sandbox event in staging

---

### 1.7 Freemius Backfill Job

- [ ] Create `Services\FreemiusBackfill` class
- [ ] Paginate `GET /products/{product_id}/users.json` and licenses endpoint via Freemius API
- [ ] Upsert contacts with tier/plan/expiry on each page
- [ ] Store last completed page in `wp_options` (`crm_backfill_last_page`) for resumability
- [ ] Trigger via "Run one-time backfill" button in Settings
- [ ] Show basic progress in Settings (page X processed, N contacts synced) — note: full progress meter is a known design gap, add simple text status for now
- [ ] Ensure job is idempotent — safe to run multiple times

---

### 1.8 Maintenance Cron Jobs

- [ ] Register daily cron event to purge expired `wp_stcrm_tokens` rows (`expires_at < NOW()`)
- [ ] Register daily cron event for auto-close (tickets with `resolved_at` older than auto-close setting → set status `closed`, insert `system` message)
- [ ] Verify crons are registered on activation

---

### Phase 1 Acceptance
- Plugin activates with zero PHP errors or warnings
- All 4 DB tables exist with correct columns and indexes
- Settings screen saves and retrieves all fields correctly
- Webhook URL appears correctly in Settings
- Freemius test event (sandbox) → contact appears/updates in `wp_stcrm_contacts`
- Backfill job runs, paginates, creates contacts
- Expired token purge cron is scheduled

---

## PHASE 2 — Tickets Core
> Goal: Full agent–customer conversation round-trip works via REST. Guards enforce correctly. Admin inbox and thread are usable.
> Done when a conversation can be started, replied to, and managed entirely via the admin + REST client with guards returning correct HTTP codes.

---

### 2.1 REST API Infrastructure

- [ ] Register namespace `stcrm/v1` with `register_rest_route` calls in a `RestApi\Router` class
- [ ] Build session auth middleware: read session cookie → hash → look up `wp_stcrm_tokens` (type=session, not expired) → attach contact to request
- [ ] Build nonce + capability middleware for admin routes
- [ ] Build Freemius webhook middleware (already done in Phase 1 — confirm reuse)
- [ ] Centralise error response helper (WP_Error shape: `{code, message, data: {status}}`)

---

### 2.2 Tier Resolution Service

- [ ] Build `Services\TierResolver` class
- [ ] Primary path: match submitted email (lowercased) against `wp_stcrm_contacts` for this `product_id` → active license → verified=1, tier=pro, priority=normal
- [ ] Fallback path: if `license_key` provided → verify against Freemius API → cache result as transient (~1h per key hash) → update/link contact
- [ ] Graceful degradation: Freemius API unreachable → accept as unverified, flag `verification_pending=1` in contact, queue re-check job
- [ ] No match / failed verification → verified=0, tier=free, priority=low — never reject

---

### 2.3 Guard Matrix Service

- [ ] Build `Services\GuardMatrix` class
- [ ] Open ticket cap check: COUNT tickets WHERE contact_id = X AND status NOT IN (resolved, closed)
  - Free: ≥1 → return 409 `stcrm_open_ticket_exists` with existing ticket id
  - Pro: ≥5 → return 409 `stcrm_ticket_cap_reached` with soft message
- [ ] Turn limit check: COUNT customer messages since last non-internal agent message on the ticket
  - Free: ≥3 → return 423 `stcrm_turn_limit`
  - Pro: ≥10 (silent ceiling, never surfaced in UI) → return 423
- [ ] Guard matrix values read from Settings (editable, not hardcoded)

---

### 2.4 Rate Limiting

- [ ] Build `Services\RateLimiter` using WordPress transients
- [ ] Ticket creation: 5/hour/IP + 3/day/email (unverified); 20/day/email (verified)
- [ ] Messages: 30/day/contact (unverified)
- [ ] Magic-link requests: 3/hour/email
- [ ] All limits return 429 with `Retry-After` header on exceed

---

### 2.5 Public Ticket Endpoints

- [ ] `POST /stcrm/v1/tickets`
  - Honeypot check: `hp_field` non-empty → silent fake 201, nothing stored
  - Rate limit check
  - Validate + sanitize: subject ≤255 chars, message ≤20,000 chars, valid email
  - Tier resolution (§2.2)
  - Guard matrix check (§2.3)
  - Upsert contact by `(product_id, email)` — Freemius IDs/plan come from sync layer only
  - Insert ticket (status: awaiting_agent) + first message
  - Queue confirmation email + agent alert (Phase 4)
  - Return 201: `{ticket_id, status, verified, thread_url}`
- [ ] `GET /stcrm/v1/tickets` (session auth)
  - Return authenticated contact's tickets: `[{id, subject, status, priority, last_activity_at, unread_count}]`
  - Pagination: `page` / `per_page` (max 50)
- [ ] `GET /stcrm/v1/tickets/{id}` (session auth)
  - Ownership check: ticket.contact_id must match session contact
  - Return ticket header + messages (is_internal_note=1 rows excluded at query level)
  - Return `composer: {locked, reason, notice}` — compute from guard check
  - Mark unread agent messages as `read_at = NOW()`
- [ ] `POST /stcrm/v1/tickets/{id}/messages` (session auth)
  - Ownership check
  - Ticket must not be `closed` (replying to `resolved` → reopen to `awaiting_agent`)
  - Guard: turn limit check (§2.3)
  - Insert message
  - Set ticket status → `awaiting_agent`
  - Queue agent notification (Phase 4)
  - Return 201 with new message

---

### 2.6 Magic-Link Auth Endpoints

- [ ] `POST /stcrm/v1/auth/magic-link`
  - Rate limit: 3/hour/email
  - **Always return 200** with "If that address has tickets, a sign-in link is on its way." (no account enumeration)
  - On email match: generate `random_bytes(32)` → URL-safe base64 raw token → store SHA-256 hash in `wp_stcrm_tokens` (type=magic_link, expires 48h)
  - Queue magic-link email (Phase 4)
- [ ] Magic-link redemption handler (WordPress `template_redirect` action, not REST)
  - Read `?t=` param → SHA-256 hash → look up token (unused + not expired)
  - Mark `used_at = NOW()`
  - Generate new session token → store hash (type=session, expires 30 days)
  - Set HttpOnly, Secure, SameSite=Lax cookie with raw session token
  - Redirect to ticket thread (if `ticket_id` set on token) or portal home
  - Invalid/expired → redirect to expired-link view

---

### 2.7 Admin Ticket Endpoints

- [ ] `GET /stcrm/v1/admin/tickets` (stcrm_manage_tickets + nonce)
  - Filter params: status, priority, tier, assignee
  - Default sort: floats `verified=1` first, then priority (critical→high→normal→low)
  - Include internal notes in response for admin
- [ ] `GET /stcrm/v1/admin/tickets/{id}` (stcrm_manage_tickets + nonce)
  - Include internal notes
  - Include full contact panel data (Freemius fields from wp_stcrm_contacts)
- [ ] `POST /stcrm/v1/admin/tickets/{id}/messages` (stcrm_manage_tickets + nonce)
  - Accepts `{message, is_internal_note: bool}`
  - Non-note: set status → `awaiting_customer`, queue content-free customer notification (Phase 4)
  - Internal note: no status change, no customer email, never exposed via public API
- [ ] `PATCH /stcrm/v1/admin/tickets/{id}` (stcrm_manage_tickets + nonce)
  - Accepts status, priority, assigned_to
  - Status changes insert a `system` message in thread
- [ ] `GET /stcrm/v1/admin/contacts` (stcrm_manage_tickets + nonce)

---

### 2.8 Admin Inbox UI

- [ ] PHP page class for Inbox screen (registered as `Inbox` submenu page callback)
- [ ] Render page shell: title "Support Inbox" + open count pill + subhead
- [ ] Filter toolbar: Status, Priority, Tier, Assignee selects + search input (PHP-rendered, JS-enhanced)
- [ ] Render mount point `<div id="crm-inbox"></div>` for React island
- [ ] Build React island (`src/admin/inbox.jsx`):
  - Fetch tickets from `GET /admin/tickets` with filter params
  - Render 384px scrollable list (ListItem component per design: Tier badge, Critical badge, #id·time kicker, subject, who–preview, Status badge, priority badge, unread pill)
  - Active item: `#f0f6fc` bg + 3px left blue border
  - Render reading pane (ticket header badges + thread preview + "Open full thread" button)
  - "Open full thread" links to Thread admin page with ticket ID param
- [ ] Enqueue React island assets only on Inbox page
- [ ] Match design tokens from `design/Support CRM.html`

---

### 2.9 Admin Thread UI

- [ ] PHP page class for Thread screen (registered as `Thread` submenu page, reads `?ticket=id` param)
- [ ] Render page shell: back-to-inbox button + "Ticket #id" kicker + subject as page title
- [ ] Render mount point `<div id="crm-thread"></div>` for React island
- [ ] Build React island (`src/admin/thread.jsx`):
  - Fetch ticket + messages from `GET /admin/tickets/{id}`
  - Render chat thread (customer left/grey, agent right/blue, internal note full-width/amber, system messages as hairline divider)
  - Render composer with two tabs: "Reply to customer" (white) / "Internal note" (amber `--amber-note` bg). Tab switch recolors composer bg + textarea border (0.15s transition)
  - Reply mode helper text: "Customer gets a link-only email" + "Notification queued via Action Scheduler"
  - Note mode helper text: "Not emailed · agents only"
  - Send/Save actions call appropriate admin message endpoint
  - Render 300px sidebar: Customer panel (Freemius read-only data), Environment panel (env JSON fields), Manage panel (status/priority/assignee selects + Resolve/Close buttons)
  - Manage panel actions call `PATCH /admin/tickets/{id}`
- [ ] Enqueue React island assets only on Thread page

---

### 2.10 Admin Contacts UI

- [ ] PHP page class for Contacts screen
- [ ] Render page shell: title + "Run Freemius backfill" button + subhead
- [ ] Render contacts table (PHP `WP_List_Table` or custom): avatar, Name (blue-strong), Email (mono), Tier badge, Plan, License badge (dot + status), Open tickets (blue pill if >0), Last activity, chevron
- [ ] Rows link to Contact Detail page
- [ ] Footer: "Showing N of N · synced X ago via webhook"
- [ ] Contact Detail page: 300px profile card + ticket history table
- [ ] Profile card: avatar, name, email, Tier + License badges, key/values (Plan, Freemius ID, Active sites, Lifetime value, Customer since), "View in Freemius" button
- [ ] Ticket history table: #, Subject, Status, Priority, Updated, chevron → links to Thread

---

### Phase 2 Acceptance
- `POST /tickets` creates contact + ticket, returns correct 201
- 409 returned with existing ticket data when free-tier contact hits open-ticket cap
- 423 returned after 3 customer messages without an agent reply
- Agent can reply (public) → status changes to awaiting_customer
- Internal note → no status change, not visible via public `GET /tickets/{id}`
- Magic-link request always returns 200; valid token issues session cookie + redirects
- Admin inbox loads and displays tickets with correct sort and filter
- Admin thread shows all message types with correct visual styling
- Admin manage panel changes status/priority/assignee

---

## PHASE 3 — Touchpoints
> Goal: Customers can open and manage tickets from the portal and launcher without an account. All view states work.
> Done when a customer can open a ticket from the floating launcher with email alone, get auto-verified as pro, hit the turn limit, and resume via the emailed link.

---

### 3.1 Portal Block Registration

- [ ] Scaffold `sublime-crm/support-portal` block using `@wordpress/scripts`
  - `block.json`: name, title, description, category, icon, editorScript, viewScript
  - Editor component: static placeholder ("Support Portal — renders on the frontend")
  - Dynamic render callback (PHP): outputs `<div id="crm-portal" data-nonce="..."></div>` + `wp_enqueue_script` for portal JS
- [ ] Enqueue portal CSS/JS only when the block is present on the page (use `render_callback`, not global enqueue)
- [ ] Register block on `init` hook

---

### 3.2 Classic Page Template

- [ ] Register "Support Portal" page template via `theme_page_templates` filter
- [ ] Create PHP template file: full `get_header()` / `get_footer()` wrapper calling `do_blocks( '<!-- wp:sublime-crm/support-portal /-->' )`
- [ ] Confirm template appears in Page Attributes dropdown when editing a page
- [ ] Create a "Support" page in Laragon environment, assign template, verify block renders

---

### 3.3 Portal JS App Infrastructure

- [ ] Build portal JS app (`src/portal/index.js`) — vanilla JS or lightweight React
- [ ] View state router: reads URL params (`?view=`, `?ticket=`, `?t=`) to determine active view
- [ ] Session detection: checks for valid session cookie via `GET /tickets` (200 = authenticated, 401 = no session)
- [ ] Navigation helpers: push/replace URL state without full page reload
- [ ] Loading + error states (skeleton or spinner)
- [ ] Polling manager: `setInterval` 15s, pauses on `document.hidden` (`visibilitychange` event), resumes on visibility restore

---

### 3.4 Portal View: New Ticket Form

- [ ] Render form fields: Email, Name (optional), Subject, Category (select — from Settings categories), Message textarea, License key (optional), "Add environment details" collapsible (Site URL, WP, PHP, Plugin), honeypot `company_url` (off-screen, `tabIndex=-1`)
- [ ] Sidebar: "Before you post" docs card (search docs button), "★ Pro — Faster replies" blue card, privacy note
- [ ] On submit: `POST /tickets` → handle 201 (success message + link), 409 (show cap view), 4xx validation errors
- [ ] Match design: H1 "How can we help?", subhead with "View your tickets →" link

---

### 3.5 Portal View: Cap Reached (409)

- [ ] Show amber banner: "You already have an open ticket"
- [ ] Display existing ticket card: #id + status + subject + "Go to my ticket" button
- [ ] Footnote: softer message for pro customers

---

### 3.6 Portal View: My Tickets

- [ ] Fetch `GET /tickets` on session auth
- [ ] Header: "My tickets" + "Signed in as {email} · Sign out" + "+ New ticket"
- [ ] Card list: each row = #id kicker + "N new reply" pill, subject (15.5px/700), Status + Priority + "Updated {time}", chevron → goes to thread view
- [ ] Sign out: clear session cookie, redirect to new ticket form

---

### 3.7 Portal View: Empty State

- [ ] Show when `GET /tickets` returns empty array
- [ ] Inbox icon (72px blue circle), "No tickets yet", helper text, "Open your first ticket" button

---

### 3.8 Portal View: Thread

- [ ] Render ticket header: subject (24px) + #id kicker + Status/Priority/Category badges
- [ ] Render scrollable message thread (max-height ~340px): customer right/blue, agent left/grey
- [ ] System message: "updates automatically — checking for replies" (mono, centered hairline)
- [ ] 15s poll via polling manager (§3.3)
- [ ] Mark agent messages as read on view (implicit — server handles on `GET /tickets/{id}`)
- [ ] Composer — active state: textarea + "N of 3 replies left before an agent responds" + Send
- [ ] Composer — locked state (423 / `composer.locked=true`): dashed card, lock icon, "Thanks — we've received your messages / You'll get an email the moment we reply."
- [ ] Composer state sourced entirely from API `composer` object — never computed client-side

---

### 3.9 Portal View: Auth (Magic-link)

- [ ] Request state: "View your tickets", "No password needed", email field, "Email me a sign-in link" button
- [ ] Sent state: mail icon, "Check your inbox", "If that address has tickets, a sign-in link is on its way. The link works once and expires in 48 hours." + "← Use a different email"
- [ ] Footer note: "For your security we never confirm whether an email has an account"
- [ ] Both states always shown (API always 200 — no branching on match)

---

### 3.10 Portal View: Expired Link

- [ ] Triggered when magic-link redemption fails (invalid/used/expired token)
- [ ] Amber hourglass icon, "This link has expired", helper text
- [ ] Email field + "Send a new link" → calls `POST /auth/magic-link`

---

### 3.11 Floating Launcher

- [ ] Bottom-right 60px circular bubble (blue, chat icon ↔ × toggle)
- [ ] 380px panel above bubble (radius 16px, shadow `0 20px 60px rgba(0,0,0,.28)`)
- [ ] Panel header: gradient blue, "Support" label + "We usually reply within a few hours", close ×
  - **Label: NEVER "Chat". NEVER an online/offline indicator.**
- [ ] Load launcher on every frontend page via `wp_enqueue_scripts` (conditional: frontend only)
- [ ] Session-aware: read session state on open (call `GET /tickets` silently)
- [ ] **View: No session** — compact form (Email, Subject, Message) + "Send message" + "Already have a ticket? Sign in →"
- [ ] **View: My tickets** — "+ New" button + compact ticket rows (#id, "N new" pill, subject, status). Row → open thread view
- [ ] **View: Open thread** — back chevron + #id + subject + compact message bubbles + inline reply input + send button
- [ ] All launcher views use the same REST endpoints as the portal (same-origin, same session cookie)

---

### Phase 3 Acceptance
- "Support" page with classic template loads the portal block
- New ticket form submits successfully; 409 shows cap card; validation errors show inline
- Magic-link flow: request → "check your inbox" (always) → link in email → session cookie issued → redirect to thread
- Expired/reused link → expired view → re-request works
- Portal thread polls every 15s, pauses on tab hidden
- Composer shows "N of 3 replies left" and locks correctly at the limit
- Launcher appears on all frontend pages, opens panel, all 3 view states transition correctly
- Launcher shares session with portal (sign in on portal → launcher shows my-tickets)

---

## PHASE 4 — Notifications & Hardening
> Goal: Emails arrive reliably. Auto-close runs. Security audit passes. Plugin is production-ready.
> Done when reply notice lands in inbox (not spam) with a working magic-link deep-link, and all abuse controls are verified.

---

### 4.1 Email Infrastructure

- [ ] Build `Services\Mailer` class wrapping `wp_mail`
- [ ] All sends queued via Action Scheduler (single retry on failure, then log)
- [ ] Debounce logic: max 1 customer notification per ticket per N minutes (N from Settings). Use transient keyed by `ticket_id` to suppress rapid-fire notifications.
- [ ] Email sender: From name + From address from Settings
- [ ] Agent fallback: if ticket unassigned, send agent alert to fallback address from Settings

---

### 4.2 Email Template: Ticket Confirmation (Customer)

- [ ] Trigger: after `POST /tickets` creates ticket
- [ ] Recipient: customer email
- [ ] Subject: "We've received your ticket: {subject}"
- [ ] Body: plain text + HTML. One button: "View your ticket →" linking to magic-link URL (deep-links to thread)
- [ ] This email is the customer's first access path to the thread — magic link is mandatory
- [ ] **No message content in email body**

---

### 4.3 Email Template: Agent Reply Notification (Customer)

- [ ] Trigger: after `POST /admin/tickets/{id}/messages` with `is_internal_note=false`
- [ ] Recipient: customer email
- [ ] Subject: "Your ticket has a new reply: {subject}"
- [ ] Body: one button "View the reply →" linking to magic-link URL
- [ ] Apply debounce (§4.1)
- [ ] **No message content in email body — magic-link button only**

---

### 4.4 Email Template: New Ticket / Customer Message Alert (Agent)

- [ ] Trigger: new ticket created OR customer message posted
- [ ] Recipient: assigned agent WP email (fallback: Settings fallback address)
- [ ] Subject: "[Support] New message on: {subject} #{id}"
- [ ] Body: ticket subject + direct link to Thread admin page
- [ ] Internal alert — may include a message snippet (vendor-side only)

---

### 4.5 Email Template: Auto-Close Notification (Customer)

- [ ] Trigger: auto-close cron closes a resolved ticket
- [ ] Recipient: customer email
- [ ] Subject: "Your support ticket has been closed: {subject}"
- [ ] Body: "Your ticket was closed after {N} days resolved. If you need further help, open a new ticket." + link to portal

---

### 4.6 Auto-Close Cron

- [ ] Daily cron event (registered in Phase 1 — implement logic here)
- [ ] Query: tickets WHERE status='resolved' AND resolved_at < (NOW() - auto_close_days)
- [ ] For each: set status='closed', insert `system` message ("ticket auto-closed after N days"), queue auto-close notification email

---

### 4.7 Security Hardening Pass

- [ ] Audit all `$wpdb` queries — confirm 100% use `$wpdb->prepare()`
- [ ] Audit all output — confirm `esc_html()`, `esc_attr()`, `esc_url()` on all rendered data
- [ ] Confirm `body` stored via `wp_kses` minimal whitelist only (links, code, line breaks)
- [ ] Confirm internal notes excluded **at the query level** in all public-facing endpoints (not template-level)
- [ ] Confirm ownership check on every `GET /tickets/{id}` and `POST /tickets/{id}/messages`
- [ ] Confirm tokens: `random_bytes(32)` → URL-safe base64; only SHA-256 hash stored in DB; raw never stored or logged
- [ ] Confirm session cookie: HttpOnly, Secure, SameSite=Lax
- [ ] Confirm HMAC webhook validation uses `hash_equals()` (constant-time)
- [ ] Confirm honeypot on ticket form and magic-link form
- [ ] Confirm rate limits active on all public endpoints (§2.4)
- [ ] Confirm `stcrm_manage_tickets` capability check on every admin route
- [ ] URLs in customer messages render with `rel="nofollow noopener"`

---

### 4.8 Uninstall

- [ ] Create `uninstall.php`
- [ ] Check "delete all data on uninstall" setting (default: OFF)
- [ ] If ON: drop all 4 tables, delete all `wp_options` keys, cancel all Action Scheduler jobs, clear all cron events, delete session cookies
- [ ] If OFF: leave data intact

---

### 4.9 Go-Live Checklist Verification

- [ ] Configure FluentSMTP with SiteGround SMTP credentials in Laragon first, then production
- [ ] Confirm SPF, DKIM, DMARC records on sending domain
- [ ] Score 9–10 on mail-tester.com with a real ticket confirmation email
- [ ] Enter Freemius credentials in production settings; register webhook URL in Freemius dashboard
- [ ] Fire Freemius sandbox event and confirm HMAC validation passes + contact updates
- [ ] Run backfill on production; spot-check 5 known pro customers for correct tier/plan/expiry
- [ ] Set up real server cron (SiteGround Site Tools → every 5 min → `wp-cron.php`) + add `DISABLE_WP_CRON` to wp-config
- [ ] Full magic-link round trip on production: fresh link, expired link, reused link
- [ ] Verify turn-limit and open-ticket-cap states on a free-tier test contact
- [ ] Take full DB backup before activating on production

---

### 4.10 FSE Template Prep (Future-Ready)

- [ ] Create `templates/support-portal.html` with block markup using `sublime-crm/support-portal`
  - Uses `core/template-part` for header and footer
  - Single `sublime-crm/support-portal` block in content area
- [ ] Register template via `get_block_templates` filter (returns template but does not activate)
- [ ] Confirm block itself is unchanged — zero portal JS changes required
- [ ] Document: when theme switches to FSE, assign this template to the Support page in Site Editor

---

### Phase 4 Acceptance
- Ticket confirmation email arrives within 30 seconds with working magic-link
- Agent reply notification arrives with no message content, only the magic-link button
- Reply notification is debounced (3 rapid agent replies → 1 customer email)
- Auto-close runs on schedule; closed ticket inserts system message
- All security audit items checked off
- Uninstall with setting ON drops all tables and options
- mail-tester.com score 9–10 on production domain
- FSE template file exists and registers without errors

---

## Summary

| Phase | Weeks | Task groups | Approx tasks |
|---|---|---|---|
| 1 — Foundation | 1–2 | 8 groups | ~35 tasks |
| 2 — Tickets Core | 3–5 | 10 groups | ~45 tasks |
| 3 — Touchpoints | 6–8 | 11 groups | ~40 tasks |
| 4 — Notifications & Hardening | 9–10 | 10 groups | ~35 tasks |
| **Total** | **10 weeks** | **39 groups** | **~155 tasks** |

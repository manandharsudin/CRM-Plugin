# SublimeCRM — Phase Plan for ClickUp
> Ready to import as tasks. Structure: Phase = List · Task group = Section · Task = Task · Bullets = Subtasks

---

## PHASE 1 — Foundation
> Goal: Plugin installs cleanly, Freemius contacts sync, settings screen works.
> No ticket UI yet. Done when existing Freemius customers appear as contacts and a test purchase/cancel updates tier within seconds.

---

### 1.1 Plugin Scaffold ✅ Complete (2026-06-22)

- [x] Create main plugin file with WordPress headers, constants, bootstrap
  - `STCRM_VERSION`, `STCRM_DB_VERSION`, `STCRM_PLUGIN_DIR`, `STCRM_PLUGIN_URL`, `STCRM_PLUGIN_BASENAME` defined
  - No `PRODUCT_ID` constant — product ID lives in settings (`stcrm_settings.freemius_product_id`), not hardcoded
  - Activation / deactivation / uninstall hooks registered
- [x] PSR-4 autoloader via Composer (`vendor/autoload.php`)
- [x] Folder structure built as standard WP plugin layout (changed from plan):
  - `includes/` — core classes + loader + activator + deactivator + i18n + encryption
  - `includes/Database/` — `class-stcrm-database.php`
  - `includes/Services/` — `class-stcrm-freemius-sync.php`, `class-stcrm-backfill.php`
  - `admin/` — admin class, settings class, CSS, JS
  - `api/` — webhook class
  - `languages/` — POT file
- [x] `composer.json` with `woocommerce/action-scheduler ^3.8` (bundled at 3.9.3)
  - AS bootstrap required explicitly in `sublime-crm.php` (not auto-included via Composer autoload_files)
  - AS availability check deferred to `plugins_loaded` priority 5 (AS initialises at priority 1)
- [x] Plugin activates on Laragon without errors — confirmed 2026-06-22
  - "Dependencies missing" warning resolved
  - "Scheduled Actions" menu: AS initialises correctly (confirmed via `as_enqueue_async_action` = true). Menu does not appear under WP Tools even with EDD disabled — root cause TBD, deferred. Functionally non-blocking.

---

### 1.2 Database — Tables & Migrations ✅ Complete (2026-06-23)

- [x] Create `Database\Installer` class using `dbDelta()`
  - Class is `STCRM_Database` (standard WP naming, not namespaced `Database\Installer`)
  - `wp_stcrm_contacts` table — 13 columns including `license_key_hash VARCHAR(64)`, `created_at`, `updated_at`; indexes on `tier`, `fs_user_id`, `license_key_hash`; UNIQUE `(product_id, email)`
  - `wp_stcrm_tickets` table — all columns per spec; indexes on `contact_id`, `(product_id,status)`, `(status,last_activity_at)`, `assigned_to`
  - `wp_stcrm_messages` table — immutable; indexes on `(ticket_id,created_at)`, `sender_type`
  - `wp_stcrm_tokens` table — `token_hash CHAR(64)` UNIQUE; indexes on `contact_id`, `expires_at`
- [x] Store schema version in `wp_options` (`stcrm_db_version` — note: plan said `crm_db_version` but `stcrm_` prefix is correct per plugin convention)
- [x] Upgrade routine — `version_compare($installed, STCRM_DB_VERSION, '>=')` guard; dbDelta handles incremental column additions (standard WP approach)
- [x] Installer called on activation — `STCRM_Activator::activate()` calls `STCRM_Database::install()`
- [x] All 4 tables verified in Laragon DB — confirmed via phpMyAdmin 2026-06-23; `stcrm_db_version = 1.0.0` in `wp_options`
  - Phase 1 bonus: `upsert_contact()`, `get_contact_by_email()`, `get_contact_by_fs_user_id()` helpers also implemented

---

### 1.3 Bundle Action Scheduler ✅ Complete (2026-06-23)

- [x] Require Action Scheduler via Composer or vendor copy
  - `composer.json`: `woocommerce/action-scheduler ^3.8`, installed at 3.9.3
  - Bootstrap explicitly `require_once`'d in `sublime-crm.php` (not auto-included via Composer autoload_files)
- [x] Register Action Scheduler store on `init` — handled internally by AS; hooks `ActionScheduler_Versions::initialize_latest_version` to `plugins_loaded` p1 → `ActionScheduler::init()`
- [x] AS admin screen under Tools — ⚠️ deferred (known non-blocking issue): AS initialises correctly (`as_enqueue_async_action` available), but menu item does not appear; root cause TBD. No admin screen = no user impact at this stage.

---

### 1.4 Admin Menu Registration ✅ Complete (2026-06-23)

- [x] Register top-level "Support" menu page (ticket icon, capability `stcrm_manage_tickets`)
  - `add_menu_page()`: title "Support", `dashicons-format-chat`, capability `stcrm_manage_tickets`, position 30
- [x] Register submenu pages: Inbox, Contacts, Settings
  - Inbox slug matches top-level slug (removes WP auto-duplicate entry)
  - Settings callback delegates to `STCRM_Settings::render_page()`
  - Inbox + Contacts show Phase 2 placeholder notice; Settings shows live 3-tab form
- [x] `stcrm_manage_tickets` capability granted to Administrator on activation — `STCRM_Activator::grant_capability()`
- [x] Assets enqueued conditionally — CSS on all 3 pages, JS only on settings (`enqueue_assets()` checks `$hook` allowlist)
- [x] Confirmed in wp-admin 2026-06-23: menu appears with correct icon, all 3 submenus visible, active states correct

---

### 1.5 Settings Screen ✅ Complete (2026-06-23)

- [x] Settings page controller — `STCRM_Settings` class; save via `admin_post_stcrm_save_settings`; nonce + capability checked on every save
- [x] **Freemius tab**
  - Product ID field — `sanitize_text_field` on save
  - API bearer token (password input, blank on render, encrypts via `STCRM_Encryption` only when non-empty submitted)
  - Product secret key (same pattern; placeholder shows "(saved — leave blank to keep)" after first save)
  - Webhook URL — read-only, `rest_url('stcrm/v1/fs-webhook')`, Copy button (JS)
  - Connection status — ⚠️ deferred to Phase 2 (requires Freemius API client)
  - Run Backfill button — `wp_nonce_url()` GET link (not a nested form); shows status + last page
  - **Bug fixed 2026-06-23:** original nested `<form>` inside settings form caused Save Changes to fire backfill instead of saving; replaced with `wp_nonce_url()` link
- [x] **Email tab**
  - From name, From address, Reply-To address (`sanitize_email` on address fields)
  - Notification debounce (minutes, default 10)
  - Warning notice: "Customer notification emails never contain message content" (added 2026-06-23)
- [x] **Tickets & Guards tab**
  - Auto-close after (days, default 7) — moved here from Email tab (more logical placement)
  - Categories (textarea, `sanitize_textarea_field`; defaults to full category names)
  - Guard matrix: `guard_free_open` (1), `guard_pro_open` (5), `guard_free_turn` (3), `guard_silent_ceiling` (10)
  - Uninstall toggle: delete-on-uninstall checkbox (default off)
  - Default priority per tier — ⚠️ deferred to Phase 2 (needed when ticket creation is built)
- [x] Save button with success/error notices — `submit_button()`, `?saved=1` / `?error=` handled in `STCRM_Admin`
- [x] All inputs sanitized on save — per-field sanitization throughout `handle_save()`
- [x] Assets conditionally enqueued — CSS on all 3 SublimeCRM pages; JS only on settings page (verified in 1.4)

---

### 1.6 Freemius Webhook Receiver ✅ Complete (2026-06-23)

- [x] Register `POST /stcrm/v1/fs-webhook` — `permission_callback => '__return_true'`; auth via HMAC only
- [x] HMAC SHA-256 validation: `base64_encode(hash_hmac('sha256', $raw_body, $secret_key, true))` vs `x-signature` header; `hash_equals()` constant-time comparison; mismatch → 401
- [x] Respond 200 immediately; queue via `as_enqueue_async_action('stcrm_process_webhook_event', ...)` before returning
- [x] Idempotent event handlers (upserts keyed on product_id + email):
  - `install.installed` → free or pro based on license presence in payload
  - `install.upgraded` → tier=pro, active
  - `install.downgraded` / `install.cancelled` → tier=free
  - `license.expired` → targeted update: tier=free, license_status=expired (added 2026-06-23)
  - `license.cancelled` / `subscription.cancelled` → targeted update: tier=free, license_status=cancelled (added 2026-06-23)
  - `user.updated` → refresh name/email only
  - All other events → silently ignored (logged at info if WP_DEBUG)
  - Note: `license.*` events use targeted DB update preserving `sites_count`; fall back to full upsert if contact not yet in DB
  - Deferred: `license.plan.changed`, `license.extended/shortened` (need Freemius API client — Phase 2)
- [x] Tier downgrades never delete contacts or tickets — all paths use upsert or targeted update
- [ ] Sandbox test — ⚠️ deferred: requires real Freemius credentials in Settings; test when credentials configured

---

### 1.7 Freemius Backfill Job ✅ Complete (2026-06-23)

- [x] `STCRM_Backfill` class in `includes/Services/`
- [x] Paginates `GET /products/{product_id}/installs.json` (changed from plan's `users.json` — installs endpoint bundles user + license + sites_count in one record; better fit than users.json which needs a second API call for license data)
- [x] Upserts contacts via `STCRM_Database::upsert_contact()` on each page with tier/plan/expiry
- [x] Last page stored in `stcrm_backfill_last_page` (plan said `crm_backfill_last_page` — `stcrm_` prefix correct per convention)
- [x] Triggered via Run Backfill link in Settings → Freemius tab (GET link with `wp_nonce_url()` after nested form fix)
- [x] Progress shown in Settings: status string (`idle` / `running` / `completed` / `error_*`) + last page number
- [x] Idempotent — `upsert_contact()` matches on `(product_id, email)`; safe to run multiple times
- [x] Verified in Laragon 2026-06-23: status cycles `idle → running → error_missing_credentials` correctly; AS job runs via WP-Cron on next page load; `stcrm_backfill_last_page` absent (correct — job errored before processing any pages)
- [ ] Live API test — ⚠️ deferred: requires real Freemius credentials; `license.plan.changed` + `license.extended/shortened` handlers deferred to Phase 2 (Tier Resolution Service, 2.2)

---

### 1.8 Maintenance Cron Jobs ✅ Complete (2026-06-23)

- [x] Daily cron: `stcrm_purge_expired_tokens` → `SublimeCRM::purge_expired_tokens()` — `DELETE WHERE expires_at < NOW()`
- [x] Daily cron: `stcrm_auto_close_tickets` → `SublimeCRM::auto_close_tickets()` — reads `auto_close_days` from settings, batches 100, inserts `system` message per closed ticket
- [x] Scheduled on activation — `STCRM_Activator::schedule_events()` with `wp_next_scheduled()` guard (no duplicate scheduling)
- [x] Unscheduled on deactivation — `STCRM_Deactivator::clear_cron_events()` (bonus: not in original plan)
- [x] Verified in Laragon 2026-06-23 — both hooks present in `wp_options.cron` with `schedule: daily`, `interval: 86400`

---

### Phase 1 Acceptance

- [x] Plugin activates with zero PHP errors or warnings — verified 2026-06-23
- [x] All 4 DB tables exist with correct columns and indexes — verified 2026-06-23 (phpMyAdmin)
- [x] Settings screen saves and retrieves all fields correctly — verified 2026-06-23
- [x] Webhook URL appears correctly in Settings — verified 2026-06-23
- [ ] Freemius test event (sandbox) → contact appears/updates in `wp_stcrm_contacts` — ⚠️ pending real Freemius credentials (code complete)
- [ ] Backfill job runs, paginates, creates contacts — ⚠️ pending real Freemius credentials (flow verified; status cycles correctly)
- [x] Expired token purge cron is scheduled — verified 2026-06-23 (wp_options.cron confirmed)

---

## PHASE 2 — Tickets Core
> Goal: Full agent–customer conversation round-trip works via REST. Guards enforce correctly. Admin inbox and thread are usable.
> Done when a conversation can be started, replied to, and managed entirely via the admin + REST client with guards returning correct HTTP codes.

---

### 2.1 REST API Infrastructure ✅ Complete (2026-06-23)

- [x] Register namespace `stcrm/v1` with `register_rest_route` calls in a `RestApi\Router` class
  - `STCRM_Router` created at `api/class-stcrm-router.php`; delegates to each controller's `register_routes()` from a single `rest_api_init` hook
  - `SublimeCRM::define_api_hooks()` now instantiates `STCRM_Router` instead of `STCRM_Webhook` directly
  - Namespace verified: `GET /wp-json/stcrm/v1/` returns routes list including `/stcrm/v1/fs-webhook`
- [x] Build session auth middleware: read session cookie → hash → look up `wp_stcrm_tokens` (type=session, not expired) → attach contact to request
  - `STCRM_Session_Auth::authenticate()` at `api/class-stcrm-session-auth.php`
  - Single JOIN query (tokens ⟵JOIN⟶ contacts) instead of two separate queries — halves DB load on every portal poll
  - Returns `true|WP_Error`; attaches `_stcrm_contact` + `_stcrm_token` objects to request params
- [x] Build nonce + capability middleware for admin routes
  - `STCRM_Session_Auth::authenticate_admin()` — checks `is_user_logged_in()` then `current_user_can('stcrm_manage_tickets')`; WP core handles REST nonce automatically
- [x] Build Freemius webhook middleware (already done in Phase 1 — confirm reuse)
  - `STCRM_Webhook` unchanged; `STCRM_Router` calls `(new STCRM_Webhook())->register_routes()` ✅
- [x] Centralise error response helper (WP_Error shape: `{code, message, data: {status}}`)
  - `STCRM_Rest_Helper::error()` + `STCRM_Rest_Helper::success()` at `api/class-stcrm-rest-helper.php`

---

### 2.2 Tier Resolution Service ✅ Complete (2026-06-23)

- [x] Build `Services\TierResolver` class
  - `STCRM_Tier_Resolver` at `includes/Services/class-stcrm-tier-resolver.php`
  - `resolve(int $product_id, string $email, string $license_key = '')` returns `{contact, tier, verified, priority}`
  - Schema: added `verification_pending tinyint(1) unsigned NOT NULL DEFAULT 0` to `wp_stcrm_contacts`; bumped `STCRM_DB_VERSION` to `1.0.1`; auto-upgrade via `maybe_upgrade_db()` in `SublimeCRM` constructor
- [x] Primary path: match submitted email (lowercased) against `wp_stcrm_contacts` for this `product_id` → active license → verified=1, tier=pro, priority=normal
  - Single indexed query (`UNIQUE KEY product_email`); no API call
- [x] Fallback path: if `license_key` provided → verify against Freemius API → cache result as transient (~1h per key hash) → update/link contact
  - Step 2: hash lookup via `STCRM_Database::get_contact_by_license_key_hash()` (indexed `KEY license_key_hash`) — no API call
  - Step 3a: transient cache check before API call (cache key = SHA-256 hash, not raw key)
  - Step 3b: `GET /v1/products/{id}/licenses.json?secret_key={key}` via `wp_remote_get()` (15s timeout)
  - On API success: upsert contact preserving existing name (licenses endpoint returns no name), cache result 1h
- [x] Graceful degradation: Freemius API unreachable → accept as unverified, flag `verification_pending=1` in contact, queue re-check job
  - Only flags pending when token IS configured (`stcrm_no_api_token` error code excluded)
  - AS job `stcrm_reverify_contact(contact_id, product_id, email, license_key)` queued 1h out; raw key lives temporarily in AS jobs table, never in contacts table
- [x] No match / failed verification → verified=0, tier=free, priority=low — never reject

---

### 2.3 Guard Matrix Service ✅ Complete (2026-06-23, reviewed 2026-06-24)

- [x] Build `Services\GuardMatrix` class
  - `STCRM_Guard_Matrix` at `includes/Services/class-stcrm-guard-matrix.php`; loaded in `SublimeCRM::load_dependencies()`
- [x] Open ticket cap check: COUNT tickets WHERE contact_id = X AND status NOT IN (resolved, closed)
  - Free: ≥1 → 409 `stcrm_open_ticket_exists` with `ticket_id` in error data (portal links to it)
  - Pro: ≥5 → 409 `stcrm_ticket_cap_reached` with friendly message
  - 0 in either setting = cap disabled for that tier (early return)
  - Fetches `cap+1` rows via LIMIT to avoid `COUNT(*)` — IMPORTANT: the +1 is intentional
- [x] Turn limit check: COUNT customer messages since last non-internal agent message on the ticket
  - Free: ≥3 → 423 `stcrm_turn_limit` (composer locks in portal UI)
  - Pro: silent ceiling ≥10 → 423 `stcrm_turn_limit` (UI never shows lock for pro)
  - No agent reply yet → counts from thread start (COALESCE to 0)
  - Single correlated subquery (atomic — no TOCTOU race)
- [x] Guard matrix values read from Settings (editable, not hardcoded)
  - Keys: `guard_free_open` (1), `guard_pro_open` (5), `guard_free_turn` (3), `guard_silent_ceiling` (10)
- [x] Security/perf review (2026-06-24) — three issues fixed:
  - DB error in `check_ticket_cap`: `get_results()` returning null now returns 500 instead of PHP TypeError
  - DB error in `check_turn_limit`: silent pass via `(int) null = 0` eliminated; `$wpdb->last_error` checked
  - TOCTOU race in `check_turn_limit`: two non-atomic queries collapsed into one correlated subquery

---

### 2.4 Rate Limiting ✅ Complete (2026-06-24)

- [x] Build `Services\RateLimiter` using WordPress transients
  - `STCRM_Rate_Limiter` at `includes/Services/class-stcrm-rate-limiter.php`; loaded in `SublimeCRM::load_dependencies()`
  - Transient stored as `{count, reset_at}` so Retry-After reflects actual window remainder, not full window
- [x] Ticket creation: 5/hour/IP + 3/day/email (unverified); 20/day/email (verified)
  - Split into two calls: `check_ticket_ip($ip)` before validation; `check_ticket_email($email, $verified)` after tier resolution (when verification status is known)
  - Both share the same email transient key so counts accumulate across tier changes
- [x] Messages: 30/day/contact (unverified)
  - `check_message($contact_id, $verified)` — returns true immediately for verified contacts (no limit per spec)
- [x] Magic-link requests: 3/hour/email
  - `check_magic_link($email)` returns `bool` (not WP_REST_Response) — endpoint always returns HTTP 200 regardless; bool controls whether email is queued
- [x] All limits return 429 with `Retry-After` header on exceed
  - Returns `WP_REST_Response` (not `WP_Error`) so the `Retry-After` header can be attached — WP_Error cannot carry response headers

---

### 2.5 Public Ticket Endpoints ✅

- [x] `POST /stcrm/v1/tickets`
  - Honeypot check: `hp_field` non-empty → silent fake 201, nothing stored
  - Rate limit check
  - Validate + sanitize: subject ≤255 chars, message ≤20,000 chars, valid email
  - Tier resolution (§2.2)
  - Guard matrix check (§2.3)
  - Upsert contact by `(product_id, email)` — Freemius IDs/plan come from sync layer only
  - Insert ticket (status: awaiting_agent) + first message
  - Queue confirmation email + agent alert (Phase 4)
  - Return 201: `{ticket_id, status, verified, thread_url}`
- [x] `GET /stcrm/v1/tickets` (session auth)
  - Return authenticated contact's tickets: `[{id, subject, status, priority, last_activity_at, unread_count}]`
  - Pagination: `page` / `per_page` (max 50)
- [x] `GET /stcrm/v1/tickets/{id}` (session auth)
  - Ownership check: ticket.contact_id must match session contact
  - Return ticket header + messages (is_internal_note=1 rows excluded at query level)
  - Return `composer: {locked, reason, notice}` — compute from guard check
  - Mark unread agent messages as `read_at = NOW()`
- [x] `POST /stcrm/v1/tickets/{id}/messages` (session auth)
  - Ownership check
  - Ticket must not be `closed` (replying to `resolved` → reopen to `awaiting_agent`)
  - Guard: turn limit check (§2.3)
  - Insert message
  - Set ticket status → `awaiting_agent`
  - Queue agent notification (Phase 4)
  - Return 201 with new message

**Implementation notes (2026-06-24, commit `1c09788`):**
- `STCRM_Tickets_Controller` registers all 4 routes; wired into `STCRM_Router` + `STCRM_Loader`
- 7 new DB methods added to `STCRM_Database`: `upsert_contact()`, `insert_ticket()`, `insert_message()`, `get_tickets_by_contact()`, `get_ticket_with_messages()`, `mark_agent_messages_read()`, `count_customer_turns_since_last_agent()`
- `insert_message()` strips null values via `array_filter` before building `$formats` array — prevents sender_id (NULL for customers) being coerced to 0 by `%d`
- `create_message()` runs all `update_ticket()` calls AFTER `insert_message()` succeeds — prevents status mutation on DB write failure
- `sanitize_link_rel()` regex is `/<a([^>]*)>/i` (no leading `\s`) — bare `<a>` tags get `rel="nofollow noopener"` too
- All 3 session-auth handlers null-guard `STCRM_Session_Auth::get_contact()` → 401 if null
- Email queuing deferred to Phase 4 (stubs in place)

---

### 2.6 Magic-Link Auth Endpoints ✅

- [x] `POST /stcrm/v1/auth/magic-link`
  - Rate limit: 3/hour/email
  - **Always return 200** with "If that address has tickets, a sign-in link is on its way." (no account enumeration)
  - On email match: generate `random_bytes(29)` → `'stc_'` prefix + URL-safe base64 raw token → store SHA-256 hash in `wp_stcrm_tokens` (type=magic_link, expires 48h)
  - Queue magic-link email (Phase 4)
- [x] Magic-link redemption handler (WordPress `template_redirect` action, not REST)
  - Read `?t=` param → SHA-256 hash → look up token (unused + not expired)
  - Mark `used_at = NOW()`
  - Generate new session token → store hash (type=session, expires 30 days)
  - Set HttpOnly, Secure, SameSite=Lax cookie with raw session token
  - Redirect to ticket thread (if `ticket_id` set on token) or portal home
  - Invalid/expired → redirect to expired-link view

**Implementation notes (2026-06-24):**
- `STCRM_Auth_Controller`: REST route + `template_redirect` handler wired in `class-sublime-crm.php`
- Token format: `'stc_'` prefix + URL-safe base64(random_bytes(29)) = 43 chars — prefix prevents foreign `?t=` params from being intercepted
- Redemption is atomic: `consume_magic_link_token()` does a single `UPDATE WHERE used_at IS NULL` and checks `$wpdb->rows_affected = 1` — eliminates TOCTOU race
- Session `insert_token()` return checked before cookie is set; orphaned cookie prevented
- `secure` cookie flag set to `true` unconditionally (was `is_ssl()`)
- Phase 4 stub in `request_magic_link()` passes `$token_id` (not `$raw_token`) to guard against AS storing plaintext token
- Redirect targets stubbed with `home_url('/')` + Phase 3 comments; portal URLs wired in Phase 3

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

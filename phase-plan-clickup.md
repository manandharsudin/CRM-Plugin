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
  - "Scheduled Actions" menu: ✅ **RESOLVED (2026-07-06)** — not a SublimeCRM/AS bug. Root cause: `wpforms-lite` (also bundles Action Scheduler) calls `remove_submenu_page('tools.php', 'action-scheduler')` on `admin_menu` @ `PHP_INT_MAX` unless WooCommerce/WP Rocket/the standalone AS plugin is active — none of which run on this site, so it silently hid the page for every AS consumer, not just SublimeCRM. Fixed site-wide via `define('WPFORMS_SHOW_ACTION_SCHEDULER_MENU', true);` in `wp-config.php` (WPForms' own documented escape hatch) — no plugin code changed, nothing to commit in this repo or the plugin repo. See the sublimetheme project memory for the full investigation.

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
- [x] AS admin screen under Tools — ✅ resolved 2026-07-06 (was a WPForms menu-hiding conflict, not an AS/plugin issue — see 1.1 note above)

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
  - AS job `stcrm_reverify_contact(contact_id, product_id, email, encrypted_key)` queued 1h out; key is AES-256-CBC encrypted before storing in AS jobs table (patched 2026-06-25)
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
  - No agent reply yet → COALESCE falls back to MIN(first customer msg id) so only follow-ups count, not the initial ticket (fixed 2026-06-25 commit 9aeb38b)
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

### 2.7 Admin Ticket Endpoints ✅ Complete (2026-06-24)

- [x] `GET /stcrm/v1/admin/tickets` (stcrm_manage_tickets + nonce)
  - Filter params: status, priority, tier, assignee
  - Default sort: floats `verified=1` first, then priority (critical→high→normal→low)
  - Include internal notes in response for admin
- [x] `GET /stcrm/v1/admin/tickets/{id}` (stcrm_manage_tickets + nonce)
  - Include internal notes
  - Include full contact panel data (Freemius fields from wp_stcrm_contacts)
  - Marks customer messages as read (read_at = UTC_TIMESTAMP)
- [x] `POST /stcrm/v1/admin/tickets/{id}/messages` (stcrm_manage_tickets + nonce)
  - Accepts `{message, is_internal_note: bool}`
  - Non-note: set status → `awaiting_customer`, queue content-free customer notification (Phase 4)
  - Internal note: no status change, no customer email, never exposed via public API
  - Agent name resolved from wp_users; returned in response
- [x] `PATCH /stcrm/v1/admin/tickets/{id}` (stcrm_manage_tickets + nonce)
  - Accepts status, priority, assigned_to (null = unassign)
  - Status changes insert a `system` message in thread ("Status changed to X by Y")
  - Setting status=resolved writes resolved_at; any other status clears it
  - Only fields present in JSON body are updated (no-op safe)
- [x] `GET /stcrm/v1/admin/contacts` (stcrm_manage_tickets + nonce)
- Implementation: `api/class-stcrm-admin-controller.php` + 5 new DB methods in `class-stcrm-database.php`
- All 10 smoke test checks passed 2026-06-24

---

### 2.8 Admin Inbox UI ✅ Complete (2026-06-24)

- [x] PHP page class for Inbox screen — `render_inbox_page()` in `STCRM_Admin`
- [x] Render page shell: "Support Inbox" title + open count pill (`count_open_tickets()` DB method) + subhead
- [x] Filter toolbar: Status, Priority, Tier selects (PHP-rendered, React event listeners on change)
- [x] Render mount point `<div id="crm-inbox"></div>` for React island
- [x] Build React island (`src/admin/inbox.jsx`):
  - Fetches `GET /admin/tickets` on mount and on filter change (via DOM select change events)
  - 384px scrollable list: TierBadge, CriticalBadge, #id·time kicker (10px mono uppercase), subject (13.5px/600), contact who, StatusBadge, PriorityBadge, unread pill
  - Active item: `#f0f6fc` bg + 3px `#2271b1` left border
  - Reading pane: fetches `GET /admin/tickets/{id}` on row click; shows all messages (customer/agent/internal note/system bubble types) + "Open full thread" button (links to `stcrm-thread` page). Originally showed last 5 — changed to all messages in 2.9 to match full thread.
- [x] Enqueued via `wp_enqueue_script` + `stcrm-inbox.asset.php` (auto-generated deps: react-dom, wp-element, wp-api-fetch) — only on `toplevel_page_stcrm-inbox`
- [x] `wp_localize_script` passes `stcrmInbox.nonce` + `stcrmInbox.threadUrl`
- [x] `package.json` + `webpack.config.js` added (`@wordpress/scripts` v30, custom entry/output, `clean.keep` excludes `stcrm-settings.js`)
- [x] Verified in browser: list renders, click opens reading pane with all 4 message types, filters trigger re-fetch, no console errors
- **Implementation note:** `createRoot` must be imported from `react-dom/client` — `@wordpress/element` v8.0.1 does not export it. `@wordpress/dependency-extraction-webpack-plugin` maps `react-dom/client` → `window.ReactDOM` and adds `react-dom` to asset deps automatically.

---

### 2.9 Admin Thread UI ✅ Complete (2026-06-24)

- [x] PHP page class for Thread screen (registered as `Thread` submenu page, reads `?id=N` param)
- [x] Render page shell: back-to-inbox button + "Ticket #id" kicker + subject as page title
- [x] Render mount point `<div id="crm-thread"></div>` for React island
- [x] Build React island (`src/admin/thread.jsx`):
  - Fetch ticket + messages from `GET /admin/tickets/{id}`
  - Render chat thread (customer left/grey, agent right/blue, internal note full-width/amber, system messages as hairline divider)
  - Render composer with two tabs: "Reply to customer" (white) / "Internal note" (amber `--amber-note` bg)
  - Reply mode helper text: "Customer gets a link-only email · Ctrl+Enter to send"
  - Note mode helper text: "Not emailed · agents only"
  - Ctrl+Enter shortcut to send; POST to `/admin/tickets/{id}/messages`
  - 300px sidebar: Customer panel (Freemius read-only data), Environment panel (env JSON fields — hidden if ticket.env is null), Manage panel (status/priority selects + Save changes + Resolve/Close buttons)
  - Manage panel: `PATCH /admin/tickets/{id}`; status/priority updated in local state on success
  - Auto-scroll to bottom on initial thread load
- [x] Enqueue React island assets only on `support_page_stcrm-thread`; `wp_localize_script` passes `ticketId`, `nonce`, `inboxUrl`
- [x] webpack.config.js: stcrm-thread added as second entry alongside stcrm-inbox
- [x] Inbox reading pane fix: removed `slice(-5)` — reading pane now shows all messages (full thread matches reading pane)
- [x] Verified in browser: full thread loads, Reply tab sends message and updates status, Internal note saved without status change, Manage panel patches correctly, all 4 bubble types render
- **Implementation note:** `remove_submenu_page('stcrm-inbox', 'stcrm-thread')` must NOT be called — WordPress's `user_can_access_admin_page()` iterates `$submenu` for capability checks; removing the item causes 403 even for users with the capability. Thread item left in nav.
- Plugin commits: `ad06dad` (Thread UI + inbox fix) + `da161c6` (CLAUDE.md)

---

### 2.10 Admin Contacts UI ✅ Complete (2026-06-25)

- [x] PHP page class for Contacts screen — `render_contacts_page()` in `STCRM_Admin`
- [x] Render page shell: title + "Run Freemius backfill" button + subhead
- [x] Render contacts table (PHP custom, not WP_List_Table): avatar initial circle, Name (blue-strong link), Email (mono), Tier badge, Plan, License badge (dot + status), Open tickets (blue pill if >0), Last activity, chevron
- [x] Rows link to Contact Detail page (`?page=stcrm-contact&id=N`); whole row is JS-clickable via data-href
- [x] Footer: "Showing N–M of total · synced X ago via webhook" + pagination controls
- [x] Contact Detail page — `render_contact_detail_page()`: 300px profile card + ticket history panel
- [x] Profile card: avatar, name, Tier + License badges, kv-list (Email, Plan, Freemius ID, Active sites, Customer since), "View in Freemius" external button, "Synced from Freemius · read-only" footer
- [x] Ticket history table: #, Subject, Status badge, Priority badge, Updated, chevron → links to Thread
- [x] DB: `get_admin_contacts()` extended with `open_tickets_count` correlated subquery; `count_contacts()` + `get_contacts_last_updated()` added
- [x] `format_contact()` in admin controller updated to expose `open_tickets_count`
- [x] New `stcrm-contact` hidden submenu registered (same pattern as `stcrm-thread` — must stay in submenu for WP cap checks)
- [x] CSS: avatar circle, license dot-badge variants, open-pill, contacts table, contact detail layout, profile card, ticket history table, utility classes (`.stcrm-muted`, `.stcrm-mono`, `.stcrm-kicker`), `.stcrm-badge--tier-free`, `.stcrm-badge--priority-normal`

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

### Phase 2 Security Patch ✅ (2026-06-25, plugin commit e9759fe)

10 findings from full code review; all fixed:

- [x] `check_ticket_cap()`: `null === $rows` → `$wpdb->last_error` — DB error no longer silently passes the cap check
- [x] `create_ticket()`: check `insert_message()` return; delete orphan ticket row on failure (was silent 201 with no first message)
- [x] Admin `create_message()`: guard `closed` ticket status — replies blocked 403, internal notes still allowed (public endpoint already had this guard; admin did not)
- [x] Customer `create_message()`: add `resolved_at => null` to reopen `update_ticket()` — resolved tickets no longer keep stale `resolved_at` after customer reply
- [x] Customer `create_message()`: check `update_ticket()` return; return 500 on failure
- [x] `queue_reverify()`: license key AES-256-CBC encrypted via `STCRM_Encryption` before entering AS jobs table; `reverify_contact()` decrypts at entry — raw key no longer appears in DB exports or backups
- [x] Admin `create_message()`: check `update_ticket()` return; return 500 on failure
- [x] `resolve_via_license_key()`: add `?? get_contact_by_license_key_hash()` fallback if post-upsert email lookup returns null (replica-lag guard)
- [x] `STCRM_Freemius_Sync`: call `delete_transient(STCRM_Tier_Resolver::CACHE_PREFIX . $key_hash)` on all tier-change events (install.upgraded/downgraded/cancelled, license.expired/cancelled) — stale 1-hour pro cache busted immediately
- [x] Admin `update_ticket()` PATCH: return 415 when request body is non-empty but not JSON (was silent `{updated:false}` 200)

---

## PHASE 3 — Touchpointse

> Goal: Customers can open and manage tickets from the portal and launcher without an account. All view states work.
> Done when a customer can open a ticket from the floating launcher with email alone, get auto-verified as pro, hit the turn limit, and resume via the emailed link.

---

### 3.1 Portal Block Registration ✅ Complete (2026-06-25, plugin commit 3ffae9a)

- [x] Scaffold `sublime-crm/support-portal` block using `@wordpress/scripts`
  - `block.json`: name, title, description, category=widgets, icon=format-chat, editorScript, viewScript=stcrm-portal (named handle), render=render.php
  - Editor component: static placeholder ("Support Portal — renders on the frontend") with dashed blue border — verified in Gutenberg 2026-06-25
  - Dynamic render callback (PHP): outputs `<div id="crm-portal" data-nonce="..."></div>` + `wp_localize_script` passes `stcrmPortal = {apiBase, nonce, productId}`
- [x] Enqueue portal CSS/JS only when the block is present on the page — `viewScript` in block.json auto-enqueues via WP; portal JS confirmed absent on pages without block
- [x] Register block on `init` hook via `STCRM_Blocks::register()` (new class `includes/Blocks/class-stcrm-blocks.php`)

**Implementation notes (2026-06-25, commit `3ffae9a`):**
- `viewScript: "stcrm-portal"` uses a named handle (NOT `file:`) — pre-registered by `STCRM_Blocks::register_portal_script()` so render.php can call `wp_localize_script('stcrm-portal', ...)` with a predictable handle; file-based viewScript generates an unpredictable auto-handle
- `src/portal/index.js` is a stub — Phase 3.3 replaces it with the full portal app
- webpack.config.js: two new entries `stcrm-portal-editor` (deps: wp-blocks, wp-element) and `stcrm-portal` → `admin/js/`
- `define_block_hooks()` added to `SublimeCRM` constructor between `define_api_hooks()` and `define_cron_hooks()`

---

### 3.2 Classic Page Template ✅ Complete (2026-06-25, plugin commit 42cbe8d)

- [x] Register "Support Portal" page template via `theme_page_templates` filter
- [x] Create PHP template file: full `get_header()` / `get_footer()` wrapper calling `do_blocks( '<!-- wp:sublime-crm/support-portal /-->' )`
- [x] Confirm template appears in Page Attributes dropdown when editing a page — verified 2026-06-25
- [x] Create a "Support" page in Laragon environment, assign template, verify block renders — verified 2026-06-25

**Implementation notes (2026-06-25, commit `42cbe8d`):**
- Template slug: `stcrm-support-portal.php`; registered via `theme_page_templates` filter, served via `template_include` intercept in `STCRM_Page_Templates`
- WP only discovers templates inside the active theme directory — plugin templates require both filters: `theme_page_templates` to add to dropdown + `template_include` to swap in the file
- Body class `page-template-stcrm-support-portal` confirms WP is applying the correct template
- `<div id="crm-portal">` is a direct child of `.site` with no wrapping content area — theme hero/CTA sections appear around it (expected for classic template with no sidebar)

---

### 3.3 Portal JS App Infrastructure ✅ Complete (2026-06-25, plugin commit 3e6d9ba)

- [x] Build portal JS app (`src/portal/index.js`) — React via `createRoot` (from `react-dom/client`; `@wordpress/element` v8.0.1 does not export it)
- [x] View state router (`router.js`): `VIEWS` enum, `getView()` / `getTicketId()` read URL params, `navigate()` / `replace()` push/replace via `history.pushState` + dispatch `stcrm:navigate` custom event (pushState does not fire `popstate`)
- [x] Session detection (`session.js`): `detectSession()` calls `GET /stcrm/v1/tickets` — 200 → `{authenticated: true, tickets}`, 401/403 → `{authenticated: false}`, other errors propagate to App error state
- [x] Navigation helpers: `navigate(view, params)` + `replace(view, params)` — App listens to both `popstate` and `stcrm:navigate`
- [x] Loading + error states: CSS `@keyframes stcrm-spin` spinner while session detection runs; `<ErrorState>` on unrecoverable errors
- [x] Polling manager (`polling.js`): `createPoller(callback, 15000)` — skips ticks when `document.hidden`, immediate callback on `visibilitychange` restore; correctly tree-shaken until Phase 3.8 (ThreadView) imports it
- [x] `api.js`: re-exports `apiFetch` pre-configured with nonce middleware from `window.stcrmPortal.nonce`
- [x] `App.jsx`: root component wiring session detection + routing + 6 view stubs (replaced in 3.4–3.10)
- [x] Bundle deps: `react-dom, react-jsx-runtime, wp-api-fetch, wp-element` (auto-detected by `@wordpress/dependency-extraction-webpack-plugin`)
- [x] All 6 `?view=` routes return HTTP 200; `stcrmPortal` nonce verified in page source; `stcrm:navigate` + VIEWS + session path all present in built bundle

---

### 3.4 Portal View: New Ticket Form ✅ Complete (2026-06-25, plugin commit `9384d5e`)

- [x] Render form fields: Email, Name (optional), Subject, Category (select — from Settings categories), Message textarea, License key (optional), "Add environment details" collapsible (Site URL, WP, PHP, Plugin), honeypot `company_url` (off-screen, `tabIndex=-1`)
- [x] Sidebar: "Before you post" docs card (search docs button), "★ Pro — Faster replies" blue card, privacy note
- [x] On submit: `POST /tickets` → 201 → success state ("Ticket submitted!" + "View your tickets →" button); 409 `stcrm_open_ticket_exists` → navigate `?view=cap-reached&ticket=<id>`; 409 `stcrm_ticket_cap_reached` → navigate `?view=cap-reached`; 4xx → inline red error banner
- [x] Match design: H1 "How can we help?", subhead with "View your tickets →" link
- [x] `stcrmPortal.categories` added to render.php localization; `name` param added to POST /tickets controller (stored on new contacts)
- [x] `admin/css/stcrm-portal.css` created; referenced via `block.json` `"style"` key — auto-enqueued by WP when block renders
- [x] `Icon.jsx` shared SVG component created for all portal views
- [x] CAP_REACHED routing moved above auth split — accessible from both auth states
  > Plugin commit `9384d5e`

---

### 3.5 Portal View: Cap Reached (409) ✅ Complete (2026-06-25, plugin commit `7ed8d23`)

- [x] Show amber banner: "You already have an open ticket" (free) or "You've reached your open ticket limit" (pro)
- [x] Display existing ticket card: authenticated → `#id` + StatusBadge + subject (fetched via `GET /tickets/{id}`); unauthenticated → `#id` only (session-auth endpoint not callable)
- [x] CTA adapts: authenticated → "Go to my ticket" (→ ThreadView); unauthenticated → "Sign in to view" (→ AuthView); pro cap → "View my tickets" / "Sign in to view your tickets"
- [x] Footnote on free cap: "Pro customers can keep up to 5 open tickets…"
- [x] `Badges.jsx` created: `StatusBadge`, `PriorityBadge`, `TierBadge` — shared with 3.6 + 3.8
  > Plugin commit `7ed8d23`

---

### 3.6 Portal View: My Tickets ✅ Complete (2026-06-25, plugin commit `b259950`)

- [x] Fetch `GET /tickets` on session auth
- [x] Header: "My tickets" + "Signed in as {email} · Sign out" + "+ New ticket"
- [x] Card list: each row = #id kicker + "N new reply" pill, subject (15.5px/700), Status + Priority + "Updated {time}", chevron → goes to thread view
- [x] Sign out: clear session cookie, redirect to new ticket form
- [x] `GET /me` endpoint added: returns `{email, name}` for authenticated contact
- [x] `POST /auth/signout` endpoint: marks DB token used via `mark_token_used()` + expires cookie (token cannot be replayed after signout)
- [x] `session.js` updated: parallel-fetches `/tickets` + `/me`; session shape now `{authenticated, tickets, contact:{email,name}}`

---

### 3.7 Portal View: Empty State ✅ Complete (2026-06-25, plugin commit `b259950`)

- [x] Show when `GET /tickets` returns empty array
- [x] Inbox icon (72px blue circle), "No tickets yet", helper text, "Open your first ticket" button

---

### 3.8 Portal View: Thread ✅ Complete (2026-06-25, plugin commit `0828d26`)

- [x] Render ticket header: subject (24px) + #id kicker + Status/Priority/Category badges
- [x] Render scrollable message thread (max-height ~340px): customer messages left/grey, agent messages right/blue (`.me` row-reverse)
- [x] System message: "updates automatically — checking for replies" (centered hairline)
- [x] 15s poll via polling manager — `createPoller(loadThread, 15000)` with `useCallback([ticketId])` for stable reference; stops on unmount
- [x] Mark agent messages as read on view (implicit — server handles on `GET /tickets/{id}`)
- [x] Composer — active state: textarea + "N of M replies left before an agent responds" counter (shown when `remaining < turnLimit`); Ctrl+Enter submits; `remaining`/`turn_limit` from API `composer` object
- [x] Composer — locked state: dashed card, lock icon; `reason='turn_limit'` → "Thanks — we've received your messages"; `reason='closed'` → "This ticket has been closed"
- [x] Composer state sourced entirely from API `composer` object — `compute_composer()` checks closed first, returns `locked:false` for pro (silent ceiling at POST only), uses `get_turn_count()` for free
- [x] `count_consecutive_messages()` extracted to private method on `STCRM_Guard_Matrix`; `get_turn_count()` added as public method returning `{consecutive, limit, remaining}`
- [x] POST reply uses `message` key (not `body`) — matches `create_message()` `get_param('message')`
- [x] Auto-scroll only on new message count increase (via `prevCountRef`)

---

### 3.9 Portal View: Auth (Magic-link) ✅ Complete (2026-06-25, plugin commit `429f012`)

- [x] Request state: "View your tickets", "No password needed", email field, "Email me a sign-in link" button
- [x] Sent state: mail icon, "Check your inbox", "If that address has tickets, a sign-in link is on its way. The link works once and expires in 48 hours." + "← Use a different email"
- [x] Footer note: "For your security we never confirm whether an email has an account"
- [x] Both states always shown (API always 200 — no branching on match)
- [x] `handle_redemption()` redirect URLs fixed: valid+ticket → `?view=thread&ticket=N`, valid no-ticket → `?view=my-tickets`, expired/invalid → `?view=expired`; `get_portal_url()` queries `post_content LIKE '%wp:sublime-crm/support-portal%'` (portal page uses block in content, NOT `_wp_page_template` meta)

---

### 3.10 Portal View: Expired Link ✅ Complete (2026-06-25, plugin commit `429f012`)

- [x] Triggered when magic-link redemption fails (invalid/used/expired token) — `handle_redemption()` redirects to `?view=expired`
- [x] Amber hourglass icon (#fff3cd bg, #856404 text), "This link has expired", helper text
- [x] Email field + "Send a new link" → calls `POST /auth/magic-link` → transitions to "Check your inbox" state

---

### 3.11 Floating Launcher ✅ (commit `e283b12`, 2026-06-25)

- [x] Bottom-right 60px circular bubble (blue, chat icon ↔ × toggle)
- [x] 380px panel above bubble (radius 16px, shadow `0 20px 60px rgba(0,0,0,.28)`)
- [x] Panel header: gradient blue, "Support" label + "We usually reply within a few hours", close ×
  - **Label: NEVER "Chat". NEVER an online/offline indicator.**
- [x] Load launcher on every frontend page via `wp_enqueue_scripts` (conditional: frontend only)
- [x] Session-aware: read session state on open (call `GET /tickets` silently)
- [x] **View: No session** — compact form (Email, Subject, Message) + "Send message" + "Already have a ticket? Sign in →"
- [x] **View: My tickets** — "+ New" button + compact ticket rows (#id, "N new" pill, subject, status). Row → open thread view
- [x] **View: Open thread** — back chevron + #id + subject + compact message bubbles + inline reply input + send button
- [x] All launcher views use the same REST endpoints as the portal (same-origin, same session cookie)

**Implementation notes:**
- `STCRM_Launcher` PHP class: `enqueue()` on `wp_enqueue_scripts`, `render_mount()` on `wp_footer`
- `window.stcrmLauncher {apiBase, nonce, portalUrl}` — `portalUrl` via `post_content LIKE '%wp:sublime-crm/support-portal%'` query (NOT `_wp_page_template` meta — same pattern as auth controller)
- `src/launcher/Launcher.jsx`: all icons self-contained (`LqIcon` component); all form styles inline (no dependency on `stcrm-portal.css` which is scoped to `#crm-portal`)
- 15s thread polling via `setInterval` (not `createPoller` — launcher has no `document.hidden` polling complexity needed)
- "Sign in →" navigates to `portalUrl + '?view=auth'`
- Build: `stcrm-launcher.js` 14.2 KiB. Browser verified: bubble, panel open, no-session form all correct.

---

### Phase 3 Acceptance ✅ Complete (2026-06-27, Playwright verification)

- [x] "Support" page with classic template loads the portal block — verified 2026-06-25 (3.2)
- [x] New ticket form submits successfully; 409 shows cap card; validation errors show inline — verified 2026-06-25 (3.4/3.5)
- [x] Magic-link flow: request → "check your inbox" → session cookie issued → redirect to thread — PHP redirect verified 2026-06-27 (valid token → `?view=thread&ticket=1`); email delivery deferred to Phase 4; ⚠️ session cookie requires HTTPS (`secure=true` unconditional — correct for production)
- [x] Expired/reused link → expired view → re-request works — redirect verified 2026-06-27 (valid-format non-existent token → 302 → `?view=expired`); re-request flow verified 2026-06-25 (3.10)
- [x] Portal thread polls every 15s, pauses on tab hidden — verified 2026-06-25 (3.8)
- [x] Composer shows "N of 3 replies left" and locks correctly at the limit — verified 2026-06-25 (3.8, browser-verified with locked composer)
- [x] Launcher appears on all frontend pages, opens panel, all 3 view states transition correctly — verified 2026-06-25 (3.11)
- [x] Launcher shares session with portal (sign in on portal → launcher shows my-tickets) — verified 2026-06-27 (Playwright: injected session cookie → launcher shows "MY TICKETS" + ticket list on home page)

**Playwright verification notes (2026-06-27):**
- Session cookie `secure: true` is unconditional — correct for production HTTPS. Local HTTP (Laragon) cannot complete the full magic-link round-trip in a real browser; test on production or with HTTPS locally.
- `handle_redemption()` silently passes through `?t=` values not matching `stc_` + 39-char URL-safe base64 — intentional design to avoid intercepting other plugins' `?t=` parameters.
- Portal page currently titled "New Support" — rename to "Support" before go-live.

---

## PHASE 4 — Notifications & Hardening
> Goal: Emails arrive reliably. Auto-close runs. Security audit passes. Plugin is production-ready.
> Done when reply notice lands in inbox (not spam) with a working magic-link deep-link, and all abuse controls are verified.

---

### 4.1 Email Infrastructure ✅ Complete (2026-06-27, Playwright + AS DB verification)

- [x] Build `Services\Mailer` class wrapping `wp_mail` — `includes/Services/class-stcrm-mailer.php`
- [x] All sends queued via Action Scheduler (single retry +5 min on failure, then log) — 5 `queue_*()` static methods + 5 `handle_*()` AS handlers registered in `define_cron_hooks()`
- [x] Debounce logic: max 1 customer notification per ticket per N minutes (N from `email_debounce_min` setting) — transient `stcrm_debounce_{ticket_id}` set after successful send
- [x] Email sender: From name + From address from Settings (`email_from_name`, `email_from_address`)
- [x] Agent fallback: if ticket unassigned, send agent alert to `email_agent_fallback` setting (falls back to WP admin_email) — new setting added to defaults, Email tab UI, and save handler
- [x] Token generated at AS handler time — raw token never passed through AS jobs table or stored in DB

**Verification notes (2026-06-27):**
- Playwright + direct AS DB query (`wp_actionscheduler_actions`)
- `stcrm_send_ticket_confirmation` + `stcrm_send_agent_alert`: queued on `POST /tickets`, WP cron ran both handlers to `complete` status during test
- `stcrm_send_magic_link`: queued on `POST /auth/magic-link`, pending in AS queue
- `stcrm_send_reply_notification`: queued on `POST /admin/tickets/{id}/messages`, pending in AS queue
- No PHP fatal errors, no stcrm entries in debug.log after handler execution
- `email_agent_fallback` input visible on Settings › Email tab
- Email templates replaced in Phases 4.2–4.5 ✅

---

### 4.2 Email Template: Ticket Confirmation (Customer) ✅ Complete (2026-06-27)

- [x] Trigger: after `POST /tickets` creates ticket
- [x] Recipient: customer email
- [x] Subject: "We've received your ticket: {subject}"
- [x] Body: plain text + HTML. One button: "View your ticket →" linking to magic-link URL (deep-links to thread)
- [x] This email is the customer's first access path to the thread — magic link is mandatory
- [x] **No message content in email body**

Also implemented in 4.2: `build_magic_link_email()` — subject "Your sign-in link for support", "Sign in to support →" CTA, one-time-link footer note.

**Verification (2026-06-27):** Playwright + AS DB query. `stcrm_send_ticket_confirmation` queued on `POST /tickets`, completed without errors. `stcrm_send_magic_link` queued on `POST /auth/magic-link`, completed without errors. complete=20, pending=0, failed=0 across all template types.

---

### 4.3 Email Template: Agent Reply Notification (Customer) ✅ Complete (2026-06-27)

- [x] Trigger: after `POST /admin/tickets/{id}/messages` with `is_internal_note=false`
- [x] Recipient: customer email
- [x] Subject: "Your ticket has a new reply: {subject}"
- [x] Body: one button "View the reply →" linking to magic-link URL
- [x] Apply debounce (§4.1)
- [x] **No message content in email body — magic-link button only**

**Verification (2026-06-27):** `stcrm_send_reply_notification` queued on `POST /admin/tickets/{id}/messages`, completed without errors.

---

### 4.4 Email Template: New Ticket / Customer Message Alert (Agent) ✅ Complete (2026-06-27)

- [x] Trigger: new ticket created OR customer message posted
- [x] Recipient: assigned agent WP email (fallback: Settings fallback address)
- [x] Subject: "[Support] New message on: {subject} #{id}"
- [x] Body: ticket subject + direct link to Thread admin page
- [x] Internal alert — may include a message snippet (vendor-side only)

Implementation detail: `last_message_snippet()` helper fetches last customer `body` (non-internal, `sender_type=customer`), strips HTML, truncates to 200 chars.

**Verification (2026-06-27):** `stcrm_send_agent_alert` completed without errors.

---

### 4.5 Email Template: Auto-Close Notification (Customer) ✅ Complete (2026-06-27)

- [x] Trigger: auto-close cron closes a resolved ticket
- [x] Recipient: customer email
- [x] Subject: "Your support ticket has been closed: {subject}"
- [x] Body: "Your ticket was closed after {N} days resolved. If you need further help, open a new ticket." + link to portal

Note: `build_auto_close_notice()` implemented and PHP-verified. Runtime trigger (AS handler) verified when 4.6 (auto-close cron) is implemented.

---

### 4.6 Auto-Close Cron ✅ Complete (2026-06-27)

- [x] Daily cron event (registered in Phase 1 — implement logic here)
- [x] Query: tickets WHERE status='resolved' AND resolved_at < (NOW() - auto_close_days)
- [x] For each: set status='closed', insert `system` message ("ticket auto-closed after N days"), queue auto-close notification email

Implementation in `SublimeCRM::auto_close_tickets()` (`includes/class-sublime-crm.php`):
- Guards `$wpdb->update()` return — skips ticket if update fails (e.g. already closed race)
- Omits `sender_id` from insert so DB defaults to NULL (avoids null-format issue)
- Calls `STCRM_Mailer::queue_auto_close_notice($ticket_id)` after confirmed insert
- Batch cap: LIMIT 100 per daily run

**Verification (2026-06-27):** PHP CLI bootstrap + Playwright browser check.
- Ticket #14 set to resolved/8 days ago → cron fired → status = closed, system message inserted, `stcrm_send_auto_close_notice` = complete in AS.
- Admin thread screenshot confirmed: "Closed" badge, system message visible, sidebar Status = Closed.
- No PHP errors in debug.log.

---

### 4.7 Security Hardening Pass ✅ Complete (2026-06-27)

- [x] Audit all `$wpdb` queries — confirm 100% use `$wpdb->prepare()`
- [x] Audit all output — confirm `esc_html()`, `esc_attr()`, `esc_url()` on all rendered data
- [x] Confirm `body` stored via `wp_kses` minimal whitelist only (links, code, line breaks)
- [x] Confirm internal notes excluded **at the query level** in all public-facing endpoints (not template-level)
- [x] Confirm ownership check on every `GET /tickets/{id}` and `POST /tickets/{id}/messages`
- [x] Confirm tokens: `random_bytes(32)` → URL-safe base64; only SHA-256 hash stored in DB; raw never stored or logged
- [x] Confirm session cookie: HttpOnly, Secure, SameSite=Lax
- [x] Confirm HMAC webhook validation uses `hash_equals()` (constant-time)
- [x] Confirm honeypot on ticket form and magic-link form
- [x] Confirm rate limits active on all public endpoints (§2.4)
- [x] Confirm `stcrm_manage_tickets` capability check on every admin route
- [x] URLs in customer messages render with `rel="nofollow noopener"`

**Audit result (2026-06-27):** 3-agent parallel audit across all PHP + JSX. 2 fixes applied:
1. `get_portal_url()` in `class-stcrm-mailer.php` — raw `$wpdb->get_row()` wrapped in `$wpdb->prepare()` using `$wpdb->esc_like()` pattern. (Auth-controller and Launcher already had `prepare()` — PASS.)
2. Magic-link honeypot added: hidden `company_url` field in `AuthView.jsx` + `ExpiredView.jsx`; server-side discard in `request_magic_link()` (returns same generic 200). Client-side guard fakes success to avoid API hit.
**Verification (2026-06-27):** Playwright browser test — `?view=auth` portal rendered, honeypot field confirmed in DOM, API: normal (empty `company_url`) → 200, trap (filled `company_url`) → 200 (no signal). All 12 items PASS.

---

### 4.8 Uninstall ✅ Complete (2026-06-27)

- [x] Create `uninstall.php`
- [x] Check "delete all data on uninstall" setting (default: OFF)
- [x] If ON: drop all 4 tables, delete all `wp_options` keys, cancel all Action Scheduler jobs, clear all cron events, delete session cookies
- [x] If OFF: leave data intact

Implementation notes:
- `uninstall.php` was scaffolded in Phase 1; updated here to add AS job cancellation and WP-Cron cleanup.
- Loads `vendor/autoload.php` explicitly (plugin inactive at uninstall time) then calls `as_unschedule_all_actions()` per hook. Falls back to direct SQL delete from `actionscheduler_actions` if AS not available.
- `wp_clear_scheduled_hook()` for both daily crons (also runs on deactivation, repeated for safety).
- Session cookies cannot be cleared server-side; dropping `wp_stcrm_tokens` invalidates all outstanding sessions.
- Setting `delete_on_uninstall` (default 0/OFF): in defaults array, Settings UI (Tickets tab checkbox), save handler — all already in place from Phase 1.

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

### 4.10 FSE Template Prep — REMOVED (2026-06-27)

No dedicated template needed. The `sublime-crm/support-portal` block is placed directly in page content using the default theme template — which is how the portal is already running (page ID 2371, slug `new-support`). The classic page template system (`STCRM_Page_Templates`, `templates/support-portal.php`) has been removed entirely:

- Deleted `includes/class-stcrm-page-templates.php`
- Deleted `templates/support-portal.php` + `templates/` directory
- Removed `require_once` + `define_template_hooks()` call + method from `class-sublime-crm.php`

When/if the theme goes FSE, the block already works in the default template — no plugin changes needed.

---

### Phase 4 Acceptance
- Ticket confirmation email arrives within 30 seconds with working magic-link
- Agent reply notification arrives with no message content, only the magic-link button
- Reply notification is debounced (3 rapid agent replies → 1 customer email) — **VERIFIED 2026-06-27**: Playwright test (`test-debounce.js`) confirmed 3 rapid REST replies → exactly 1 `stcrm_send_reply_notification` queued. Fix: added pending-lock transient (`stcrm_reply_pending_{id}`) checked at queue time in `queue_reply_notification()`.
- Auto-close runs on schedule; closed ticket inserts system message
- All security audit items checked off — **VERIFIED 2026-06-27** (Phase 4.7): all 12 security items pass; 2 fixes applied (`$wpdb->prepare()` in Mailer, honeypot in auth/expired views)
- Uninstall with setting ON drops all tables and options — **VERIFIED 2026-06-27** (Phase 4.8): AS job cancellation + WP cron hooks cleared in `uninstall.php`
- mail-tester.com score 9–10 on production domain — pending (Phase 4.9 production ops)
- FSE template file — REMOVED 2026-06-27 (Phase 4.10): block works in default template; no dedicated template needed

---

## PHASE 5 — Design-Handoff Gap Closure

> Goal: close every gap between `design_handoff_support_crm/README.md` + `support-crm-spec.md` and the built plugin. Found via a full audit on 2026-07-03 (Phases 1–4 were already complete + a post-4.7 QA hardening pass, commit `08f5d78`).
> 11 confirmed gaps total: 3 the README's own "known design gaps" list already called out, 8 found by the independent audit. Address one group at a time; each is independently shippable.

---

### 5.1 Backfill Progress Meter ✅ Complete (2026-07-03, known gap — README item 1)

- [x] Expose richer backfill status from `STCRM_Backfill`: current page, and total pages/records if the Freemius API response provides a count
- [x] Render a progress meter in Settings → Freemius tab (below the "Run Backfill" button): status (`idle`/`running`/`completed`/`error_*`), current page, percentage or "page N" if total unknown
- [x] Meter must reflect a resumable job — reloading the Settings page while backfill is running should show current progress, not reset
- Files: `admin/class-stcrm-settings.php`, `includes/Services/class-stcrm-backfill.php`

**Implementation notes (2026-07-03):**
- `STCRM_Backfill`: added `TOTAL_KEY` option (`stcrm_backfill_total`), stored from the Freemius API's `total` field on each page fetch; reset alongside `OPTION_KEY` on `handle_trigger()`. Added `get_total()`, `get_progress()` (returns `{status, page, total, processed, percent}` — `percent` is `null` when total isn't known yet), and `ajax_status()` (AJAX handler: `check_ajax_referer` + `stcrm_manage_tickets` capability check, `wp_send_json_success(get_progress())`).
- New AJAX hook `wp_ajax_stcrm_backfill_status` wired in `class-sublime-crm.php` `define_api_hooks()`.
- `STCRM_Settings::render_page()`: replaced the plain status text with a `#stcrm-backfill-progress` container (data-attributes carry initial state) rendered via new private `render_backfill_progress_markup()` — a status line + conditional progress bar (only shown while `running` and total is known).
- `STCRM_Admin::enqueue_assets()`: added `wp_localize_script('stcrm-settings', 'stcrmSettings', {...})` with ajaxUrl, nonce, and i18n strings (JS re-renders using `{token}`-style placeholders, not printf, since it's plain string replace client-side).
- `admin/js/stcrm-settings.js`: added a self-contained poller — starts only if the container's initial `data-status` is `running`, polls `admin-ajax.php` every 3s via `fetch`, re-renders the same markup shape client-side, stops once status leaves `running`. Network errors retry on the next tick rather than freezing the meter.
- CSS: `.stcrm-backfill-progress`, `.stcrm-progress-bar` (track) + `.stcrm-progress-bar__fill` (blue `#2271b1` fill, width transition), `.stcrm-backfill-error` (red mono text) added to `admin/css/stcrm-admin.css`.
- **Verified (2026-07-03):** PHP syntax-checked (all 4 touched files, `php -l` clean). `wp eval` confirmed `render_page()` produces no fatals and includes the progress container. Playwright end-to-end (injected valid WP auth cookies for an existing admin user via `wp_generate_auth_cookie()` — no password needed, no destructive changes): simulated a `running` state (page 2, total 130) → page loaded with correct 77% bar + text ("100 of 130 contacts processed (page 2)"), live AJAX call returned matching JSON, JS poller re-rendered identically after one 3s cycle, zero console errors. Backfill options restored to original `error_missing_credentials` state after the test (no real Freemius credentials configured locally).

**Post-implementation code review (2026-07-03) — 5 findings, 4 fixed before commit:**
- [x] **Fix:** JS poller's error-status label only matched exact `idle`/`running`/`completed`/`error` keys, unlike PHP's `str_starts_with($status,'error')` handling — a live poll during a real error (e.g. `error_api: ...`) rendered the raw untranslated status duplicated instead of a clean "Error" label. `renderBackfillProgress()` in `stcrm-settings.js` now checks `data.status.indexOf('error') === 0` the same way, using `i18n.error` for the label and appending the raw detail once.
- [x] **Fix:** `TOTAL_KEY`/page ordering meant a poll landing between "total fetched" and "page 1 fully processed" showed a blank status line (page>0 gate hid the processed count) with an unlabeled 0%-width bar. Both PHP (`render_backfill_progress_markup()`) and JS (`renderBackfillProgress()`) now key the processed-count text off `total > 0` first, showing "0 of N contacts processed" instead of nothing. Added `i18n.withoutPage` string for this case.
- [x] **Fix:** defensive `return;` added after the 403 branch in `STCRM_Backfill::ajax_status()` — previously relied entirely on `wp_send_json_error()`'s internal `wp_die()` to stop execution.
- [x] **Fix:** JS poller now pauses while `document.hidden` and resumes immediately on `visibilitychange`, matching the existing `src/portal/polling.js` `createPoller` convention (previously polled every 3s indefinitely regardless of tab visibility).
- **Not fixed (flagged, not actioned):** the new `wp_ajax_stcrm_backfill_status` endpoint uses its own auth mechanism (`check_ajax_referer` + inline `current_user_can()`) instead of the plugin's established `stcrm/v1` REST + `STCRM_Session_Auth::authenticate_admin()` pattern. This is a design/architecture judgment call, not a bug — left as-is; revisit if a future security hardening pass touches admin auth.
- **Re-verified via Playwright (2026-07-03) after fixes** — using `waitForFunction` instead of fixed delays to avoid racing wp-cli's WP-bootstrap time against the 3s poll interval: confirmed (a) `error_api: Freemius API returned HTTP 500` renders as `Status: Error — error_api: Freemius API returned HTTP 500` via live poll (no duplication), (b) `page:null,total:130` renders `0 of 130 contacts processed` (no blank state), (c) zero `admin-ajax.php` requests fired while tab was simulated hidden (measured via Playwright request-count, not just DOM state), and the meter updated to `completed` immediately on visibility restore. Zero console errors.
- Plugin commit: `2e47f66` ✅ pushed (2026-07-03) — all 5.1 work + the 4 fixes above, bundled in one commit.

---

### 5.2 Capability Assignment UI ✅ Complete (2026-07-03, known gap — README item 2)

- [x] Add a control (Settings → Tickets & Guards tab) to assign `stcrm_manage_tickets` to roles beyond Administrator (e.g. checkboxes per role, or a multi-select)
- [x] On save: `WP_Role::add_cap('stcrm_manage_tickets')` for checked roles, `remove_cap()` for unchecked — Administrator should stay locked/always-on since Phase 1 grants it on activation
- [x] `includes/class-stcrm-activator.php` currently only grants the cap once at activation — this UI is the first way to change it afterward
- Files: `admin/class-stcrm-settings.php`, `admin/css/stcrm-admin.css`, `CLAUDE.md` (`includes/class-stcrm-activator.php` unchanged — still only handles the one-time activation grant)

**Implementation notes (2026-07-03):**
- New "Support Access" row on the Tickets & Guards tab, above the Guard matrix fields: one checkbox per role from `wp_roles()->get_names()` (excluding Administrator, which shows checked + `disabled` with a "(always granted)" note)
- `STCRM_Settings::get_support_roles()` — returns non-Administrator role keys that currently `has_cap('stcrm_manage_tickets')`, used to render checked state on load
- `STCRM_Settings::sync_support_roles(array $enabled_roles)` (private) — called from `handle_save()`'s `tickets` case; iterates `wp_roles()->get_names()` (skipping Administrator) and calls `add_cap()`/`remove_cap()` per role based on whether its key is in the posted (sanitize_key'd) array. Never looks up a role by an arbitrary posted string — only real registered roles are ever touched.
- Role capability state lives on the roles themselves (`wp_user_roles` option via `WP_Roles`), not inside the `stcrm_settings` option array — kept separate from the rest of the save-handler's field assignments
- `uninstall.php` already loops over every registered role removing `stcrm_manage_tickets` (built in Phase 1/4.8), so no uninstall changes were needed — any role granted access via this UI is already cleaned up correctly
- **Verified via Playwright (2026-07-03):** Administrator checkbox checked+disabled; Editor checkbox starts unchecked, checking + save grants the capability (confirmed via `wp eval` `has_cap()`), reload shows the checkbox still checked, unchecking + save revokes it (confirmed via `wp eval` again), and other Tickets-tab fields (e.g. `guard_free_open`) were unaffected by the save cycle. Zero console errors.
- Plugin commit: `46efc43` ✅ pushed (2026-07-03)

---

### 5.3 Launcher Docs-Deflection Link ✅ Complete (2026-07-03, known gap — README item 4)

- [x] Add a "Check our docs first" link/card to the launcher panel's no-session view (portal's New Ticket sidebar already has this card; launcher doesn't)
- [x] Needs a docs URL source — add a `docs_url` setting (Email tab or new field) or confirm an existing constant/option to reuse
- Files: `src/launcher/Launcher.jsx`, `admin/class-stcrm-settings.php`, `blocks/support-portal/render.php`, `includes/class-stcrm-launcher.php`, `src/portal/NewTicketView.jsx`

**Implementation notes (2026-07-03):**
- New `docs_url` setting added to `STCRM_Settings::$defaults` (empty by default) and a "Documentation URL" field on the Tickets & Guards tab, right after Categories
- `docsUrl` added to both localization points: `blocks/support-portal/render.php`'s `stcrmPortal` object and `STCRM_Launcher::enqueue()`'s `stcrmLauncher` object
- `src/launcher/Launcher.jsx`: added a `doc` icon to the launcher's self-contained icon set; `NoSessionView` now renders a "Check our docs first" link above the form when `window.stcrmLauncher.docsUrl` is truthy, omitted entirely otherwise
- **Bonus fix discovered mid-implementation:** the portal's own "Search the docs" button (`src/portal/NewTicketView.jsx`, sidebar "Before you post" card) had no `href` or `onClick` at all — it was dead markup despite the README describing it as already working. Wired it to the same `docsUrl` setting (now a real `<a target="_blank">`), and the whole card only renders when `docsUrl` is set (previously always rendered, non-functional when clicked)
- Rebuilt `stcrm-portal.js` + `stcrm-launcher.js` via `npm run build`
- **Verified via Playwright (2026-07-03):** with `docs_url` configured — portal docs card renders with a working `href`, launcher shows the docs link with the same `href`. With `docs_url` cleared — both disappear cleanly (no dead links left behind). No new console errors (pre-existing anonymous 401s on session-check calls, unrelated to this change).
- Plugin commit: `f162c15` ✅ pushed (2026-07-03)

---

### 5.4 Admin Assignee Controls ✅ Complete (2026-07-03, highest impact — no UI existed at all before this)

- [x] Thread → Manage panel: add an Assignee `<select>` populated with users who hold `stcrm_manage_tickets`, wired to the existing `PATCH /admin/tickets/{id}` `assigned_to` field (backend already supports this — `null` = unassign)
- [x] Inbox filter toolbar: render the Assignee `<select>` (All/Unassigned/named agents — see note below on "Me") in PHP — `src/admin/inbox.jsx` already had a listener wired to `#stcrm-filter-assignee`, it was dead code before this because the element was never rendered
- [x] Confirm `GET /admin/tickets?assignee=` REST param still works end-to-end once the UI sends it
- Files: `src/admin/thread.jsx` (ManagePanel), `admin/class-stcrm-admin.php` (render_inbox_page + new `get_agents()` helper), `api/class-stcrm-admin-controller.php`, `includes/Database/class-stcrm-database.php`

**Implementation notes (2026-07-03):**
- New `STCRM_Admin::get_agents(): array` (static) — `get_users(['capability' => 'stcrm_manage_tickets', ...])`, returns `[{id, name}]` sorted by display name. Shared by both the Inbox filter and the Thread Manage panel.
- `GET /admin/tickets?assignee=` extended to accept the keywords `me` (→ `get_current_user_id()`) and `unassigned` (→ `assigned_to IS NULL`), in addition to a plain numeric user ID. REST arg schema loosened from `type: integer` to `type: string` to allow the keywords through.
- `STCRM_Database::get_admin_tickets()` — `assignee` filter special-cases `'unassigned'` to `assigned_to IS NULL`; numeric values still bind as `%d` via `$wpdb->prepare()`.
- `src/admin/thread.jsx` `ManagePanel`: new Assignee `<select>` (Unassigned + `window.stcrmThread.agents`), included in the existing `patch()` PATCH call alongside status/priority. `stcrmThread` localization gained `agents` + `currentUser`.
- **Design change during review:** initially added a "Me" option to the Inbox Assignee dropdown per the README's literal "All/Me/Unassigned" wording, and built the `me` keyword server-side to support it. User caught that this was redundant in a screenshot review — the current user already appears in the dropdown by name (e.g. "sudin"), so a separate "Me" shortcut just duplicated an existing entry. Removed the "Me" `<option>` from the Inbox dropdown; kept the `me` keyword server-side (harmless, doesn't hurt to leave working REST support in place even without a dedicated UI trigger for it).
- **Verified via Playwright (2026-07-03):** Thread panel — assignee select starts on Unassigned, lists all 3 eligible agents, assigning + saving updates the DB and persists after reload, unassigning correctly nulls it out. Inbox — filter dropdown shows All/Unassigned/named agents (no Me); direct REST checks confirmed `?assignee=me`, `?assignee=unassigned`, and `?assignee=1` (numeric) all return the correct ticket sets. Zero console errors.
- Plugin commit: `b4cf9b2` ✅ pushed (2026-07-03)

---

### 5.5 Inbox Search Box ✅ Complete (2026-07-03)

- [x] Add search input to Inbox filter toolbar: "Search subject or email…"
- [x] Wire JS to include a `search` param on fetch/filter-change
- [x] Add `search` param to `GET /admin/tickets` REST args in the admin controller
- [x] Add `LIKE` search over ticket subject + contact email to `STCRM_Database::get_admin_tickets()` WHERE clause (currently only status/priority/tier/assignee are filterable)
- Files: `admin/class-stcrm-admin.php`, `src/admin/inbox.jsx`, `api/class-stcrm-admin-controller.php`, `includes/Database/class-stcrm-database.php`, `admin/css/stcrm-admin.css`

**Implementation notes (2026-07-03):**
- New `<input type="search" id="stcrm-filter-search">` added to the Inbox filter toolbar, pushed to the right end via `margin-left: auto` in `stcrm-admin.css`
- `STCRM_Database::get_admin_tickets()`: `search` filter adds `( t.subject LIKE %s OR c.email LIKE %s )` using the same `%` . `$wpdb->esc_like()` . `%` pattern as other LIKE queries in the plugin; reuses the existing `c` (contacts) JOIN already present for `contact_email`/`contact_name`
- `api/class-stcrm-admin-controller.php`: `search` REST arg added (`type: string`), trimmed + `sanitize_text_field()`'d before reaching the DB layer
- `src/admin/inbox.jsx`: unlike the other filters (discrete `<select>` elements wired on `change`), the search input is wired on `input` with a 300ms debounce timer — avoids firing a fetch per keystroke. `getInitialFilters()` and the generic filter → query-string effect needed no changes since `search` slots into the existing keyed-object pattern automatically.
- **Verified via Playwright (2026-07-03):** direct REST checks confirmed subject-substring search returns only the matching ticket, email search returns all tickets sharing that email, no-match search returns an empty array. Live UI check (typing into the box) confirmed the visible Inbox list narrows from 12 rows to 1 and restores to 12 on clearing, using `waitForFunction` rather than fixed delays to avoid a debounce/fetch timing race in the test itself. Zero console errors.
- Plugin commit: `69ca300` ✅ pushed (2026-07-03)

---

### 5.6 Freemius Webhook Event Coverage ✅ Complete (2026-07-03)

- [x] Add handler for `license.created` / `payment.created` (new pro purchase not accompanied by an `install.*` event)
- [x] Add handler for `license.plan.changed`
- [x] Add handlers for `license.extended` / `license.shortened`
- [x] Add handler for `license.deleted` if applicable to this product's Freemius config
- [ ] Verify against real/sandbox Freemius events before go-live — ⚠️ pending: user hadn't created the Freemius product yet as of 2026-07-03, and in the process of setting it up surfaced the Phase 6 multi-product finding below. Code-level verification done via direct event simulation instead (see notes); real/sandbox verification still needed once the product exists.
- Files: `includes/Services/class-stcrm-freemius-sync.php` (`process_event()`)

**Implementation notes (2026-07-03):**
- `license.created` / `payment.created` → routed through the existing `handle_license_status_change( $product_id, 'active', 'pro', $payload )` (targeted update if the contact exists, full upsert if not — this generic method already handled the "no install data" case for `license.expired`/`cancelled`, so new-purchase events reuse it directly)
- `license.plan.changed` → new `handle_plan_changed()`: updates only `plan`, leaves `tier`/`license_status` untouched (a plan swap doesn't itself mean the license became active/inactive); silently ignores events for contacts not yet in the DB
- `license.extended` / `license.shortened` → new `handle_license_expiry_changed()`: updates only `license_expires`, same untouched-tier/status reasoning, same silent-ignore-if-unknown behavior
- `license.deleted` → folded into the existing `license.cancelled`/`subscription.cancelled` case (→ free/cancelled)
- `handle_license_status_change()` extended to also set `plan` when the payload carries a non-empty `plan_name` — needed for the new-purchase path, and guarded so events that omit `plan_name` (e.g. `license.expired`) never null out a previously known plan
- All three new/extended handlers bust the `stcrm_lv_{key_hash}` tier-resolution cache transient, since `plan`/`license_expires`/`tier` are all part of that cached API-result snapshot
- **Verified (2026-07-03) via direct event simulation** (no Freemius product exists yet, so sandbox/real events aren't possible — instead called `STCRM_Freemius_Sync::process_event()` directly with constructed payloads for 8 scenarios): new-contact `license.created`, existing-contact `payment.created` upgrade (sites_count preserved, cache busted), `license.plan.changed` (plan only, cache busted), `license.extended`/`shortened` (expiry both directions), `license.deleted` (free/cancelled, plan preserved), `license.plan.changed` for an unknown contact (silently ignored, no row created), and a regression check confirming `license.expired` with no `plan_name` in the payload still works and does NOT null out an existing plan.
- Plugin commit: `86dfed2` ✅ pushed (2026-07-03)

---

### 5.7 Thread Sidebar — Customer Panel Completeness ✅ Complete (2026-07-04)

- [x] Add a distinct license-status badge (separate from the Tier badge) per README spec
- [x] Render `license_expires` ("Expires") — already returned by the admin ticket API, just not read by the component
- [x] Render `created_at` ("Customer since") — same, already available, not rendered
- [x] Add footer note "Synced from Freemius · read-only"
- [x] Masked license key (`sk_live_••••a31f`) — **not implementable as spec'd**: only `license_key_hash` (SHA-256) is stored, not a reversible/maskable raw key. Skipped, as anticipated by this checklist.
- Files: `src/admin/thread.jsx` (CustomerPanel), `admin/css/stcrm-admin.css`
- Plugin commit: `0aa8c06` ✅ pushed (2026-07-04)
- Implementation notes: added `ContactTierBadge` (★ Pro / Free) and `LicenseBadge` (Active/Expired/Cancelled/No license, colored dot) — both reuse the CSS classes already shipped on the Contacts page (`stcrm-badge--pro`, `stcrm-badge--tier-free`, `stcrm-badge--license`, `stcrm-badge--lic-*`) instead of introducing new ones. Removed the old plain-text Tier/License KV rows since the badges now cover that data — avoids showing the same value twice. **Judgment call:** the README/design mock's literal badge text is "License active"; used the shorter "Active"/"Expired"/"Cancelled"/"No license" labels instead to match the wording the Contacts page already ships in production (same license_status enum, same visual system) — verbose vs. terse phrasing for the same badge across two admin screens would have been the inconsistency, not the fix.
- Verified via Playwright across all four license states (active/expired/cancelled/none) plus null-field edge cases (no name, no plan, no expiry, no FS user ID all correctly fall back to "—"); screenshot-confirmed against the design mock layout by the user.

---

### 5.8 Thread Header Completeness ✅ Complete (2026-07-04)

- [x] Add category badge to the Thread header (currently only Tier/Status/Priority render)
- [x] Add "Assigned to you" indicator to the Thread header — depends on 5.4 landing first (assignee data needs to be in the component's ticket state)
- Files: `src/admin/thread.jsx`, `admin/css/stcrm-admin.css`
- Plugin commit: `fbdc1b8` ✅ pushed (2026-07-04)
- Implementation notes: `CategoryBadge` renders `ticket.category` in a grey badge (hidden entirely when null — matches how most of these QA/test tickets have no category set). "Assigned to you" is right-aligned in the header (`margin-left: auto`), shown only when `ticket.assigned_to === currentUserId`.
- **Bug caught during Playwright verification:** the assignee indicator never rendered, even for tickets assigned to the logged-in agent. Root cause: `wp_localize_script` stringifies all scalars, so `window.stcrmThread.currentUser` is `"1"` (string) while `ticket.assigned_to` from the REST response is `1` (number) — the strict `===` comparison always failed silently. Fixed by `Number()`-casting `currentUser` once before comparing.
- Verified via Playwright: category badge shows/hides correctly on real data (tickets #7 "Pre-sale", #9 "Technical Support" have categories; most QA test tickets don't), assignee indicator shows only when assigned to the current user and hides for other assignees/unassigned, no console errors. User cross-checked ticket #13 (no category, no coincidence — genuinely null in DB) and ticket #7 (category + assignee both rendering) to confirm the feature wasn't confusing status for category.

---

### 5.9 Inbox List Pane Header Row ✅ Complete (2026-07-04)

- [x] Add the missing header row above the ticket list: "N tickets" (count) + "Sort: Smart" label
- Files: `src/admin/inbox.jsx` (TicketList), `admin/css/stcrm-admin.css`
- Plugin commit: `a714528` ✅ pushed (2026-07-04)
- Implementation notes: new `TicketListHeader` shows a live count (singular "1 ticket" / plural "N tickets") that reflects the currently-filtered list, plus a static "Sort: Smart" label — rendered as plain text, not a functional dropdown, since no alternate sort order is defined anywhere in the spec (verified+priority "Smart" ordering is the only sort that exists). `.stcrm-list-pane` restructured from a single scrollable container into a flex column (fixed header + `.stcrm-list-pane__rows` scrolling independently below it) so the count/sort bar stays pinned while the list scrolls.
- Verified via Playwright: count updates correctly across filters (12 → 0 on an empty filter), singular/plural label correct, header stays fixed during scroll, ticket selection + reading pane unaffected, no console errors.

---

### 5.10 `POST /tickets` Response — `thread_url` Field ✅ Complete (2026-07-04)

- [x] Replace the hardcoded `null` (still has a `// Phase 3: populate once portal page URL is known.` placeholder comment) with a real resolved portal/thread URL
- [x] Reuse the existing portal-URL resolution logic already used elsewhere (`STCRM_Auth_Controller::get_portal_url()` / `STCRM_Mailer::get_portal_url()` — both query `post_content LIKE '%wp:sublime-crm/support-portal%'`)
- Files: `api/class-stcrm-tickets-controller.php` (line ~281)
- Plugin commit: `d5f3c1e` ✅ pushed (2026-07-04)
- Implementation notes: added `get_thread_url()` + `get_portal_url()` private helpers on `STCRM_Tickets_Controller`, resolving to `{portal_url}?view=thread&ticket={id}` — same `stcrm_portal_page_id` transient-cached query used by `STCRM_Mailer`/`STCRM_Launcher` (a 3rd private copy of the same lookup, since none of the three expose a shared static entry point to call instead). Honeypot's `fake_201()` deliberately left returning `thread_url: null` — its `ticket_id` is always `0`, nothing real to link to.
- Verified end-to-end (not just code review): created a real ticket via a live `curl POST /stcrm/v1/tickets` call, confirmed the response's `thread_url` correctly resolved to `http://sublimetheme.test/new-support/?view=thread&ticket=15`; attached a manually-issued session cookie for the ticket's contact and loaded that exact URL — it rendered the real ticket thread (subject, message, live composer). Test ticket/contact/token cleaned up afterward.
- **Note (not a bug):** `?view=thread` only renders for an authenticated session (confirmed in the portal's own routing). Right after ticket creation there's no session yet, so the field is correct but not immediately clickable for a brand-new anonymous ticket — the real first-access path stays the magic-link confirmation email, unchanged. No frontend code currently reads `thread_url` from this response.

---

### 5.11 Contact Detail — "Lifetime Value" Field — ❌ Out of scope, decision made (2026-07-04)

- [x] Decide whether to build this: `wp_stcrm_contacts` has no backing column and `support-crm-spec.md` §3.1 never defines this field either — it appears to be a README-only concept with no data source anywhere in the spec
- [x] **Decision: not proceeding.** Marked intentionally out of scope — see rationale below so this isn't rediscovered as a "gap" later.
- Files: none (no code change)
- **Rationale:** Confirmed by re-checking the code, not just assuming: `class-stcrm-freemius-sync.php`'s `payment.created`/`license.created` handler doesn't capture any dollar amount from the Freemius webhook payload today — it only flips tier/license status. Building this properly would require capturing payment amounts + `payment.refunded`/chargeback events going forward, backfilling historical payment history via the Freemius API, a new DB column, and a migration — a real sub-feature, not a gap-fill on par with 5.1–5.10. A naive running total that ignores refunds would be actively misleading (a "Lifetime value: $249" that never shrinks after a refund is worse than showing nothing). If real revenue reporting is wanted later, scope it as its own initiative, not a Phase 5 gap.
- **This closes Phase 5: all 11 gaps are now resolved or explicitly marked out of scope with reasoning.**

---

### Notes — judgment calls surfaced by the audit (not counted in the 11 gaps, no action required unless decided otherwise)

- **Launcher's compact no-session form has no honeypot field** (portal's `NewTicketView` does). Spec §10 says "honeypot on widget/portal forms" — ambiguous whether "widget" means this launcher or a separate out-of-scope widget. Backend rate limiting still applies regardless of this gap.
- **Default ticket categories** use full names (`Technical Support, Billing, …`) vs. the spec's literal lowercase example (`technical, billing, …`) — internally consistent throughout (Settings/validation/portal all agree), purely cosmetic vs. the spec text.

---

### Phase 5 Acceptance

- [x] All 11 confirmed gaps above resolved or explicitly marked out-of-scope with reasoning (5.11) — **Phase 5 complete 2026-07-04**
- [ ] Backfill progress visible and accurate during a real/sandbox run — ⚠️ pending real Freemius credentials (code complete; verified 2026-07-03 with a simulated running state via Playwright — see 5.1 implementation notes)
- [x] A non-Administrator role can be granted `stcrm_manage_tickets` and use the Inbox/Thread/Contacts pages — verified via Playwright + `wp eval` in 5.2
- [x] Agent can assign and reassign tickets from both Inbox filter and Thread Manage panel — verified via Playwright in 5.4
- [x] Inbox search returns correct results by subject and by contact email — verified via Playwright in 5.5
- [ ] Freemius sandbox events for all newly-handled event types correctly update contact tier/plan/expiry — ⚠️ pending real Freemius credentials (5.6 was verified via 8 direct event-simulation scenarios calling `process_event()` directly, not real/sandbox webhooks — no Freemius product existed yet to test against)
- [x] `POST /tickets` response `thread_url` resolves to a working link — verified end-to-end in 5.10 with a live ticket + session cookie

---

## PHASE 6 — Multi-Product Freemius Support

> **Status: design complete (2026-07-05), no code written yet — brainstormed and approved by the user, awaiting explicit go-ahead to implement.** Originally surfaced 2026-07-03 while verifying 5.6 (Freemius Webhook Event Coverage): the user hadn't created the Freemius product yet and, in setting it up, noticed Settings only has a single Product ID field. Parked until Phase 5's 11 gaps closed (2026-07-04); brainstormed with the user 2026-07-05.
> Scope target (user's call): **this site only** — a small, known set of products (currently 4 pro themes, expected to grow), not a generic multi-tenant feature for other installs.

### The finding (confirmed via code, 2026-07-03)

The DB schema was built multi-product-ready from day one — every row in `wp_stcrm_contacts` / `wp_stcrm_tickets` carries a `product_id` column, and queries are scoped by it. But the **application logic** was built for exactly one Freemius product per install. Three concrete break points:

1. **Settings has exactly one credential set** — `freemius_product_id`, `freemius_secret_key`, `freemius_api_token` are single flat fields (`admin/class-stcrm-settings.php`). No way to register a second product's credentials.
2. **Webhook HMAC validation is single-secret-key-only** — `api/class-stcrm-webhook.php` checks the signature against the one configured secret before even decoding the payload. A second product's webhook (signed with a different secret) fails validation and gets 401'd, even though `STCRM_Freemius_Sync::process_event()` already reads `product_id` per-payload correctly.
3. **Every consumer-facing read hardcodes the one configured product_id**: `admin/class-stcrm-admin.php`, `api/class-stcrm-admin-controller.php`, `api/class-stcrm-auth-controller.php`, `api/class-stcrm-tickets-controller.php`, `blocks/support-portal/render.php`, `includes/Services/class-stcrm-backfill.php`.

### Design decisions (brainstormed 2026-07-05)

- **Ticket product identification: explicit dropdown**, not auto-detection by email/license. A customer picks their product from a `<select>` when opening a ticket — always correct, no ambiguity, no failure mode for customers who own 2+ products. Both ticket-creation entry points (Portal `NewTicketView` and Launcher `NoSessionView`) get this field, since both `POST /tickets`.
- **No "General/pre-sale" pseudo-product.** Considered a `product_id = 0` sentinel for customers without a purchase yet, but rejected — the dropdown is product-only, and pre-sale intent is already expressible via the existing `category` field (a "Pre-sale" category value is already in use). This means `STCRM_Tier_Resolver` / `STCRM_Guard_Matrix` need **no special-case branch** — every ticket always carries a real, configured `product_id`.
- **Settings UI: dynamic add/remove product rows** (not a fixed set of slots) — scales cleanly as products are added, no arbitrary cap.
- **Webhook secret resolution: hybrid brute-force + diagnostic parse ("Approach B+").** Rejected reading the product ID out of the payload *before* verification as the primary mechanism (fragile if Freemius's field name/path differs by event type) and rejected per-product webhook URLs (requires reconfiguring each product's URL in the Freemius dashboard, easy to forget when adding a product). Instead: loop over all configured products' secrets, `hash_equals()` each against the signature, first match wins — the signature match *is* the identification, nothing is trusted from the payload for this decision. On the rare case where the product count grows large enough that failed-webhook debugging becomes painful, the payload is *also* best-effort parsed for a product identifier purely for the error log line (never for the accept/reject decision) — chosen because performance is a non-issue at any realistic product count for this site (HMAC-SHA256 is microseconds), but clear failure attribution matters as the list grows past a handful of entries.
- **Admin visibility: badge + filter.** Now that tickets/contacts span multiple products, Inbox and Contacts need to show which product each row belongs to, and Inbox needs a Product filter — otherwise the support team has no way to triage by product.
- **Spec location:** this section of `phase-plan-clickup.md`, matching the established Phase 5 pattern, rather than a separate spec file.

### 6.1 Settings: Multi-Product Data Model ✅ Complete (2026-07-05)

- [x] Replace flat `freemius_product_id` / `freemius_secret_key` / `freemius_api_token` fields with `$settings['products'] = [{product_id, label, secret_key, api_token}, ...]`
- [x] Settings → Freemius tab: dynamic add/remove rows (JS-driven, no arbitrary slot cap)
- [x] Save-time guard: reject the save with a clear error if two product rows have an identical `secret_key` (prevents ambiguous matches in 6.2's brute-force loop)
- [x] **Migration:** on first load after upgrade, if `products` is empty but the old flat fields are set, auto-convert into a single-entry list. Idempotent — skip entirely if `products` is already non-empty. No DB data migration needed.
- Files: `admin/class-stcrm-settings.php`, `admin/js/stcrm-settings.js`, `admin/css/stcrm-admin.css`

**Implementation notes (2026-07-05):**
- `STCRM_Settings::$defaults['products']` replaces the 3 flat keys. `maybe_migrate_products()` (private static, called from `get_settings()`) converts the old fields into a one-entry list and persists it via `update_option()` — runs once, short-circuits immediately afterward since it only fires when `products` is empty. Old encrypted `secret_key`/`api_token` ciphertext is carried over as-is (no decrypt/re-encrypt needed).
- New `render_product_row( $key, $product )` renders one repeatable row (Label, Product ID, API Token, Secret Key, Remove button). Existing rows use their real array index as `$key`; a hidden `<template id="stcrm-product-row-template">` (key placeholder `__INDEX__`) is cloned by JS for new rows.
- `admin/js/stcrm-settings.js` `initProductRows()`: "Add Product" clones the template and replaces `__INDEX__` with a `new_N` counter key; "Remove" uses event delegation on `#stcrm-products-list` since rows are added dynamically after page load.
- **Row identity on save:** no drag-reorder exists, so a submitted row's key (its original position, or `new_N`) reliably maps back to its pre-save counterpart. `build_products_from_post()` (private static) looks up `$existing_products[$key]` for the "keep saved secret/token if the password field was left blank" fallback — works for original numeric-position keys, and correctly finds nothing (blank stays blank) for genuinely new `new_N` rows. Rows with an empty `product_id` are dropped.
- **Duplicate-secret guard:** `has_duplicate_secret()` compares **decrypted plaintext**, not ciphertext — `STCRM_Encryption::encrypt()` uses a random IV per call, so two rows sharing one secret would never produce equal ciphertext even though the plaintext matches. On a duplicate, the save is aborted (redirect with `error=duplicate_secret`, option left untouched) before `update_option()` is ever called.
- Removed the single global "Run Backfill" button + progress meter from the Freemius tab in this same commit — it targeted the one now-deleted flat `api_token`/`product_id` setting and would otherwise silently break. Per-product backfill (button + progress meter per row) returns in 6.5; `render_backfill_progress_markup()` is left in place unused, to be reused rather than rewritten there.
- **Verified (2026-07-05):**
  - PHP CLI: migration runs correctly against the real dev option (old flat fields → `products[0]`, secret decrypts intact, idempotent on a second call — no further writes).
  - PHP CLI (reflection): `build_products_from_post()` — existing row with blank password fields keeps its old encrypted secret/token, brand-new row's own values are freshly encrypted, blank-`product_id` rows are dropped. `has_duplicate_secret()` — correctly flags two rows sharing one secret (even with different ciphertext/IV), correctly allows distinct secrets, correctly ignores rows with no secret configured yet.
  - HTTP end-to-end (authenticated admin cookies + a correctly-derived nonce, generated via `wp_generate_auth_cookie()`/`WP_Session_Tokens`, no Playwright available this session): GET the Freemius tab → renders the migrated product row + Add-Product button + hidden template. POST a save with an existing row (blank password fields) + a new row (own secret/token) → 302 to `?saved=1`; confirmed via `get_settings()` that the existing secret was preserved and the new row's values were correctly encrypted. POST a save where the new row's secret duplicates the existing row's secret → 302 to `?error=duplicate_secret`, option left completely unchanged, error notice confirmed present in the re-rendered page HTML.

### 6.2 Webhook: Hybrid Secret Resolution ✅ Complete (2026-07-05)

- [x] `STCRM_Webhook::validate_signature()`: loop over all configured products' secrets, `hash_equals()` each against the `x-signature` header; first match identifies the product for this request
- [x] On no match: best-effort, non-authoritative parse of the JSON body for a product/plugin identifier field (wrapped defensively — purely diagnostic), include it (or "unrecognized") in the 401 log line. Never affects the accept/reject decision.
- [x] `process_event()`'s existing per-payload `product_id` read stays the source of truth for event *processing* — the loop above only resolves which secret to use for *signature verification* (unchanged, no code touched there)
- Files: `api/class-stcrm-webhook.php`

**Implementation notes (2026-07-05):**
- `validate_signature()` rewritten: reads `STCRM_Settings::get_settings()['products']` (6.1's new list), rejects with `stcrm_no_products_configured` if empty, then loops decrypting each product's `secret_key` and computing `hash_equals()` against the request's `x-signature` header — first match returns `true` immediately. No product identity is threaded through the return value; `STCRM_Freemius_Sync::process_event()` (untouched) independently re-derives `product_id` from the payload body (`plugin_id ?? theme_id`) once processing starts, exactly as the design called for.
- New `log_unmatched_signature()`: on a full loop with no match, best-effort `json_decode`s the raw body and reads the same `plugin_id ?? theme_id` fields `process_event()` uses, purely to make the `WP_DEBUG` log line more informative ("claimed product_id=X" or "no recognizable product_id in payload"). This parse never influences the accept/reject outcome — it only runs *after* the loop has already decided to reject.
- **Verified (2026-07-05)** against the real dev Settings (3 products now configured: Theme A/B/C, added by the user during their own 6.1 manual check):
  - PHP CLI (reflection on the private `validate_signature()`): a signature computed with Theme A's secret validates `true`; same for Theme B's secret; a signature computed with a secret matching *no* configured product correctly returns `stcrm_invalid_signature`; a request with no `x-signature` header correctly returns `stcrm_missing_signature`.
  - Confirmed the diagnostic log fires and is accurate but non-authoritative: a wrong-secret request for a payload claiming `plugin_id=123456` logged `claimed product_id=123456` even though the actual failure reason was an unmatched secret, not an unrecognized product — exactly the "log-only, never decides" behavior intended.
  - **Live HTTP round-trip** against the real REST route (`POST /wp-json/stcrm/v1/fs-webhook`, no auth cookie needed — public HMAC-only endpoint): a payload signed with Theme A's real secret → `200 {"received":true}`; the same payload with a bogus signature → `401 {"error":"Webhook signature mismatch."}`.

### 6.3 `GET /products` Endpoint + Ticket-Form Product Selector ✅ Complete (2026-07-05)

- [x] New public REST route `GET /stcrm/v1/products` → `[{product_id, label}, ...]` from the configured list. No secrets/tokens exposed — labels only.
- [x] `src/portal/NewTicketView.jsx`: add a required "Which product is this about?" `<select>` before Subject, populated from this endpoint
- [x] `src/launcher/Launcher.jsx` (`NoSessionView`): same product `<select>` added to its Email/Subject/Message form
- [x] `POST /tickets`: validate the submitted `product_id` server-side against the configured list — reject with 400 if it doesn't match a real product (never trust the client-submitted ID as-is)
- [x] Empty-list edge case: if no products are configured, the ticket form shows a clear "no products configured, contact admin" state instead of a broken empty dropdown
- [x] Portal block becomes product-agnostic as a side effect — one page/embed now serves all products, replacing the previous implicit one-portal-per-product assumption via the single global `productId`
- Files: `api/class-stcrm-tickets-controller.php`, `src/portal/NewTicketView.jsx`, `src/launcher/Launcher.jsx`, `blocks/support-portal/render.php`

**Implementation notes (2026-07-05):**
- `STCRM_Tickets_Controller::get_products()` (new, public route) returns the configured `products` list shaped to `{product_id, label}` only — `secret_key`/`api_token` never leave the server.
- `create_ticket()`: the old `$product_id = absint( STCRM_Settings::get_setting( 'freemius_product_id' ) )` is replaced by a new `resolve_product_id( string $submitted )` private helper — empty submission → 422 `stcrm_validation_error` ("Please choose which product this is about."), a value not matching any configured product's `product_id` → 400 `stcrm_invalid_product`. Everything downstream (tier resolution, contact upsert, guard matrix, ticket insert) is unchanged — it already took `$product_id` as a parameter, so only the *source* of that value changed.
- `src/portal/NewTicketView.jsx` and `src/launcher/Launcher.jsx` (`NoSessionView`) both independently fetch `GET /products` on mount and render a required product `<select>` (Portal: new row before Subject; Launcher: between Email and Subject in the compact form). Both show a "Support form unavailable" message in place of the form if the list loads empty (or the fetch fails — treated the same, since either means a ticket can't be created right now).
- `blocks/support-portal/render.php`: removed the `productId` key from `wp_localize_script( 'stcrm-portal', 'stcrmPortal', ... )` — confirmed via grep that nothing in `src/portal/` read `window.stcrmPortal.productId` before removing it.
- Rebuilt via `npm run build` (`stcrm-portal.js` 32.2 KiB, `stcrm-launcher.js` 15.7 KiB).
- **Verified (2026-07-05):** `GET /products` returns all 3 configured products (Theme A/B/C) with labels only. `POST /tickets` with no `product_id` → 422; with a made-up `product_id` → 400; with a real `product_id` (Theme B) → 201, and confirmed directly in the DB that both the new ticket row and its newly-created contact row carry `product_id = 789012` (Theme B), not the old hardcoded value — the full chain (dropdown selection → validation → tier resolution → contact upsert → ticket insert) is correctly product-scoped end to end. Test ticket/contact/message cleaned up after verification. **No Playwright this session** — the dropdown's on-screen rendering in the Portal/Launcher UI itself hasn't been visually confirmed in a browser; REST-contract behavior is fully verified.

**⚠️ Finding surfaced during 6.3:** `STCRM_Auth_Controller::request_magic_link()` still read the deleted flat `freemius_product_id` setting, so magic-link sign-in was broken for everyone (not just multi-product). This wasn't in the original 6.1–6.5 scope — **resolved as its own brainstormed sub-task, see 6.6 below.**

### 6.4 Admin UI: Product Visibility ✅ Complete (2026-07-05)

- [x] Inbox: Product badge on each list row (label looked up by `ticket.product_id`); Product filter `<select>` in the toolbar alongside Status/Priority/Tier/Assignee; `GET /admin/tickets?product_id=` filter param
- [x] Contacts: Product column in the table (same label lookup by `contact.product_id`)
- [x] Thread header / Contact detail: product label shown alongside existing badges
- [x] Stale product handling: a ticket/contact referencing a `product_id` no longer in Settings shows `"Product #12345 (removed)"` — labels are looked up live server-side, never denormalized onto the ticket/contact row
- Files: `src/admin/inbox.jsx`, `admin/class-stcrm-admin.php`, `api/class-stcrm-admin-controller.php`, `includes/Database/class-stcrm-database.php`, `src/admin/thread.jsx`, `admin/css/stcrm-admin.css`

**⚠️ Bug found and fixed as part of this task — the admin Inbox and Contacts pages were completely broken since 6.1 landed.** `STCRM_Admin_Controller::get_tickets()`/`get_contacts()` and `STCRM_Admin::render_contacts_page()`/`render_inbox_page()`/`render_contact_detail_page()` all still hardcoded `absint( STCRM_Settings::get_setting( 'freemius_product_id' ) )` — a setting deleted in 6.1 — so every one of these resolved `product_id = 0`, and since `get_admin_tickets()`/`get_admin_contacts()`/`get_tickets_by_contact()` filter strictly by `product_id = %d`, **every admin ticket/contact list returned empty** (no real row has `product_id = 0`). This wasn't caught by 6.1/6.2/6.3/6.6's own verification because none of those touched the admin REST routes or PHP-rendered pages. Confirmed via a live REST call before the fix: `GET /admin/tickets` returned `[]` despite real tickets existing with `product_id = 123456`.

**Implementation notes (2026-07-05):**
- `STCRM_Database`: `get_admin_tickets()`, `get_admin_contacts()`, `count_contacts()`, `get_contacts_last_updated()`, `count_open_tickets()` all take a nullable `?int $product_id` now — `null` means "across all configured products" (the new default), a real value narrows to one (the Inbox/Contacts filter). All five also `SELECT` `product_id` where they didn't already.
- `STCRM_Admin_Controller`: `get_tickets()`/`get_contacts()` read an optional `product_id` REST filter arg (via new `get_product_id_filter()`) instead of the hardcoded setting. New `resolve_product_label()` looks up a product_id against the live `products` Settings list, returning `null` if it's been removed since — `format_ticket_list_item()`, `format_ticket()`, and `format_contact()` all now include `product_id` + `product_label`.
- `STCRM_Admin`: `render_inbox_page()` — open-count badge now always spans all products (`count_open_tickets( null )`, independent of whatever filter is selected); Product `<select>` added to the toolbar, **only rendered when 2+ products are configured** (matches the established "don't add a control nobody needs" judgment call from 5.9's category-filter decision). `render_contacts_page()` — same optional `product_id` filter (via `$_GET`), Product column (also gated on 2+ products), own `resolve_product_label()` (PHP-page variant returns the final "Product #N (removed)" string directly rather than null, since there's no frontend JS layer to format it). `render_contact_detail_page()` — **the ticket-history "No tickets yet" bug is fixed by using `$contact->product_id` directly** (the contact already knows its own product — no Settings lookup needed at all here), plus a new "Product" row on the profile card.
- `src/admin/inbox.jsx` — `product_id` added to the generic filter-wiring pattern (already fully generic via `Object.entries(filters)`, so this was a 2-line addition); new `ProductBadge` shown on both ticket rows and the reading pane header.
- `src/admin/thread.jsx` — same `ProductBadge` added to the Thread header, next to `CategoryBadge`.
- Rebuilt via `npm run build` (`stcrm-inbox.js` 7.32 KiB, `stcrm-thread.js` 10.8 KiB).
- **Verified (2026-07-05):** `GET /admin/tickets` (no filter) now returns real tickets with correct `product_id`/`product_label` (previously `[]`); `GET /admin/tickets?product_id=789012` correctly scopes to just that product; `GET /admin/contacts` returns contacts with `product_id`/`product_label`, including a legacy contact with a stale `product_id=1` correctly showing `product_label: null` (frontend renders this as "Product #1 (removed)"). Contacts admin page HTML confirmed the Product column renders "Theme A" for real contacts and "Product #1 (removed)" for the stale one. Contact Detail page for a real contact now shows its ticket history (previously always "No tickets yet") plus a "Product: Theme A" profile row. Inbox page HTML confirmed the Product filter `<select>` renders with all 3 configured products. **Not visually confirmed in a browser** — no Playwright this session; the React-rendered `ProductBadge` on Inbox rows/reading pane and the Thread header is confirmed correct at the data-contract level (REST responses carry the right fields) but not screenshotted.

### 6.5 Backfill: Per-Product ✅ Complete (2026-07-05)

- [x] Replace global `stcrm_backfill_last_page` / `stcrm_backfill_total` options with per-product keys (`..._{product_id}`)
- [x] `stcrm_run_backfill_page` AS job gains a `product_id` argument; reads that product's `api_token` from the settings list instead of one global token
- [x] Settings "Backfill" button (6.1) becomes one button + one progress meter per product row (reuses the existing Phase 5.1 progress-meter UI pattern, just parameterized)
- [x] Two products' backfills can run concurrently without interfering (disjoint option keys, disjoint AS job args)
- Files: `includes/Services/class-stcrm-backfill.php`, `admin/class-stcrm-settings.php`, `admin/js/stcrm-settings.js`, `includes/class-sublime-crm.php`

**This completes Phase 6 — all 6.1–6.6 task groups done.**

**Implementation notes (2026-07-05):**
- `STCRM_Backfill`'s three option-key constants became prefixes (`..._last_page_`, `..._status_`, `..._total_`), all now suffixed with `{product_id}` at every read/write site. `process_page( int $page, int $product_id )` gained the `$product_id` parameter (AS hook re-registered with `accepted_args = 2` in `class-sublime-crm.php`); new private `find_product( int $product_id ): ?array` looks up that specific product's row (label + encrypted secret/token) from Settings, replacing the old single flat-field read. `handle_trigger()` now reads `product_id` from the request, `wp_die()`s if it doesn't match any configured product (defense against a stale/tampered link), and both resets and re-triggers only that product's state.
- `get_status()`, `get_last_page()`, `get_total()`, `get_progress()` all now take `int $product_id` — no more implicit single-install-wide state.
- `admin/class-stcrm-settings.php` `render_product_row()`: the "Contact Backfill" row (removed from the page in 6.1, deliberately deferred here) is back — one "Run Backfill" button + one progress-meter container per row, only rendered once a row has a saved `product_id` (a brand-new unsaved row has nothing to back-fill yet). Container IDs are `stcrm-backfill-progress-{product_id}` with a `data-product-id` attribute so JS can target and poll the right one.
- `admin/js/stcrm-settings.js`: `initBackfillProgress()` now queries all `.stcrm-backfill-progress` containers (was a single `getElementById`) and polls each independently; the per-tick timer moved from a shared module-level variable to a property on each container element (`container._backfillTimer`), so two products' poll loops can't clobber each other. Each poll POSTs its own `product_id` alongside the existing shared nonce.
- **Verified (2026-07-05)** against the 3 real configured products: `process_page(1, 123456)` (Theme A, blank `api_token`) correctly short-circuited to `error_missing_credentials` without any API call; `process_page(1, 789012)` (Theme B, a test token from earlier 6.1 verification) correctly proceeded to *attempt* a real Freemius API call using Theme B's own token (failed on an unrelated local-environment SSL/curl issue, not a code bug) — confirming each product's own credentials are read independently, not a shared/global one. Confirmed via direct DB query that the two products wrote to fully disjoint option rows (`stcrm_backfill_status_123456` vs. `_789012`) with no cross-contamination. **Live HTTP round-trip** against `admin-post.php?action=stcrm_run_backfill`: an unconfigured `product_id=999999` correctly `wp_die()`s (500, request rejected before touching any state); a valid `product_id=123456` correctly 302-redirects to Settings and queues `stcrm_run_backfill_page` with args `[1, 123456]` (confirmed via the Action Scheduler actions table). Also found and removed one inert leftover option (`stcrm_backfill_status`, no product suffix) from pre-6.5 testing — already covered by `uninstall.php`'s wildcard `stcrm\_%` cleanup regardless, so no migration code was needed. All test options/AS jobs cleaned up after verification.

### 6.6 Email-Scoped Sessions (Magic-Link Sign-In Fix) ✅ Complete (2026-07-05)

> Not in the original 6.1–6.5 scope — surfaced while implementing 6.3: `STCRM_Auth_Controller::request_magic_link()` still read the deleted flat `freemius_product_id` setting, so magic-link sign-in was broken for everyone (not just a multi-product edge case). Brainstormed with the user as its own design (the deep-link `ticket_id` case is deterministic; the generic "sign in, no ticket context" case needed a real decision since contacts are now scoped per (product_id, email) and one email can have several contact rows). User chose: **one session shows tickets across every product the customer has bought under that email**, not just the one anchor contact used to issue the token.

- [x] `STCRM_Database::get_contacts_by_email( string $email ): array` — every contact row matching an email across all products, most-recently-updated first
- [x] `STCRM_Database::get_tickets_by_contact_ids( array $contact_ids, ... ): array` — same shape as `get_tickets_by_contact()` but `WHERE contact_id IN (...)`
- [x] `STCRM_Session_Auth::authenticate()` — after resolving the token's anchor contact (unchanged), also resolves every sibling contact ID sharing that email and attaches it as `_stcrm_contact_ids`; new `STCRM_Session_Auth::get_contact_ids()` accessor
- [x] `STCRM_Tickets_Controller::get_tickets()` — now calls `get_tickets_by_contact_ids()` with the full session contact-ID set, not just the anchor
- [x] `STCRM_Tickets_Controller::get_ticket()` / `create_message()` — ownership check changed from `ticket->contact_id === contact->id` to `in_array( ticket->contact_id, session_contact_ids )`; both also now look up the **ticket's own owning contact** for tier-dependent decisions (`compute_composer()`, rate limit, turn limit) instead of assuming the session anchor's tier — a ticket under a sibling contact can have a different tier than the anchor
- [x] `STCRM_Auth_Controller::request_magic_link()` — two paths: `ticket_id` present resolves deterministically via the ticket's own contact (verifying the submitted email matches); `ticket_id` absent resolves via `get_contacts_by_email()`, using the most-recently-updated match purely as the token's anchor (session expansion at validation time makes the anchor choice non-limiting)
- Files: `includes/Database/class-stcrm-database.php`, `api/class-stcrm-session-auth.php`, `api/class-stcrm-tickets-controller.php`, `api/class-stcrm-auth-controller.php`

**Implementation notes (2026-07-05):**
- Deliberately did **not** merge/denormalize contact rows across products — `wp_stcrm_contacts` stays exactly as scoped today `(product_id, email)` unique, since per-product tier/license tracking from Freemius webhooks depends on that. The fix is purely at the authorization layer (session → contact IDs), not the data model.
- `get_contacts_by_email()` and the anchor-contact logic are also correctly independent from the `ticket_id`-present path — a magic link requested *with* a ticket_id always resolves via that exact ticket's contact, never via the "most recently updated" heuristic, so a customer with 2+ products always lands on the right one when the request is ticket-scoped.
- **Verified (2026-07-05):** created two real tickets for the same email under two different products (Theme A `product_id=123456`, Theme B `product_id=789012`). Confirmed `get_contacts_by_email()` returns both contact rows. Manually issued a session token anchored to the Theme B contact (same pattern used for Bruno/CLI test sessions in earlier phases — no email delivery needed) and confirmed: `GET /tickets` returned **both** tickets (Theme A + Theme B) in one session; `GET /tickets/{id}` succeeded (200) for both the anchor's own ticket and the sibling ticket, and correctly returned 403 for an unrelated ticket belonging to a different email entirely. Separately verified the `ticket_id`-present magic-link path via direct `request_magic_link()` calls: a wrong email + a real `ticket_id` was silently ignored (anti-enumeration, 200 generic response, no job queued); the correct email + that `ticket_id` correctly queued the AS `stcrm_send_magic_link` job with the **ticket's own contact** (Theme A's contact, id 15) — not the Theme B anchor used in the generic-path test — confirming the two resolution paths are independent and each correct in isolation. All test tickets/contacts/tokens/AS jobs cleaned up afterward.

### Phase 6 Acceptance

- [x] Settings: add/remove product rows, save, reload → persisted correctly; duplicate-secret save is rejected with a clear error — verified in 6.1
- [ ] Webhook: signed payloads for 2+ distinct configured secrets each resolve to the correct product; unmatched signature → 401 with a diagnostic log line — verified in 6.2 against real configured secrets; real/sandbox Freemius event delivery still ⚠️ pending (same constraint as Phase 5.6)
- [x] Ticket creation (Portal + Launcher): dropdown lists correct products, submitted ticket carries correct `product_id`, tier resolution/guard matrix behave correctly per product — verified in 6.3 (backend/REST contract only; dropdown's on-screen rendering not yet visually confirmed in a browser, no Playwright this session)
- [x] Admin: Inbox product badge + filter, Contacts product column, stale "(removed)" label all verified — 6.4 (also fixed a live bug: admin Inbox/Contacts had returned zero results since 6.1, see 6.4 notes)
- [x] Backfill: two products' backfills run independently without cross-contaminating progress — verified in 6.5
- [x] Regression: a simulated old single-product install's settings migrate to a working one-entry `products` list with no behavior change — verified in 6.1
- [x] Magic-link sign-in: a customer with tickets under 2+ products can sign in once and see all of them — verified in 6.6 (added to Phase 6 Acceptance since it wasn't part of the original 5-item list)

### Current status (2026-07-05)

**Phase 6 is complete and now visually verified in a real browser.** 6.1–6.6 were all verified via PHP CLI + live HTTP round-trips during implementation; a Playwright environment (Chromium + Node) was then set up specifically to screenshot and interact with the Inbox, Contacts, and Settings pages, closing the "not visually confirmed" gap noted throughout this phase.

**One more live bug found and fixed during this visual pass:** the Contacts page's top-level "Run Freemius backfill" shortcut (`admin/class-stcrm-admin.php::render_contacts_page()`) still linked straight to `admin-post.php?action=stcrm_run_backfill` with no `product_id` — a pre-6.5 leftover that `handle_trigger()` (now requiring `product_id`) would have rejected with a fatal `wp_die()`. Fixed by pointing this shortcut at Settings → Freemius (where the correctly product_id-scoped "Run Backfill" buttons from 6.5 live) instead of firing an ambiguous untargeted action — this is the third live bug caught in this phase (after 6.4's admin Inbox/Contacts and 6.6's magic-link sign-in), all three sharing the same root cause: a consumer of the old single-product model that wasn't in the design doc's originally-named list of affected files.

**Visual verification confirmed (2026-07-05, screenshots taken):**
- Inbox: 12 real tickets render with correct "Theme A" product badges; Product filter dropdown present and functional (selecting "Theme B" correctly narrows to "0 tickets" / "No tickets found", clearing it restores "12 tickets"); zero console errors.
- Contacts: Product column renders "Theme A" for real contacts and "Product #1 (removed)" for the one legacy stale-product contact, exactly as designed; Product filter dropdown present; the backfill shortcut now correctly links to Settings.
- Settings → Freemius: all 3 products render with independent Label/Product ID/API Token/Secret Key/Contact Backfill rows, each showing "Status: Idle"; clicking "+ Add Product" correctly clones a 4th blank row with **no** Backfill control (since it has no saved `product_id` yet, matching the designed gating) and placeholder text.

### Bugfix — Inbox unread pill shown on closed tickets (2026-07-05, unrelated to Phase 6 scope)

User spotted the Inbox header badge ("5") not matching a hand-count of tickets showing a blue unread pill (6). Root-cause investigated (not a Phase 6 regression): the header badge is `count_open_tickets()` — "how many tickets are not resolved/closed" — and always has been; the per-row pill is `unread_customer_count` — "does this ticket have an unread customer message" — computed independently of status. Live-tested the read-marking mechanism itself (`mark_customer_messages_read()`, called on `GET /admin/tickets/{id}`) and confirmed it works correctly today. The actual anomaly: 4 old QA test tickets (#9–#12, closed) had customer messages that were inserted directly by test scripts and never went through the real "click to preview" flow, so they were stuck `read_at IS NULL` even after being closed — a terminal state that should never show an actionable "unread" indicator.

**User's chosen fix (out of 3 options offered):** closed tickets should never show an unread pill. Implemented as a one-line query change — `STCRM_Database::get_admin_tickets()`'s `unread_customer_count` subquery now excludes `status = 'closed'` — which fixes both future closures and retroactively clears the 4 stale QA tickets (no separate backfill needed, since the fix is query-level, not data-level). Verified via REST call (all 4 previously-stale tickets now report `unread_customer_count: 0`) and a fresh Playwright screenshot of the Inbox confirming no closed ticket shows a pill.

---

## PHASE 7 — Deep QA Findings (Performance, Security, Optimization, Error Handling)

> Found via a full manual code review of the entire plugin (all 26 PHP files, ~8,500 lines — no PHPCS/PHPStan available in the review environment, so this was direct code-reading of actual request/data flows, not static-analysis output), requested 2026-07-05 after Phase 6 completed. Not a design-handoff gap audit like Phase 5 — this is a QA pass across four lenses: performance, security, optimization/duplication, and error handling.
> 10 findings total, ranked by severity. **Handle one at a time, per user's explicit instruction — do not batch-fix.** None are showstoppers for current usage; #7.1, #7.2, and #7.3 are the priority order recommended.

---

### 7.1 Stored XSS via WordPress `display_name` in ticket system messages — HIGH (Security) ✅ Complete (2026-07-05)

- [x] `STCRM_Admin_Controller::update_ticket()` builds a status-change system message with `sprintf(..., $actor->display_name, ...)` and inserts it via `STCRM_Database::insert_message()` **without** passing through `sanitize_body()`/`wp_kses()` — every other message-insert path in the codebase does. WordPress core does not strip HTML from `display_name` at save time (relies on `esc_html()` at output, not input sanitization). That `body` is later rendered raw via `dangerouslySetInnerHTML` in `src/admin/thread.jsx`, `src/portal/ThreadView.jsx`, and `src/launcher/Launcher.jsx`. Any WP account — including a lower-privileged "support role" this plugin lets admins delegate — with a crafted display name, that then changes any ticket's status, gets stored script execution in an Administrator's wp-admin session or a customer's portal session.
- Files: `api/class-stcrm-admin-controller.php` (`update_ticket()`, system-message insert)
- Fix direction: run the system-message body through the same sanitizer as customer/agent messages, or at minimum `esc_html()` the display name at construction time.

**Implementation notes (2026-07-05):** Fixed via `sanitize_text_field( $actor->display_name )` applied at the point the system-message body is constructed, before the `?: __('an agent', ...)` fallback — matches the sanitization level already used for other user-supplied name fields elsewhere in the plugin (e.g. ticket contact names), and strips HTML entirely rather than allowing the small subset `sanitize_body()`/`wp_kses()` permits, since a system message never needs any markup. Added a one-line comment at the call site explaining why this field specifically needs sanitizing (WP doesn't sanitize `display_name` at the DB layer) since that's a non-obvious constraint. `$label` (the new status) was not touched — it's already constrained to `self::VALID_STATUSES`, no injection risk there.
**Verified (2026-07-05, PHP CLI):** bootstrapped the live local WP install, set a real admin user's `display_name` directly in the DB to `<img src=x onerror=alert(1)>Mallory` (simulating a value that bypassed wp-admin's own sanitization, since WP core doesn't enforce sanitization on this field), then called the real `STCRM_Admin_Controller::update_ticket()` REST handler against a real ticket. Stored system message came back as `"Status changed to resolved by Mallory."` — markup fully stripped.

**Verified (2026-07-05, Playwright, headless Chromium):** re-ran the same attack end-to-end through a real browser instead of a direct PHP call, on both surfaces that render `messages.body` via `dangerouslySetInnerHTML`:
- Generated real WP auth cookies (`wp_set_auth_cookie()`, captured via the `set_auth_cookie`/`set_logged_in_cookie` action hooks) for the admin account, and a real `stcrm_session` cookie for the ticket's contact — same techniques used in prior phases' verification passes.
- **Admin Thread page:** loaded `?page=stcrm-thread&id=1` with the malicious display_name live, PATCHed the ticket's status via the actual REST route (`X-WP-Nonce` from a real session), reloaded. `document.querySelector('#crm-thread').innerHTML` contains **no** `<img>` tag — confirmed via direct DOM inspection, not just eyeballing a screenshot.
- **Customer portal thread:** loaded `/new-support/?view=thread&ticket=1` with the session cookie — same clean result, no `<img>` in `#crm-portal`.
- **One red herring caught and ruled out:** a `window.__xss_fired` flag (set by the payload's `onerror`) did fire once, on the admin page — traced it to `#wp-admin-bar-my-account .display-name`, i.e. WordPress **core's own** "Howdy, {display_name}" admin-bar element, which does not escape `display_name` either. Confirmed via direct HTML inspection this is entirely separate from `#crm-thread` (which stayed clean) — it's a pre-existing WP-core behavior, not something this plugin introduced or can fix, and it's self-XSS only (a user can only corrupt their own toolbar when logged in as themselves, not another user's session) — not the cross-privilege escalation finding 7.1 was about.
- All test artifacts reverted/deleted afterward: `display_name` restored, ticket status restored to `closed`, the injected test system message deleted, and the 8 test session tokens accumulated across both verification passes deleted. Confirmed via a fresh query that ticket #1's message history is back to its original 3 legitimate system messages with no "Mallory" residue.
- Plugin commit `a833a4c` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `2ac3fe2` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.1 marked complete + docs-repo CLAUDE.md updated.

### 7.2 Missing index on `wp_stcrm_contacts.email`, hit on every authenticated request — HIGH (Performance) ✅ Complete (2026-07-05)

- [x] The table only has `UNIQUE KEY product_email (product_id, email)` — no standalone key on `email`. `STCRM_Database::get_contacts_by_email()` queries `WHERE email = %s` with no `product_id`, which on MySQL 5.7 (the plugin's stated minimum) can't use that composite index → full table scan. This runs inside `STCRM_Session_Auth::authenticate()`, the `permission_callback` for every portal REST call (list tickets, view ticket, post message, `/me`) — so every authenticated customer request does a full scan, unconditionally, even on single-product installs where no sibling contact could ever exist.
- Files: `includes/Database/class-stcrm-database.php` (`create_contacts_table()`, `get_contacts_by_email()`), `api/class-stcrm-session-auth.php` (`authenticate()`), `sublime-crm.php` (`STCRM_DB_VERSION`)

**Implementation notes (2026-07-05):**
- `includes/Database/class-stcrm-database.php`: added `KEY email (email)` to the `wp_stcrm_contacts` `CREATE TABLE` definition.
- `sublime-crm.php`: bumped `STCRM_DB_VERSION` from `1.0.1` → `1.0.2` — `STCRM_Database::install()`'s existing version guard re-runs `dbDelta()` on the next load, which adds the new index via `ALTER TABLE` with no separate migration script needed (dbDelta diffs the full `CREATE TABLE` string against the live schema).
- `api/class-stcrm-session-auth.php` (`authenticate()`): the Phase 6.6 sibling-contact lookup (`STCRM_Database::get_contacts_by_email()`) now only runs when `count( STCRM_Settings::get_settings()['products'] ) > 1`. On single-(or zero-)product installs, `$contact_ids` short-circuits to `[$contact->id]` — no sibling contact under a different product could ever exist there, so the extra query was pure overhead on every authenticated request for those installs.
- **Verified (2026-07-05):** bootstrapping the live local WP install (which auto-runs the active plugin's own load sequence) confirmed the migration is self-applying — `stcrm_db_version` advanced to `1.0.2` and `SHOW INDEX` confirmed the new `email` key exists, with zero manual migration steps. `EXPLAIN` on the `get_contacts_by_email()` query changed from a full table scan to `type: ref, key: email, rows: 1`. Functional regression + the new short-circuit were both tested directly against `STCRM_Session_Auth::authenticate()` using a real email with 2 sibling contacts across products (`qa-run-0625c@sublimecrm.test`, contacts #4 and #5, left over from Phase 6.6 testing): with the real 3-product Settings, `authenticate()` still returned both sibling IDs (`[5,4]`) — no regression; with Settings temporarily forced down to 1 product, it returned only the anchor's own ID (`[5]`), confirming the short-circuit engages correctly without needing the sibling query to prove it. Settings were restored to the real 3-product config immediately after. Also ran one real end-to-end HTTP round-trip (`curl` against the live `GET /stcrm/v1/tickets` route with a freshly issued session cookie) to confirm the full request chain still returns 200 with correct ticket data. All test session tokens created during verification were deleted afterward.
- Plugin commit `b924b8d` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `9035eaa` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.2 marked complete + docs-repo CLAUDE.md updated.

### 7.3 Synchronous Freemius API call blocks public ticket creation — HIGH (Performance) ✅ Complete (2026-07-05)

- [x] `POST /tickets` → `STCRM_Tier_Resolver::resolve()` → `verify_key_via_api()` does a `wp_remote_get()` with a 15s timeout directly in the request path when a license key is submitted and isn't cached. This contradicts the plugin's own documented rule ("Do not call Freemius API synchronously on the request path — queue via Action Scheduler"). A slow/down Freemius endpoint stalls ticket creation for up to 15s per request and ties up a PHP-FPM worker; the only throttle on this path is a 5/hour **per-IP** limit (no per-license-key limiter).
- Files: `includes/Services/class-stcrm-tier-resolver.php` (`resolve_via_license_key()`, `verify_key_via_api()`, `reverify_contact()`, `queue_reverify()`), `includes/class-sublime-crm.php` (`stcrm_reverify_contact` hook registration)

**A second, more severe bug found and fixed in the same function while working on this (not silently — surfaced to the user via AskUserQuestion before touching code):** `verify_key_via_api()` was still reading the old flat `$settings['freemius_api_token']` key, which Phase 6.1 deleted when Settings moved to the `products` list. Every other Phase-6-migrated consumer (webhook, tickets-controller, admin-controller, backfill, auth-controller) had been updated in 6.2–6.6; this one was missed — the exact same "grep for every consumer of a deprecated setting" lesson from 6.4/6.6/the Contacts-backfill-link bug, just not caught until now. Practical effect: since the migration ran, this method always returned `''` for the token, meaning **license-key verification at ticket creation has been silently broken since Phase 6.1** — every ticket submitted with a valid Pro license key was treated as unverified/free/low-priority with no error surfaced, no admin visibility, and no re-check queued (the code explicitly treats `stcrm_no_api_token` as "not a real error, don't retry"). User's call when asked: "of course fix it" — and clarified no separate migration script is needed for this, since the existing `maybe_migrate_products()` one-time migration already keeps `products` populated correctly; this function just needed to read the *new* format like everyone else, mirroring `STCRM_Backfill::find_product()`'s exact pattern.

**Implementation notes (2026-07-05):**
- New private `find_product_api_token( int $product_id ): string` — looks up the configured product's decrypted `api_token` from `STCRM_Settings::get_settings()['products']`, same lookup shape as `STCRM_Backfill::find_product()`. `verify_key_via_api()` now calls this instead of reading the deleted flat key.
- `resolve_via_license_key()`'s "not cached, no DB hash match" branch no longer calls `verify_key_via_api()` (or any HTTP call) at all. It now: checks `find_product_api_token()` is non-empty (preserves the original "don't flag/queue when no token is configured for this product" behavior, cheaply, with no network call) → `flag_verification_pending()` + `queue_reverify()` → returns `unverified_result()` immediately. The ticket is created right away as unverified/free/low-priority (same shape as the pre-existing "API unreachable" fallback); the contact record is upgraded moments later once the async job resolves, so the *contact's next* ticket/message resolves correctly via the DB-match paths (1)/(2) with no API call needed. This is an accepted trade-off explicitly named in this finding's original fix direction — a customer's very first ticket with a not-yet-cached key can no longer be verified synchronously at creation time in exchange for never blocking the request.
- `queue_reverify()` simplified to always `as_enqueue_async_action()` (runs on the next AS tick, not delayed) instead of `as_schedule_single_action(+1 hour)` — the delayed retry moved *into* `reverify_contact()` itself.
- `reverify_contact()` gained a `$retry` param (0 = first attempt, 1 = single retry) and now self-reschedules once, 1 hour later, on a genuine (non-`stcrm_no_api_token`) API failure — mirroring `STCRM_Mailer`'s existing single-retry AS handler pattern, and preserving the original "one retry after an unreachable failure, then give up" resilience that used to live in the (now-removed) synchronous call site.
- `includes/class-sublime-crm.php`: bumped the `stcrm_reverify_contact` hook's `accepted_args` from 4 to 5 for the new `$retry` param.
- Updated the file's top-of-file resolution-order docblock to describe the new async-first flow.

**Verified (2026-07-05):**
- **Token-lookup fix confirmed via `ReflectionMethod`:** Theme A (no token configured) → `''`; Theme B (token configured) → the real decrypted token string; an unconfigured product ID → `''`. Before this fix, all three would have returned `''` regardless, since the code read a settings key that no longer exists.
- **No-token product (Theme A) still skips flagging/queuing entirely** — 0.034s, 0 new AS jobs, no contact row created — matches original behavior exactly.
- **Token-configured product (Theme B), first-time key:** 0.009s (not ~15s), exactly 1 new AS job queued (`retry=0`, scheduled essentially immediately) — confirms the synchronous call is gone.
- **Manually executed the queued job** (simulating AS) with the real stored encrypted key against a fake/test token — the real Freemius API call correctly failed, and the job self-scheduled exactly one retry 1 hour later (`retry=1`, `scheduled_date_gmt` = original + 3600s) — confirms the moved retry logic works.
- **Live end-to-end HTTP check:** `POST /tickets` with a license key on a token-configured product → 201, `verified:false` (correct — first-time key, not yet resolved). Elapsed ~3.3s vs. a ~3.0s control request with no license key at all (same endpoint, same dev-box WP/REST bootstrap overhead) — confirms the license-key path itself now only adds ~300ms (the async-queue call), not the old worst-case 15s block.
- All test contacts, tickets, messages, and Action Scheduler jobs created during verification (including the two real REST-created test tickets and their queued confirmation/alert emails) were deleted afterward; confirmed via a fresh query that zero test artifacts remain.
- Plugin commit `e6347d2` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `350ac77` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.3 marked complete + docs-repo CLAUDE.md updated.
- Fix direction: apply the same async-first pattern already used for the "API unreachable" case (`verification_pending` + queued `stcrm_reverify_contact`) to first-time key verification too, instead of blocking the request.

### 7.4 Uncached 4th duplicate of the portal-URL lookup, on an unrate-limited path — MEDIUM (Performance / Duplication) ✅ Complete (2026-07-05)

- [x] Three classes (`STCRM_Mailer`, `STCRM_Launcher`, `STCRM_Tickets_Controller`) share the same `post_content LIKE '%...%'` portal-page lookup and all cache it behind the `stcrm_portal_page_id` transient. `STCRM_Auth_Controller::get_portal_url()` is a 4th copy of the same query but is missing the transient cache. It's called from `handle_redemption()` on `template_redirect`, which runs on every front-end hit whose `?t=` parameter merely shape-matches the token regex — no auth, no rate limit on that endpoint. A leading-wildcard `LIKE` can't use an index, so this is a full `wp_posts` scan triggerable by any bot/scanner probing random `?t=` values.
- Files: `api/class-stcrm-auth-controller.php` (`get_portal_url()`) — compare with `includes/Services/class-stcrm-mailer.php`, `includes/class-stcrm-launcher.php`, `api/class-stcrm-tickets-controller.php`

**Implementation notes (2026-07-05):** `STCRM_Auth_Controller::get_portal_url()` now checks the shared `stcrm_portal_page_id` transient first, exactly matching the other three classes' pattern (including `$wpdb->esc_like()`, which this copy hadn't been using — cosmetic-only since the search string is a hardcoded literal, but kept for consistency). No new cache-invalidation logic needed — `SublimeCRM::bust_portal_page_cache()` (hooked to `save_post`) already busts this same shared key for all four consumers.

**Verified (2026-07-05):** via `ReflectionMethod` against the live install, tracking `$wpdb->num_queries` before/after each call. Cold cache (transient deleted first): the lookup runs once, correctly resolves and caches the real portal page ID (`2371`). Warm cache (immediately after): **zero** DB queries — confirms the previously-uncached full `wp_posts` scan is gone. Cross-class check: calling `STCRM_Mailer::get_portal_url()` right after also cost zero queries and returned the same resolved URL, confirming the cache is genuinely shared across all four classes, not just internally consistent within this one. Cache-bust check: simulating a `save_post` action correctly cleared the transient, confirming the existing invalidation hook still covers this 4th consumer with no extra code.
- Plugin commit `da6966e` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `ceb0bee` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.4 marked complete + docs-repo CLAUDE.md updated.

### 7.5 Agent-alert emails have no debounce, unlike customer notifications — MEDIUM (Error Handling / Optimization) ✅ Complete (2026-07-05)

- [x] `STCRM_Mailer::queue_agent_alert()` unconditionally enqueues an AS job, with none of the pending-lock/debounce logic `queue_reply_notification()` got specifically to fix "3 rapid messages → 3 emails" (the documented "Phase 4 Debounce Fix"). `STCRM_Tickets_Controller::create_message()` (customer reply) calls `queue_agent_alert()` on every single customer message — so a customer sending rapid follow-ups generates one full email to the agent per message, the same bug class the debounce fix addressed, just on the other side of the conversation.
- Files: `includes/Services/class-stcrm-mailer.php` (`queue_agent_alert()`, `handle_agent_alert()`, `is_debounced()`, `set_debounce()`)

**Implementation notes (2026-07-05):** `queue_agent_alert()` now has the same two-stage pending-lock/debounce as `queue_reply_notification()`, under its own `stcrm_alert_pending_{ticket_id}` / `stcrm_alert_debounce_{ticket_id}` transient keys — deliberately separate from the customer-facing `stcrm_debounce_{ticket_id}` key, since a customer reply and an agent alert are two independent notification streams on the same ticket. Rather than duplicating `is_debounced()`/`set_debounce()` into a second near-identical pair of methods, both were generalized to take the transient key as a parameter instead of building it internally from a hardcoded prefix — `handle_reply_notification()`'s call sites were updated to pass `"stcrm_debounce_{$ticket_id}"` explicitly, and `handle_agent_alert()` now follows the identical release → check → send → arm sequence with its own key. Both streams reuse the existing `email_debounce_min` setting rather than adding a second admin-configurable window — no new UI needed for this.

**Verified (2026-07-05):** against a real isolated test ticket + contact. Three rapid `queue_agent_alert()` calls queued exactly 1 AS job (pending-lock). Running that job released the pending-lock and (since `wp_mail()` succeeded on this box) armed the debounce transient. A further `queue_agent_alert()` call while debounced was correctly suppressed (0 new jobs). Separately, arming the *other* (reply-notification) debounce for the same ticket did **not** block a subsequent `queue_agent_alert()` call — confirms the two streams are genuinely independent, not accidentally sharing state. All test data (ticket, contact, messages, AS jobs, transients) cleaned up afterward.
- Plugin commit `ed5231d` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `1e51307` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.5 marked complete + docs-repo CLAUDE.md updated.

### 7.6 `STCRM_Freemius_Sync`'s `$wpdb->update()` calls don't check return values — MEDIUM (Error Handling) ✅ Complete (2026-07-05)

- [x] Unlike `handle_install_event()` in the same file (which checks `upsert_contact()`'s return and logs failures) and unlike essentially every write path in the REST controllers, `handle_user_updated()`, the existing-contact branch of `handle_license_status_change()`, `handle_plan_changed()`, and `handle_license_expiry_changed()` all discard `$wpdb->update()`'s result. Runs unattended via Action Scheduler with zero user-facing feedback — a failure (e.g. `handle_user_updated()`'s email change colliding with another contact's `(product_id, email)` unique key) silently leaves Freemius data stale forever with no log line to find it by.
- Files: `includes/Services/class-stcrm-freemius-sync.php` (`handle_user_updated()`, `handle_license_status_change()`, `handle_plan_changed()`, `handle_license_expiry_changed()`)

**Implementation notes (2026-07-05):** All 4 methods now capture `$wpdb->update()`'s return into `$result` and check `false === $result` (strict — `0` rows-affected-but-no-error is a legitimate no-op, not a failure) before logging via the existing `log()` helper, mirroring `handle_install_event()`'s pattern exactly. Each log message names the contact ID and product ID so a real failure is actually traceable in `debug.log`, not just "something failed somewhere."

**Verified (2026-07-05):** engineered the exact scenario the finding calls out — two real contacts under the same product, then a `user.updated` webhook event trying to change one contact's email to the other's (a genuine `(product_id, email)` unique-key collision). Confirmed via `debug.log`: WordPress core logged the actual DB error (`Duplicate entry '123456-qa76-bob@sublimecrm.test' for key 'wp_stcrm_contacts.product_email'`), immediately followed by this fix's own line (`[SublimeCRM:error] Failed to update contact #20 for user.updated (product 123456) — possibly a duplicate (product_id, email) collision`) — proving the failure is no longer silent. Also confirmed the contact's email was correctly left unchanged (the update genuinely didn't apply) rather than silently succeeding. Separately drove real `license.expired`, `license.plan.changed`, and `license.extended` events through the other 3 fixed methods to confirm normal successful updates produce **zero** false-positive error log lines — only the one genuine failure appears in `debug.log`, nothing from the 3 successful paths. All test contacts cleaned up afterward.
- Plugin commit `c911207` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `b9ab2b9` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.6 marked complete + docs-repo CLAUDE.md updated.

### 7.7 Freemius license secret sent as a GET query param — MEDIUM (Security, informational) ✅ Closed — accepted risk, no code change to the transmission method (2026-07-05)

- [x] `STCRM_Tier_Resolver::verify_key_via_api()` puts the customer's raw license `secret_key` in the URL query string to Freemius's API. Full URLs (including query params) are commonly captured in proxy/APM/access logs on both ends. May simply be how Freemius's documented API works (not necessarily fixable plugin-side) — flagged so nobody enables verbose HTTP request logging on this box, and to confirm Freemius doesn't offer a header/body alternative.
- Files: `includes/Services/class-stcrm-tier-resolver.php` (`verify_key_via_api()`)

**Research (2026-07-05):** searched and fetched Freemius's own API documentation (`docs.freemius.com/api`, the licenses/list-licenses/activate-license pages) rather than guessing. Every license-key-related GET endpoint Freemius documents follows the same convention — the key travels as a URL query parameter (e.g. their own `GET .../license.json?license_key=...`, matching the `secret_key=...` param this plugin's call already uses). No POST-based license-lookup endpoint or header-based key-transmission alternative is documented anywhere. This is Freemius's own API design, not a choice this plugin made or can route around while still calling their real API.

**Why this is lower-risk in practice than it first looks:** this plugin never logs its own outbound request URLs (no `http_api_debug` hook exists anywhere in the codebase — confirmed by grep during the original Deep QA pass), so the realistic residual exposure is limited to (a) Freemius's own server-side access logs, entirely outside this plugin's control, and (b) a third-party HTTP-debugging tool (e.g. Query Monitor) an admin might separately install and configure to persist full request/response detail — not something this plugin's own code path creates.

**Resolution:** no code change to the transmission method — accepted as an unavoidable constraint of the third-party API, matching the finding's own fix direction ("confirm with Freemius docs whether an alternative exists; otherwise, document as an accepted risk"). Added a code comment at the `verify_key_via_api()` call site explaining this research conclusion, so a future maintainer doesn't mistake it for an unaddressed oversight and doesn't waste time re-investigating the same question.
- Plugin commit `41e9dab` ✅ pushed (2026-07-05) — code comment documenting the research conclusion + plugin CLAUDE.md bundled together.
- Docs commit `ce6bb68` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.7 marked closed (accepted risk) + docs-repo CLAUDE.md updated.

### 7.8 Admin ticket-list sort has no supporting index — LOW (Performance) ✅ Complete (2026-07-05)

- [x] `get_admin_tickets()`'s `ORDER BY t.verified DESC, priority_order DESC, ...` can't use an index (`verified` isn't indexed; `priority_order` is a computed `CASE`), forcing a filesort every Inbox load. Fine at expected scale (hundreds–low thousands of tickets); worth a composite index if a single install's ticket volume grows large.
- Files: `includes/Database/class-stcrm-database.php` (`create_tickets_table()`, `get_admin_tickets()`), `sublime-crm.php` (`STCRM_DB_VERSION`)

**Implementation notes (2026-07-05):** Two changes, not just an index — a computed `CASE` expression can never be satisfied by *any* index, so adding one alone wouldn't have helped.
1. Discovered `wp_stcrm_tickets.priority` is declared `enum('low','normal','high','critical')` — MySQL sorts ENUM columns by their *declared index position*, not alphabetically, and that declaration order already matches ascending severity. So `ORDER BY t.priority DESC` alone (critical→high→normal→low) produces the identical result to the old `CASE t.priority WHEN 'critical' THEN 4 ...` expression, with no computed column needed. Replaced the CASE + `priority_order` alias with a direct sort on `t.priority DESC`.
2. Added `KEY verified_priority_activity (verified, priority, last_activity_at)` to the tickets table (`STCRM_DB_VERSION` 1.0.2 → 1.0.3, self-applies via `dbDelta` on next load, same pattern as 7.2's index).
- `priority_order` was confirmed (via grep) to be consumed nowhere outside the query that defined it — safe to remove entirely, not just rename.

**Verified (2026-07-05):** confirmed the migration self-applied (`stcrm_db_version` → `1.0.3`, `SHOW INDEX` shows the new 3-column key). Regression check: ran the old CASE-based query and the new fixed method side-by-side against the real 12-ticket dataset (mixed priorities) — **identical row ordering** confirms the ENUM-sort simplification changes nothing customer/admin-visible. Query-plan check: `EXPLAIN` on the real table (12 rows) shows MySQL choosing a full scan + filesort — correct optimizer behavior at this tiny scale, not a sign the fix failed. Forced the new index via `FORCE INDEX` and re-ran `EXPLAIN`: `Extra` became `"Backward index scan; Using index"` with **no filesort at all**, proving the index structurally and fully satisfies the sort — MySQL will pick it up automatically once ticket volume grows enough for the optimizer's cost model to prefer it, with no further code change needed.
- Plugin commit `bf615e5` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `d8e55bf` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.8 marked complete + docs-repo CLAUDE.md updated.

### 7.9 `resolved_at` left stale after an agent replies to a resolved ticket — LOW (Error Handling / data hygiene) ✅ Complete (2026-07-05)

- [x] `STCRM_Admin_Controller::create_message()`'s reply branch sets `status → awaiting_customer` but never clears `resolved_at` — contrast with the customer-side reopen in `STCRM_Tickets_Controller::create_message()`, which explicitly nulls it. Harmless for the auto-close cron (which separately filters `status = 'resolved'`), but `format_ticket()` exposes `resolved_at` unconditionally, so the admin Thread UI can show a stale "resolved" timestamp on a ticket that's actually back in `awaiting_customer`.
- Files: `api/class-stcrm-admin-controller.php` (`create_message()`)

**Implementation notes (2026-07-05):** Added `'resolved_at' => null` to the same `update_ticket()` call that sets `status => 'awaiting_customer'` on a non-note reply — an exact mirror of the customer-side reopen logic in `STCRM_Tickets_Controller::create_message()`. Unconditional (not gated on "was the ticket previously resolved"), matching the customer-side pattern exactly — harmless no-op if `resolved_at` was already null, and also corrects any older stale value left over from an even earlier resolution round. `update_ticket()` already special-cases `null` values correctly (confirmed — this is the same pattern the customer-side reopen has used successfully since Phase 2.5), so no change was needed there.

**Verified (2026-07-05):** created a real isolated ticket in `resolved` status with a deliberately stale `resolved_at` (3 days old), then called the actual `STCRM_Admin_Controller::create_message()` REST handler with a normal agent reply. Confirmed via direct DB read: `status` → `awaiting_customer`, `resolved_at` → SQL `NULL` (not an empty string or zero-date). Confirmed the same fix is visible through the real `GET /admin/tickets/{id}` response (`format_ticket()`'s `resolved_at` field is `null`) — directly closing the stale-Thread-UI-timestamp complaint the finding describes. Regression checks: a second reply to the now-non-resolved ticket left `resolved_at` at `null` with no side effects; separately, an internal note against a freshly re-resolved ticket correctly left both `status` and `resolved_at` completely untouched (confirms the fix is scoped only to the non-note reply branch). All test data cleaned up afterward.
- Plugin commit `e7e9e67` ✅ pushed (2026-07-05) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `bae5d81` ✅ pushed (2026-07-05) — `phase-plan-clickup.md` 7.9 marked complete + docs-repo CLAUDE.md updated.

### 7.10 No server-side numeric validation on Settings "Product ID" field — LOW (Security, defense-in-depth) ✅ Complete (2026-07-05) — LAST PHASE 7 FINDING

- [x] `STCRM_Settings::build_products_from_post()` only runs `sanitize_text_field()` on `product_id`, despite the client-side `pattern="[0-9]+"` hint and every downstream consumer treating it as numeric. Admin-only, capability-gated, so not exploitable — just a silent-failure trap (a typo'd non-numeric ID quietly breaks that product's webhook/ticket flows with no validation error at save time).
- Files: `admin/class-stcrm-settings.php` (`build_products_from_post()`, `has_invalid_product_id()` new, `handle_save()`, `render_page()`)

**Implementation notes (2026-07-05):** Added `has_invalid_product_id( array $products ): bool` — mirrors `has_duplicate_secret()`'s exact shape, checking every row's `product_id` via `ctype_digit()`. Wired into `handle_save()`'s `freemius` case: checked *before* the duplicate-secret guard, redirecting with `error=invalid_product_id` (no partial save, matching the duplicate-secret pattern's all-or-nothing behavior) if any row fails. Added a matching admin notice in `render_page()` explaining the Product ID must be the numeric Freemius ID, not the product name (a plausible mistake this guards against).

**Verified (2026-07-05):** unit-tested `has_invalid_product_id()` directly via `ReflectionMethod` — all-numeric rows (false), one non-numeric row (true), empty array (false), a leading-zero string like `"007"` (false — still all digits), a decimal `"123.45"` (true), a negative `"-5"` (true). Live end-to-end via authenticated `curl` against the real `admin-post.php?action=stcrm_save_settings` route: submitting a non-numeric Product ID (`abc123`) for an existing product row correctly redirected to `...&error=invalid_product_id`, and a follow-up query confirmed the settings were **not** saved — all 3 original products (including their encrypted tokens/secrets) remained completely unchanged. Regression check: resubmitting the same 3 rows with their real numeric IDs succeeded normally (`...&saved=1`, no error param), with encrypted credentials correctly preserved via the existing "blank keeps existing" logic.
- Plugin commit `a9c0503` ✅ pushed (2026-07-06) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `d93a3ef` ✅ pushed (2026-07-06) — `phase-plan-clickup.md` 7.10 marked complete + "PHASE 7 COMPLETE" summary + docs-repo CLAUDE.md updated.

---

## PHASE 7 COMPLETE (2026-07-05)

All 10 Deep QA findings resolved: 9 fixed with code changes (7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 7.10), 1 closed as an accepted risk after research with no code change (7.7 — Freemius's own API leaves no alternative to the query-string secret_key). 7.3's fix also surfaced and fixed a live bug that predated this phase and wasn't one of the original 10 findings: license-key verification had been silently broken since Phase 6.1, because `verify_key_via_api()` was still reading a flat settings key that migration deleted — surfaced to the user via AskUserQuestion before being folded into the 7.3 fix, not silently bundled. Every finding was verified against the real local install — unit tests via `ReflectionMethod` where appropriate, live REST/HTTP round-trips via `curl`, direct DB reads, and one full Playwright browser pass for the stored-XSS finding — not just read through and assumed correct. All fixes and their docs were committed and pushed to both repos one finding at a time, per the user's explicit "fix one at a time" directive.

---

## PHASE 8 — Settings Gap Closure

> Two Settings-screen items were flagged "⚠️ deferred to Phase 2" back in Phase 1 (2026-06-23) and never picked up in any phase since — confirmed via code search that neither exists anywhere in the plugin as of 2026-07-06. Designed via brainstorming session (2026-07-06) since one item (Connection status) was never actually specced beyond that one-line placeholder, and Phase 6's multi-product Settings (added after the note was written) changes what it even means.

### 8.1 Default Priority Per Tier — ✅ Complete (2026-07-06)

- [x] Add `default_priority_pro => 'normal'` and `default_priority_free => 'low'` to `STCRM_Settings::$defaults` — matches current hardcoded behavior exactly, so existing installs see no change until an admin edits it.
- [x] Add two `<select>` fields (options: Low/Normal/High/Critical) to the Tickets & Guards tab, next to the existing guard matrix table.
- [x] `handle_save()`'s `'tickets'` case validates + saves both against the same `low|normal|high|critical` allow-list the `wp_stcrm_tickets.priority` ENUM uses.
- [x] `STCRM_Tier_Resolver::verified_result()` / `unverified_result()` read `STCRM_Settings::get_setting('default_priority_pro'|'default_priority_free')` instead of the hardcoded `'normal'`/`'low'` strings (currently lines 420 and 430 of `class-stcrm-tier-resolver.php`).
- Files: `admin/class-stcrm-settings.php` (`$defaults`, `render_page()` Tickets tab, `handle_save()`), `includes/Services/class-stcrm-tier-resolver.php` (`verified_result()`, `unverified_result()`)
- Spec: `design_handoff_support_crm/README.md` line 144 ("Default priority per tier (Free→Low, Pro→Normal)")

**Implementation notes (2026-07-06):** Reused the existing `STCRM_Admin_Controller::VALID_PRIORITIES` constant (`low`/`normal`/`high`/`critical`) for both the dropdown options and the save-time validation, instead of duplicating the enum list a third place. `handle_save()` falls back to the class default (not just a bare string) on an invalid/missing submitted value, matching the existing pattern elsewhere in the file. `STCRM_Settings::get_setting()` already had a default-fallback chain, so `STCRM_Tier_Resolver` needed only a one-line change per method.

**Verified (2026-07-06):** Confirmed via `ReflectionMethod` that `verified_result()`/`unverified_result()` return the *current* Settings values (not hardcoded) — with defaults untouched, output was still `normal`/`low` (zero regression for existing installs). Live end-to-end via authenticated `curl` against the real `admin-post.php?action=stcrm_save_settings` route: saved `default_priority_free=high`/`default_priority_pro=critical`, confirmed both persisted; then a real `POST /stcrm/v1/tickets` (unverified/free path, no license key) created ticket #24 with `priority = 'high'` in the DB — proving the full chain (Settings → Tier Resolver → Tickets Controller → DB) actually wires together, not just the isolated method. Restored `low`/`normal` afterward and deleted the test ticket/contact.
- **Incident during verification (self-caused, not a plugin bug):** an early test `curl` call used the wrong POST field name (`tab` instead of the real `stcrm_tab`) for the settings-save form. Because `handle_save()` defaults an unrecognized/missing tab to `'freemius'`, that malformed request was silently processed by the **Freemius tab's** save logic instead of the Tickets tab's — and since the POST body had no `stcrm_settings[products]` field at all, `build_products_from_post()` correctly treated that as "zero product rows submitted," saving `products => []` and wiping all 3 configured products (encrypted tokens/secrets included) from the live option. Caught immediately by checking `GET /stcrm/v1/products` returning `[]`; restored byte-for-byte from a full settings dump captured moments earlier in the same verification pass (same encrypted ciphertext, confirmed by successful `STCRM_Encryption::decrypt()` afterward) — no real credential loss, no admin ever saw a broken state. **Lesson: when driving a multi-tab settings form via raw `curl` instead of the real UI, always snapshot the full option value first, and double-check the actual hidden-field name in the rendered HTML (`stcrm_tab`, not the more guessable `tab`) before assuming a POST landed in the intended tab's `switch` branch — an admin using the real form can't hit this, since the tab template always emits the matching hidden field.**
- Plugin commit `bf072fd` ✅ pushed (2026-07-06) — code fix + plugin CLAUDE.md bundled together.
- Docs commit `34f94fc` ✅ pushed (2026-07-06) — this section + docs-repo CLAUDE.md.
- **Next: 8.2 (Connection Status, per product, live API ping) — only start when the user explicitly says go.**

### 8.2 Connection Status (per product, live API ping) — ✅ Complete (2026-07-06)

- [x] New AJAX handler `wp_ajax_stcrm_test_connection` — nonce + `stcrm_manage_tickets` capability check, reads `product_id` from `$_POST`, mirrors the existing `wp_ajax_stcrm_backfill_status` pattern.
- [x] Tests only the **API token**. The **secret key** is not testable this way — it's only used to verify inbound webhook HMAC signatures, no outbound call exercises it; UI copy makes this distinction clear so a green badge isn't misread as "everything is verified."
- [x] Result (`ok` or `error` + message) cached in transient `stcrm_conn_status_{product_id}` (1 hour) with a `checked_at` timestamp — same caching pattern as other per-key Freemius state in this plugin.
- [x] Settings → Freemius tab: each saved product row gets a "Test Connection" button + a badge — green "Connected" / red "Failed: {message}" / grey "Not tested yet" (reusing the Contacts page's existing license-badge dot/color CSS classes, no new CSS added) — rendered from any cached transient on page load (no auto-ping), refreshed only on click.
- [x] **In-place cleanup:** consolidated the duplicated "find this product's row in the settings list by ID" logic — previously separately implemented in `STCRM_Backfill::find_product()` and `STCRM_Tier_Resolver::find_product_api_token()` — into one `STCRM_Settings::find_product_by_id( int $product_id ): ?array` static helper, used by both existing call sites plus this new feature.
- Files: `admin/class-stcrm-settings.php` (`find_product_by_id()`, `get_connection_status()`, `ajax_test_connection()`, `ping_freemius()`, `render_connection_badge()`, Freemius tab row), `includes/class-sublime-crm.php` (`wp_ajax_stcrm_test_connection` hook registration), `admin/class-stcrm-admin.php` (`testConnectionNonce` + new i18n strings localized to `stcrmSettings`), `admin/js/stcrm-settings.js` (`initConnectionStatus()`, `testConnection()`, `renderConnectionBadge()`), `includes/Services/class-stcrm-backfill.php` (`find_product()` → delegates), `includes/Services/class-stcrm-tier-resolver.php` (`find_product_api_token()` → delegates)
- Error handling: same `WP_Error`/HTTP-code message shape already used elsewhere in the plugin — surfaced as-is, no custom friendly-message mapping.

**Implementation notes (2026-07-06):** Deviated from this section's original design-phase assumption of calling `licenses.json?count=1` — on reading the actual `verify_key_via_api()` code while implementing, that endpoint requires a specific customer's own license key as the `secret_key` query param (it's a per-license lookup, not a generic token health-check). Used `installs.json?count=1` instead — the exact same endpoint `STCRM_Backfill::fetch_installs()` already calls, which only needs the product's own API token, no customer identifier — a better fit for "does this credential authenticate at all." The connection check runs synchronously inside the AJAX handler (an explicit, occasional, admin-initiated click on the Settings page, not the public request path the plugin's "never call Freemius synchronously" rule is about).

**Verified (2026-07-06):** Live `curl` round-trips against the real `wp_ajax_stcrm_test_connection` endpoint (with a real session nonce scraped from the live rendered Settings page, not fabricated) against all 3 real product rows: a no-token product → clean `"No API token configured"` error with **zero** HTTP call attempted; a token-configured product → a real outbound Freemius call that correctly surfaced `"Freemius API returned HTTP 404"` (this dev box's test token isn't a real Freemius product, so a live failure was the correct and expected result — proves the call genuinely fires, not just returns canned success); an unconfigured `product_id` → 400 `"Unknown product."`. Confirmed all 3 results persisted correctly in their own per-product transient with real `checked_at` timestamps. Confirmed via a fresh page load that all 3 badges render correctly from cache: two red "Failed: ..." badges with "(N seconds ago)" and one grey "Not tested yet" for the never-tested third product — proving the full page-render path (not just the AJAX response) works. `php -l` + `node -c` clean on all touched files. All test session tokens cleaned up afterward; the two real "Failed" transients were left in place as accurate reflections of this dev box's non-production test credentials (not test pollution — genuine state a real admin would also see).
- Plugin commit `c19dc9c` ✅ pushed (2026-07-06) — code fix + plugin CLAUDE.md bundled together.
- Docs commit ✅ pushed (2026-07-06) — this section + docs-repo CLAUDE.md.
- **PHASE 8 (Settings Gap Closure) COMPLETE — both 8.1 and 8.2 built, verified, and documented one at a time.**

**Process:** build one item at a time (8.1 then 8.2), confirm before starting each — same cadence as Phase 7's findings.

---

## PHASE 9 — Debug Logger

> User request (2026-07-06): a centralized logger for debugging, covering "each action" in the plugin with structured context, timestamped in Asia/Kathmandu regardless of server/site timezone. Plus a new Settings "Advanced" tab housing a logging enable/disable toggle and the `delete_on_uninstall` checkbox (moved from Tickets & Guards). Designed via brainstorming session (2026-07-06) — key decisions below.

**Design decisions (confirmed via brainstorming, 2026-07-06):**
- **Storage:** plain-text file, not a DB table — `wp-content/uploads/sublime-crm-logs/{Y-m-d}.log`, one file per day (date in Kathmandu time). No in-app log viewer — read via FTP/hosting file manager, matching the user's explicit choice over a DB-table+viewer alternative.
- **Scope:** key state changes only, not every read/GET and not errors-only. See the 8.2/8.3 file list below.
- **Retention:** 30 days, purged by a new daily cron (`stcrm_purge_old_logs`), same registration pattern as the existing `stcrm_purge_expired_tokens`/`stcrm_auto_close_tickets` crons.
- **Default state:** logging **disabled** by default (opt-in) — log context may include contact emails/ticket subjects, so no install silently writes customer data to disk without an admin choosing to.
- **Security:** the log directory gets an `index.php` + `.htaccess` (`Deny from all`) on first write, same pattern most mature WP plugins use to keep a log directory out of direct browser access.
- **Timezone:** every log line's timestamp is built via `new DateTime('now', new DateTimeZone('Asia/Kathmandu'))` — explicitly Kathmandu, independent of the server's PHP timezone or WordPress's configured site timezone.

### 9.1 Logger Infrastructure — ✅ Complete (2026-07-06)

- [x] New `includes/Services/class-stcrm-logger.php` — `STCRM_Logger` static facade: `info( string $action, string $message, array $context = [] )`, `warning(...)`, `error(...)`.
- [x] Each method no-ops immediately (zero disk I/O) when `STCRM_Settings::get_setting('logging_enabled')` is falsy.
- [x] Line format: `[{Y-m-d H:i:s O, Asia/Kathmandu}] [{LEVEL}] {action} — {message}` + ` | context={json}` appended only when `$context` is non-empty.
- [x] File path `wp-content/uploads/sublime-crm-logs/{Y-m-d}.log` (Kathmandu date); creates the directory + protection files (`index.php`, `.htaccess`) on first write if missing.
- [x] New daily cron `stcrm_purge_old_logs`, scheduled on activation / unscheduled on deactivation (same pattern as `stcrm_purge_expired_tokens`), deletes any `.log` file in the directory older than 30 days.
- [x] Write failures (permissions, disk full) are swallowed silently — logging must never break the feature it's observing, matching the existing ad-hoc `log()` methods' behavior.
- Files: `includes/Services/class-stcrm-logger.php` (new), `includes/class-stcrm-activator.php` (schedule cron), `includes/class-stcrm-deactivator.php` (unschedule cron), `includes/class-sublime-crm.php` (require, register cron hook + `purge_old_logs()` callback), `admin/class-stcrm-settings.php` (`logging_enabled` added to `$defaults`, default `0`)

**Implementation notes (2026-07-06):** `purge_old_logs()` lives on `SublimeCRM` (not `STCRM_Logger` itself) purely for cron-wiring reasons — `STCRM_Loader::add_action()` requires an object+method pair, and `STCRM_Logger` is a pure static facade with no instance to hand it; `SublimeCRM::purge_old_logs()` is a one-line wrapper calling the real static `STCRM_Logger::purge_old_files()`, matching how the other two daily crons (`purge_expired_tokens()`, `auto_close_tickets()`) already live as `SublimeCRM` methods. `logging_enabled` was added to `STCRM_Settings::$defaults` now (default `0`) even though its Settings-tab checkbox doesn't exist until 9.2 — the logger needs the key to exist to check it; 9.2 only adds the UI to change it.

**Verified (2026-07-06):** Direct PHP calls confirmed: (1) with `logging_enabled` at its real default (`0`), calling all 3 log methods created **no** directory at all — genuinely zero disk I/O, not just an empty file; (2) with logging temporarily flipped on, all 3 levels wrote correctly to `sublime-crm-logs/2026-07-06.log` with real Kathmandu timestamps (`+0545` offset confirmed), context correctly JSON-encoded and omitted entirely on the context-less warning call; `index.php`/`.htaccess` created with the right contents; (3) retention: manually created a 40-day-old and a 5-day-old fake `.log` file, ran `purge_old_files()`, confirmed only the 40-day-old one was deleted; (4) cron wiring: `has_action('stcrm_purge_old_logs')` true, `do_action()` fires without a fatal, `STCRM_Activator::activate()` schedules it and `STCRM_Deactivator::deactivate()` unschedules it (re-activated afterward to restore the normal running state). `php -l` clean on all 5 touched files. All test log files/directory deleted afterward and `logging_enabled` reset back to `0`.
- Plugin commit `1b8d805` ✅ pushed (2026-07-06) — code fix + plugin CLAUDE.md bundled together.
- Docs commit ✅ pushed (2026-07-06) — this section + docs-repo CLAUDE.md.
- **Next: 9.2 (Settings "Advanced" Tab) — only start when the user explicitly says go.**

### 9.2 Settings "Advanced" Tab — ✅ Complete (2026-07-06)

- [x] Fourth Settings tab (Freemius / Email / Tickets & Guards / **Advanced**).
- [x] `logging_enabled` checkbox, default `0` (off) — description notes logs may include contact emails/ticket subjects.
- [x] `delete_on_uninstall` checkbox moved verbatim from Tickets & Guards (same key, same behavior, relocated only).
- [x] `handle_save()` gains an `'advanced'` case validating/saving both fields.
- Files: `admin/class-stcrm-settings.php` (`$defaults`, `render_page()` new tab markup + removal from Tickets & Guards, `handle_save()`)

**Implementation notes (2026-07-06):** `render_page()`'s tab conditional was a simple `if ('freemius') / elseif ('email') / else (tickets)` chain — adding a 4th tab required converting the bare `else` into an explicit `elseif ('tickets' === $active_tab)` before adding the new `else` (advanced) branch, since a plain `else` can't be followed by another arm. The `Uninstall` `<tr>` was moved (not duplicated) out of the Tickets & Guards table into the new Advanced table, and `delete_on_uninstall` was moved in `$defaults`' comment grouping and out of the `'tickets'` case in `handle_save()` into the new `'advanced'` case.

**Verified (2026-07-06):** Live `curl` fetch of both tabs confirmed "Uninstall" no longer appears anywhere on the Tickets & Guards tab (0 matches) and both "Debug Logging" + "Uninstall" render correctly on the new Advanced tab, with the nav bar showing all 4 tabs and "Advanced" correctly marked active. Live save round-trips: both fields ON → persisted as `1`/`1`; both fields OFF (unchecked, absent from POST) → persisted as `0`/`0`; a follow-up fetch confirmed the checkbox `checked` state matches exactly what was last saved. **Explicitly re-confirmed the product list (`products`, 3 real rows with encrypted credentials) stayed untouched across every one of these saves** — the exact class of mistake caught during 8.1's verification (wrong tab field name silently routing into the Freemius case) — this time using the correct `stcrm_tab=advanced` value throughout. Settings restored to their real safe defaults (`logging_enabled=0`, `delete_on_uninstall=0`) afterward; test session tokens cleaned up.
- Plugin commit `f4505c9` ✅ pushed (2026-07-06) — code fix + plugin CLAUDE.md bundled together.
- Docs commit ✅ pushed (2026-07-06) — this section + docs-repo CLAUDE.md.
- **Next: 9.3 (Instrument Call Sites) — only start when the user explicitly says go.**

### 9.3 Instrument Call Sites — ✅ Complete (2026-07-06)

- [x] Migrate the 3 existing ad-hoc `error_log()`/`log()` call sites to `STCRM_Logger` instead of running two logging mechanisms in parallel: `STCRM_Freemius_Sync::log()`, `STCRM_Mailer` (`insert_token` failure), `STCRM_Webhook` (signature-mismatch warning).
- [x] Add new log calls for state-changing actions only (no reads):

| Action | File / method |
|---|---|
| `ticket.created` | `STCRM_Tickets_Controller::create_ticket()` |
| `ticket.message_added` | `STCRM_Tickets_Controller::create_message()`, `STCRM_Admin_Controller::create_message()` |
| `ticket.status_changed` | `STCRM_Admin_Controller::update_ticket()` |
| `webhook.received` / `webhook.signature_result` | `STCRM_Webhook::handle_webhook()` |
| `webhook.event_processed` | `STCRM_Freemius_Sync::process_event()` + its 5 `handle_*()` methods |
| `magic_link.requested` | `STCRM_Auth_Controller::request_magic_link()` |
| `magic_link.redeemed` | `STCRM_Auth_Controller::handle_redemption()` |
| `tier.resolved` | `STCRM_Tier_Resolver::resolve()` |
| `email.queued` / `email.sent` / `email.failed` | `STCRM_Mailer`'s 5 `queue_*()` + 5 `handle_*()` methods |
| `backfill.page_processed` | `STCRM_Backfill::process_page()` |
| `settings.saved` | `STCRM_Settings::handle_save()` |
| `connection.tested` | `STCRM_Settings::ajax_test_connection()` |

- Files: all files listed in the table above.

**Implementation notes (2026-07-06):**
- `tier.resolved` is logged from a **single call site** in `resolve()` itself rather than duplicated across its 3 internal return paths (`verified_result()`, `resolve_via_license_key()`, `unverified_result()`) — `resolve()` was refactored from early-`return`s to an if/elseif/else assigning `$result`, logged once, then returned, since all 3 paths already funnel through the same `verified_result()`/`unverified_result()` shape.
- `email.sent`/`email.failed` are logged **once**, inside the shared private `send()` method that all 5 `handle_*()` AS handlers already call — avoids duplicating the same log call in 5 places. `email.queued` is logged individually in each of the 5 `queue_*()` methods since those are genuinely distinct entry points with different context (ticket_id vs. contact_id, etc.).
- The 3 migrated ad-hoc sites **dual-write**: the original `error_log()` (gated on `WP_DEBUG`) is left in place, with a new `STCRM_Logger` call added alongside it — not a replacement. `STCRM_Freemius_Sync::log()`'s private helper now fans out to `STCRM_Logger::info()/warning()/error()` via a `match()` on its existing `$level` string parameter.
- Anti-enumeration in `request_magic_link()` (always-200 response, no signal on match/no-match) is unaffected — the `magic_link.requested` log call only fires internally on the actual match path, writing to a local file the customer never sees, not to any HTTP response.

**Verified (2026-07-06):** Enabled logging temporarily and drove real traffic through nearly every action: created a real ticket (`ticket.created`, `tier.resolved`, 2× `email.queued`) → posted a real admin reply via the actual REST route (`ticket.message_added`, `email.queued`, `email.sent` ×2 as AS jobs ran) → PATCHed status to resolved (`ticket.status_changed`) → sent a real HMAC-signed webhook request using one configured product's real secret key (`webhook.received`, `webhook.signature_result`, `webhook.event_processed`) → ran a real connection test (`connection.tested`) → saved the real Settings Advanced tab (`settings.saved`) → requested a real magic link for the test contact (`magic_link.requested`, `email.queued`). Read the actual day's log file after each step and confirmed every line appeared with the correct action tag, message, Kathmandu timestamp, and JSON context. `php -l` clean on all 9 touched files.
- **Incident during verification (test-data hygiene, not a code bug):** found `default_priority_free`/`default_priority_pro` had drifted to stale values (`normal`/`high`) left over from earlier cross-phase test traffic this session rather than their correct `low`/`normal` defaults — confirmed by re-reading the actual `$defaults` array (still correctly `low`/`normal`) and re-checking that neither 9.2's nor 9.3's own diffs touch these two keys anywhere. Restored to the correct values; root cause is confined to this session's own test POSTs across 8.1/9.1/9.2, not a defect in any committed code.
- All test artifacts (ticket, contact, tokens, log files/directory, admin session tokens) fully deleted afterward; confirmed via direct DB queries that zero rows remain.
- Plugin commit `5447d73` ✅ pushed (2026-07-06) — code fix + plugin CLAUDE.md bundled together.
- Docs commit ✅ pushed (2026-07-06) — this section + docs-repo CLAUDE.md.
- **PHASE 9 (Debug Logger) COMPLETE — all 3 sub-items (9.1, 9.2, 9.3) built, verified, and documented one at a time.**

**Process:** build one item at a time (9.1 → 9.2 → 9.3), confirm before starting each — same cadence as Phase 7/8.

---

## PHASE 10 — Dynamic Inbox Sort

> User request (2026-07-07): the Inbox's "Sort: Smart" label is static text, not a functional control — surfaced while reviewing why priority badges seemed inconsistent across tickets. Only one sort order has ever existed (`verified DESC, priority DESC, last_activity_at DESC`), matching this doc's own 5.9 note that no alternate sort was ever specced. Designed via brainstorming session (2026-07-07) — key decisions below.

**Design decisions (confirmed via brainstorming, 2026-07-07):**
- **Sort options (4 total):**
  - **Smart** (default, unchanged) — `verified DESC, priority DESC, last_activity_at DESC`
  - **Priority** (new) — `priority DESC, last_activity_at DESC`, deliberately ignoring verified/tier entirely — a pure urgency-triage view, distinct from Smart's tier-aware ordering
  - **Newest first** (new) — `last_activity_at DESC`
  - **Oldest first** (new) — `last_activity_at ASC`
- **UI:** the static `Sort: Smart` text in `TicketListHeader` (`src/admin/inbox.jsx`) becomes a real `<select>` in the same spot. Unlike the Status/Priority/Tier/Assignee/Product filters (PHP-rendered `<select>`s bridged into the React island via DOM `change` listeners, since they sit in the PHP-rendered toolbar above the mount point), this control lives entirely inside the React-rendered area — so it's implemented as ordinary React state (`sortBy`), no PHP template change needed.
- **Persistence:** chosen sort is written to `localStorage` (`stcrm_inbox_sort`) on change and read back as the initial state on mount (falling back to `'smart'` if unset/invalid) — unlike the filters, which are session-only today, sort is treated as a sticky workflow preference per the user's explicit choice.
- **Data flow:** `sortBy` joins the existing `filters` object already serialized into the `GET /stcrm/v1/admin/tickets` query string on every filter change — reuses the exact re-fetch mechanism filters already use, just one more query param (`sort=smart|priority|newest|oldest`).
- **Backend:** `STCRM_Admin_Controller::register_routes()` adds a `sort` arg to `/admin/tickets` with `'enum' => ['smart','priority','newest','oldest'], 'default' => 'smart'` (same validation pattern already used for `tier`). `get_tickets()` reads + passes it through as a new 5th parameter to `STCRM_Database::get_admin_tickets()` — kept separate from the `$filters` array since it's an `ORDER BY` concern, not a `WHERE` concern. `get_admin_tickets()` picks the `ORDER BY` clause via a whitelisted `switch` on the 4 known values (never interpolates the raw request value into SQL, even though it's already enum-validated upstream).

- [x] Add `sort` route arg (enum: smart/priority/newest/oldest, default smart) to `GET /admin/tickets` in `STCRM_Admin_Controller::register_routes()`
- [x] `get_tickets()` reads + whitelists `sort`, passes as new `$sort` param to `get_admin_tickets()`
- [x] `STCRM_Database::get_admin_tickets()` gains a `string $sort = 'smart'` parameter; `ORDER BY` selected via whitelisted switch over the 4 options
- [x] `TicketListHeader` (`src/admin/inbox.jsx`): replace static "Sort: Smart" text with a controlled `<select>` (Smart/Priority/Newest first/Oldest first)
- [x] `Inbox` component: add `sortBy` state, read initial value from `localStorage('stcrm_inbox_sort')` (fallback `'smart'`), write on change, include in the `filters`-driven fetch's query params
- Files: `api/class-stcrm-admin-controller.php`, `includes/Database/class-stcrm-database.php`, `src/admin/inbox.jsx`, `admin/css/stcrm-admin.css`

**Implementation notes (2026-07-07):** `TicketList` had an early-return-while-loading branch that unmounted its whole subtree (including `TicketListHeader`) on every fetch — left as-is, the sort `<select>` itself would've vanished and remounted on every single sort change, which is broken UX for a dropdown the user just clicked. Restructured so `TicketListHeader` (and its `<select>`) always renders; only the rows-vs-empty-vs-loading body switches. New `STCRM_Admin_Controller::VALID_SORTS` constant mirrors the existing `VALID_STATUSES`/`VALID_PRIORITIES` pattern — used both as the route arg's `enum` (self-documenting only, per this codebase's existing convention that WP's REST arg schema isn't auto-enforced without an explicit `validate_callback`) and as the real manual whitelist check in `get_tickets()`. `get_admin_tickets()`'s new `$order_by` lookup array only ever contains 4 hardcoded literal strings — the `$sort` parameter selects among them via array key lookup, never concatenated into the SQL itself, so there's no injection surface even before the REST-layer validation. CSS: `.stcrm-list-pane__sort` (previously just font-size/color on a `<span>`) gained `background:transparent; border:none; box-shadow:none; cursor:pointer` so the native `<select>` keeps the original minimal "plain text with a caret" look rather than picking up default browser select chrome.

**Verified (2026-07-07):**
- Backend, isolated: a PHP CLI script bootstrapping WordPress and calling `STCRM_Database::get_admin_tickets(null, [], 1, 20, $sort)` directly for all 4 values against the real 12-ticket dataset — confirmed each produces a distinct, correctly-ordered id sequence (`newest`/`oldest` exact mirror images of each other; `priority` groups high→normal→low correctly; `smart` and `priority` happen to match on this dataset only because no ticket here has `verified=1`, which is expected, not a bug).
- Backend, REST layer: a second PHP CLI script instantiating `STCRM_Admin_Controller` directly and calling `get_tickets()` with a real `WP_REST_Request`, including a deliberately invalid `sort=bogus` value — confirmed it silently falls back to the same order as `sort=smart` (proving the manual whitelist guard works), while the 3 real values each matched the isolated DB-method test above exactly.
- Frontend, full browser round trip via a one-off Playwright script (logged in as a real admin user, navigated to the real Inbox page): switched the dropdown through Newest → Oldest → Priority and read the actual rendered ticket-ID order after each change (via `page.waitForResponse` on the real `sort=` query param, not a fixed timeout — an earlier version of the test script raced ahead of the real network round trip and produced false negatives, since nothing in the app itself serializes/cancels in-flight fetches when the sort changes rapidly) — every order exactly matched the backend-only verification above. Reloaded the page afterward and confirmed both the `<select>`'s value and the ticket order came back as `Priority` (the last selection), proving the `localStorage` persistence round-trips correctly, not just writes. Screenshot confirmed the dropdown renders inline as "Sort: Priority" matching the design intent, and incidentally reconfirmed the earlier Normal-priority-badge fix is still working (ticket #1 shows a "Normal" badge in this same screenshot).
- `php -l` clean on both backend files; `npm run build` recompiled `stcrm-inbox.js` successfully; grepped the compiled bundle to confirm `stcrm_inbox_sort` (the localStorage key) and all 3 new option labels are present.
- All test scripts/screenshots were one-off files in the session scratchpad, not part of either repo — nothing to clean up in-repo.

**PHASE 10 (Dynamic Inbox Sort) COMPLETE — built and verified as one cohesive unit.**

**Process:** single cohesive change, built and verified as one unit (not split into sub-items like Phase 8/9, since the pieces aren't independently useful on their own).

---

## PHASE 11 — Inbox Pagination

> User request (2026-07-07): only 12 tickets exist on this local site today, but a real install could easily reach hundreds — the Inbox needs pagination before that happens. `get_admin_tickets()` already accepts `page`/`per_page` (LIMIT/OFFSET, default 20, capped at 100) but nothing in the REST response ever told the frontend how many total tickets/pages exist, and `inbox.jsx` has zero pagination UI today — every request always implicitly asked for page 1. Designed via brainstorming session (2026-07-07) — key decisions below.

**Design decisions (confirmed via brainstorming, 2026-07-07):**
- **UI style:** numbered pages + total count — "Page X of Y" with Prev/Next buttons and the total ticket count, at the bottom of the ticket list. User explicitly chose this over a cheaper Prev/Next-only heuristic (no count query) and over infinite scroll/load-more, since predictable page-jumping matters more for triage work than avoiding one extra COUNT query.
- **Page size:** stays at the existing backend default of 20 — no change to `per_page`, just wiring the frontend to consume it.
- **Correctness requirement (explicit user emphasis):** pagination must work correctly with every existing filter (status/priority/tier/assignee/product/search) and with the Phase 10 sort options — not just on the unfiltered "all tickets" view. The count query must never drift out of sync with whatever filters are currently applied, since a wrong total/page-count would be worse than no pagination at all.
- **Backend:** the WHERE-clause-building logic already inside `STCRM_Database::get_admin_tickets()` gets extracted into a shared private helper (e.g. `build_admin_tickets_where( ?int $product_id, array $filters ): array`, returning `[$where_sql, $args]`), reused by both the existing list query and a new `STCRM_Database::count_admin_tickets( ?int $product_id, array $filters ): int` — this is what guarantees the count can never disagree with the list, since they're built from the exact same code path rather than two hand-maintained copies of the same 5-filter logic. `STCRM_Admin_Controller::get_tickets()` calls the new count method and returns the total via the standard WordPress REST collection convention — `X-WP-Total` / `X-WP-TotalPages` response headers — keeping the response body a bare array, unchanged, per this plugin's already-documented "no wrapper" convention (`STCRM_Rest_Helper::success()`).
- **Frontend:** new `page` state in the `Inbox` component, reset to `1` whenever `filters` or `sortBy` change (a stale page number from a wider view wouldn't make sense once a filter narrows the result set — e.g. being on page 4 of "All tickets" and then filtering to "Critical" should not silently show an empty page 4 of a 1-page result). Fetch switches from plain `apiFetch({ path })` to `apiFetch({ path, parse: false })` to get the raw `Response` object (needed to read the headers), then manually parses the JSON body — reads `X-WP-Total`/`X-WP-TotalPages` into new `total`/`totalPages` state. New pagination bar under `.stcrm-list-pane__rows`: Prev/Next buttons (Prev disabled on page 1, Next disabled on the last page) + "Page X of Y" + total count; the whole bar hides when `totalPages <= 1`.

- [x] Extract `build_admin_tickets_where()` shared helper in `STCRM_Database`; refactor `get_admin_tickets()` to use it
- [x] New `STCRM_Database::count_admin_tickets( ?int $product_id, array $filters ): int` using the same shared helper
- [x] `STCRM_Admin_Controller::get_tickets()` calls `count_admin_tickets()`, sets `X-WP-Total` / `X-WP-TotalPages` headers on the response
- [x] `Inbox` component (`src/admin/inbox.jsx`): add `page`/`total`/`totalPages` state; reset `page` to 1 on `filters`/`sortBy` change; switch fetch to `parse: false` + manual header read
- [x] New pagination bar component under the ticket list — Prev/Next + "Page X of Y" + total count, hidden when `totalPages <= 1`
- Files: `includes/Database/class-stcrm-database.php`, `api/class-stcrm-admin-controller.php`, `src/admin/inbox.jsx`, `admin/css/stcrm-admin.css`

**Implementation notes (2026-07-07):** `build_admin_tickets_where()` is the load-bearing piece — both `get_admin_tickets()` and `count_admin_tickets()` call it and get back the identical `[$where_sql, $args]` pair, so there is structurally no way for the two queries' filters to disagree (the risk the user explicitly called out). `count_admin_tickets()` reuses the same `t`/`c` JOIN as the list query (needed since the `search` filter matches against `c.email`) rather than a bare `COUNT(*) FROM tickets`, which would silently miscount if a ticket's contact row were ever missing. Total/page-count exposed via the standard `X-WP-Total`/`X-WP-TotalPages` WP REST collection headers — deliberately not a body-shape change, matching this plugin's existing "no wrapper" response convention (`STCRM_Rest_Helper::success()`). Frontend: `page` resets to `1` by calling `setPage(1)` directly inside the same handlers that call `setFilters`/`setSortBy` (not via a separate `useEffect` watching `[filters, sortBy]`) — a separate reset-effect would still fire the fetch effect once with the *stale* page number in the same render pass (since both effects run against the values captured at that render), causing one wasted request and a flash of a wrong/empty page before self-correcting on the next render. Fetch switched from plain `apiFetch({path})` to `apiFetch({path, parse:false})` to get the raw `Response` (needed for header access), then manually calls `.json()` for the body — the body shape itself is completely unchanged. The Inbox header's ticket count now shows the real `total` from the response headers instead of `tickets.length` (the current page's row count), since showing "27 tickets" while only 7 rows are visible on page 2 would otherwise look like a bug.

**Verified (2026-07-07):**
- Backend correctness against every scenario the user asked to guarantee: a PHP CLI script paginated all the way through `get_admin_tickets()` (per_page as low as 1, to force many pages) for 8 different cases — no filters, single filters (`status`, `priority`, `assignee=unassigned`), `search` (both a matching term and a deliberately non-matching one), and a combined `status`+`search` filter — and compared the total *unique* ticket IDs collected across every page against `count_admin_tickets()`'s direct answer for the same filters. All 8 cases matched exactly, with zero duplicate or missing IDs across page boundaries.
- REST layer: a second PHP CLI script called the real `STCRM_Admin_Controller::get_tickets()` across 3 pages of a 12-ticket set (per_page=5) plus a `status=closed` filter and a zero-result `search` — confirmed `X-WP-Total`/`X-WP-TotalPages` were correct in every case, including the `0`/`0` zero-result case.
- Full browser round trip via Playwright: temporarily inserted 15 disposable test tickets (`PAGINATION-TEST-01`…`15`, tagged with a distinctive subject prefix) to push the real total past the 20-per-page boundary (27 tickets → 2 real pages), then, against the live Inbox: confirmed the header showed "27 tickets"; confirmed page 1 showed 20 rows and page 2 showed the remaining 7 with zero overlap between the two (combined unique count = 27, matching the total exactly); confirmed Prev is disabled on page 1 and Next is disabled on page 2 (the last page); confirmed applying a narrowing filter (`search=Phase 2 acceptance`, 4 real matching results) while sitting on page 2 correctly reset to page 1 **and** hid the pagination bar entirely (since 4 results fit on one page) — the exact filter-interaction correctness the user asked to keep in mind. All 15 disposable test tickets deleted immediately afterward via a tagged `DELETE ... WHERE subject LIKE 'PAGINATION-TEST-%'`, confirmed the real ticket count returned to its prior value.
- **Incidental finding, not a Phase 11 bug:** the live table has 2 pre-existing orphaned tickets (ids 23, 25) whose `contact_id` no longer matches any row in `wp_stcrm_contacts` — leftover, uncleaned test data from an earlier session, not created by this phase's work and not touched by it. They're silently excluded from every Inbox view by the existing `INNER JOIN` (same behavior before and after this phase), so they're invisible in the admin UI but do inflate a raw `SELECT COUNT(*) FROM wp_stcrm_tickets` if anyone runs that query directly — flagged here for awareness, not fixed, since cleaning up unrelated historical test data is out of this phase's scope.
- `php -l` clean on both backend files; `npm run build` recompiled `stcrm-inbox.js` successfully.

**PHASE 11 (Inbox Pagination) COMPLETE — built and verified as one cohesive unit.**

**Process:** single cohesive change, built and verified as one unit, same cadence as Phase 10 — correctness against every filter combination (status/priority/tier/assignee/product/search) and every Phase 10 sort option is the explicit acceptance bar, not just the unfiltered default view.

---

## Summary

| Phase | Weeks | Task groups | Approx tasks |
|---|---|---|---|
| 1 — Foundation | 1–2 | 8 groups | ~35 tasks |
| 2 — Tickets Core | 3–5 | 10 groups | ~45 tasks |
| 3 — Touchpoints | 6–8 | 11 groups | ~40 tasks |
| 4 — Notifications & Hardening | 9–10 | 10 groups | ~35 tasks |
| 5 — Design-Handoff Gap Closure | — | 11 groups | ~35 tasks |
| 6 — Multi-Product Freemius Support | — | 5 groups (designed, not started) | ~25 tasks |
| 7 — Deep QA Findings | — | 10 findings — ✅ ALL COMPLETE (2026-07-05) | 10 tasks |
| 8 — Settings Gap Closure | — | 2 items — ✅ ALL COMPLETE (2026-07-06) | 2 tasks |
| 9 — Debug Logger | — | 3 items — ✅ ALL COMPLETE (2026-07-06) | 3 tasks |
| 10 — Dynamic Inbox Sort | — | 1 group — ✅ COMPLETE (2026-07-07) | 5 tasks |
| 11 — Inbox Pagination | — | 1 group — ✅ COMPLETE (2026-07-07) | 5 tasks |
| **Total** | **10 weeks + gap closure** | **60 groups** | **~230 tasks** |

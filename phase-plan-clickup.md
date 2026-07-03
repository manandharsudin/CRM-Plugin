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

### 3.4 Portal View: New Ticket Form ✅ Complete (2026-06-25, plugin commit TBD)

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

### 3.5 Portal View: Cap Reached (409) ✅ Complete (2026-06-25, plugin commit TBD)

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

### 5.2 Capability Assignment UI (known gap — README item 2)

- [ ] Add a control (Settings → Tickets & Guards tab) to assign `stcrm_manage_tickets` to roles beyond Administrator (e.g. checkboxes per role, or a multi-select)
- [ ] On save: `WP_Role::add_cap('stcrm_manage_tickets')` for checked roles, `remove_cap()` for unchecked — Administrator should stay locked/always-on since Phase 1 grants it on activation
- [ ] `includes/class-stcrm-activator.php` currently only grants the cap once at activation — this UI is the first way to change it afterward
- Files: `admin/class-stcrm-settings.php`, `includes/class-stcrm-activator.php`

---

### 5.3 Launcher Docs-Deflection Link (known gap — README item 4)

- [ ] Add a "Check our docs first" link/card to the launcher panel's no-session view (portal's New Ticket sidebar already has this card; launcher doesn't)
- [ ] Needs a docs URL source — add a `docs_url` setting (Email tab or new field) or confirm an existing constant/option to reuse
- Files: `src/launcher/Launcher.jsx`, `admin/class-stcrm-settings.php` (if new setting needed)

---

### 5.4 Admin Assignee Controls (highest impact — no UI exists at all today)

- [ ] Thread → Manage panel: add an Assignee `<select>` populated with users who hold `stcrm_manage_tickets`, wired to the existing `PATCH /admin/tickets/{id}` `assigned_to` field (backend already supports this — `null` = unassign)
- [ ] Inbox filter toolbar: render the Assignee `<select>` (All/Me/Unassigned) in PHP — `src/admin/inbox.jsx` already has a listener wired to `#stcrm-filter-assignee`, it's dead code today because the element is never rendered
- [ ] Confirm `GET /admin/tickets?assignee=` REST param still works end-to-end once the UI sends it
- Files: `src/admin/thread.jsx` (ManagePanel), `admin/class-stcrm-admin.php` (render_inbox_page), `src/admin/inbox.jsx`

---

### 5.5 Inbox Search Box

- [ ] Add search input to Inbox filter toolbar: "Search subject or email…"
- [ ] Wire JS to include a `search` param on fetch/filter-change
- [ ] Add `search` param to `GET /admin/tickets` REST args in the admin controller
- [ ] Add `LIKE` search over ticket subject + contact email to `STCRM_Database::get_admin_tickets()` WHERE clause (currently only status/priority/tier/assignee are filterable)
- Files: `admin/class-stcrm-admin.php`, `src/admin/inbox.jsx`, `api/class-stcrm-admin-controller.php`, `includes/Database/class-stcrm-database.php` (or wherever `get_admin_tickets()` lives)

---

### 5.6 Freemius Webhook Event Coverage

- [ ] Add handler for `license.created` / `payment.created` (new pro purchase not accompanied by an `install.*` event)
- [ ] Add handler for `license.plan.changed`
- [ ] Add handlers for `license.extended` / `license.shortened`
- [ ] Add handler for `license.deleted` if applicable to this product's Freemius config
- [ ] Verify against real/sandbox Freemius events before go-live — it's possible `install.*` events already cover some of these in practice for this vendor's specific product setup; confirm rather than assume
- Files: `includes/Services/class-stcrm-freemius-sync.php` (`process_event()`)

---

### 5.7 Thread Sidebar — Customer Panel Completeness

- [ ] Add a distinct "License active" badge (separate from the Tier badge) per README spec
- [ ] Render `license_expires` ("Expires") — already returned by the admin ticket API, just not read by the component
- [ ] Render `created_at` ("Customer since") — same, already available, not rendered
- [ ] Add footer note "Synced from Freemius · read-only"
- [ ] Masked license key (`sk_live_••••a31f`) — **not implementable as spec'd**: only `license_key_hash` (SHA-256) is stored, not a reversible/maskable raw key. Skip, or replace with a "License key on file" boolean indicator instead
- Files: `src/admin/thread.jsx` (CustomerPanel)

---

### 5.8 Thread Header Completeness

- [ ] Add category badge to the Thread header (currently only Tier/Status/Priority render)
- [ ] Add "Assigned to you" indicator to the Thread header — depends on 5.4 landing first (assignee data needs to be in the component's ticket state)
- Files: `src/admin/thread.jsx`

---

### 5.9 Inbox List Pane Header Row

- [ ] Add the missing header row above the ticket list: "N tickets" (count) + "Sort: Smart" label
- Files: `src/admin/inbox.jsx` (TicketList)

---

### 5.10 `POST /tickets` Response — `thread_url` Field

- [ ] Replace the hardcoded `null` (still has a `// Phase 3: populate once portal page URL is known.` placeholder comment) with a real resolved portal/thread URL
- [ ] Reuse the existing portal-URL resolution logic already used elsewhere (`STCRM_Auth_Controller::get_portal_url()` / `STCRM_Mailer::get_portal_url()` — both query `post_content LIKE '%wp:sublime-crm/support-portal%'`)
- Files: `api/class-stcrm-tickets-controller.php` (line ~281)

---

### 5.11 Contact Detail — "Lifetime Value" Field (low priority / spec-only)

- [ ] Decide whether to build this: `wp_stcrm_contacts` has no backing column and `support-crm-spec.md` §3.1 never defines this field either — it appears to be a README-only concept with no data source anywhere in the spec
- [ ] If proceeding: define what "lifetime value" means (sum of Freemius payments? needs a new Freemius API call or webhook-driven running total), add storage + a way to populate it, then render on Contact Detail profile card
- [ ] If not proceeding: mark as intentionally out of scope and note it in this doc so it isn't rediscovered as a "gap" later
- Files: TBD pending the scope decision above

---

### Notes — judgment calls surfaced by the audit (not counted in the 11 gaps, no action required unless decided otherwise)

- **Launcher's compact no-session form has no honeypot field** (portal's `NewTicketView` does). Spec §10 says "honeypot on widget/portal forms" — ambiguous whether "widget" means this launcher or a separate out-of-scope widget. Backend rate limiting still applies regardless of this gap.
- **Default ticket categories** use full names (`Technical Support, Billing, …`) vs. the spec's literal lowercase example (`technical, billing, …`) — internally consistent throughout (Settings/validation/portal all agree), purely cosmetic vs. the spec text.

---

### Phase 5 Acceptance

- [ ] All 11 confirmed gaps above resolved or explicitly marked out-of-scope with reasoning (5.11)
- [ ] Backfill progress visible and accurate during a real/sandbox run — ⚠️ pending real Freemius credentials (code complete; verified 2026-07-03 with a simulated running state via Playwright — see 5.1 implementation notes)
- [ ] A non-Administrator role can be granted `stcrm_manage_tickets` and use the Inbox/Thread/Contacts pages
- [ ] Agent can assign and reassign tickets from both Inbox filter and Thread Manage panel
- [ ] Inbox search returns correct results by subject and by contact email
- [ ] Freemius sandbox events for all newly-handled event types correctly update contact tier/plan/expiry
- [ ] `POST /tickets` response `thread_url` resolves to a working link

---

## Summary

| Phase | Weeks | Task groups | Approx tasks |
|---|---|---|---|
| 1 — Foundation | 1–2 | 8 groups | ~35 tasks |
| 2 — Tickets Core | 3–5 | 10 groups | ~45 tasks |
| 3 — Touchpoints | 6–8 | 11 groups | ~40 tasks |
| 4 — Notifications & Hardening | 9–10 | 10 groups | ~35 tasks |
| 5 — Design-Handoff Gap Closure | — | 11 groups | ~35 tasks |
| **Total** | **10 weeks + gap closure** | **50 groups** | **~190 tasks** |

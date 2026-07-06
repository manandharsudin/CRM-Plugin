# SublimeCRM — Project Knowledge Base

> Complete reference for Claude Code. Read this before touching any file in this folder.
> Last updated: 2026-07-06 (**Phase 8 COMPLETE — both Settings gaps closed.** 8.2 (Connection Status): Settings → Freemius tab now has a per-product "Test Connection" button + cached badge, live-pinging Freemius's `installs.json` with the stored API token only (secret key isn't testable this way — webhook-signature-only); verified against a no-token product, a token-configured product (real outbound call, real HTTP-404 surfaced), and an unconfigured product. Also consolidated the "find product by ID" lookup duplicated in `STCRM_Backfill`/`STCRM_Tier_Resolver` into one `STCRM_Settings::find_product_by_id()`. 8.1 (Default Priority Per Tier, done earlier the same day): `STCRM_Tier_Resolver`'s hardcoded `normal`/`low` priority defaults are now two admin-configurable Settings fields; verified via a live Settings-save → real-ticket-creation round trip (ticket #24, cleaned up). Full spec + verification notes in `phase-plan-clickup.md` Phase 8. See §17. Also: doc cleanup — 7 of Phase 7's findings still showed stale "commit pending" placeholders despite being pushed weeks ago; corrected with real commit hashes. The long-deferred "Scheduled Actions menu missing from WP Tools" note (Phase 1) is also resolved — root cause was WPForms hiding the shared Action Scheduler admin page site-wide, not a SublimeCRM bug; fixed via a `wp-config.php` constant, no plugin code involved. Phase 7 COMPLETE (2026-07-05) — all 10 Deep QA findings resolved: 9 fixed with code changes, 1 (7.7, Freemius secret in query string) closed as an accepted risk after researching Freemius's own API docs. 7.3's fix also surfaced and fixed a live Phase-6.1 regression (license-key verification silently broken since that migration). Every finding verified against the real local install — unit tests, live REST/HTTP round-trips, direct DB reads, and one Playwright pass for the stored-XSS finding. Also: Phase 6 complete — multi-product Freemius support fully implemented + visually verified via Playwright; plus a post-Phase-6 Inbox unread-pill bugfix; see §11, §21)

---

## Plugin Identity (Finalised 2026-06-22)

| Property | Value |
|---|---|
| **Display name** | SublimeCRM |
| **Plugin folder** | `sublime-crm/` |
| **Main file** | `sublime-crm.php` |
| **PHP function prefix** | `stcrm_` |
| **PHP class namespace** | `SublimeCRM\` |
| **DB table prefix** | `wp_stcrm_` (e.g. `wp_stcrm_contacts`) |
| **REST namespace** | `stcrm/v1` → full path `/wp-json/stcrm/v1/` |
| **Text domain** | `sublime-crm` |
| **WordPress constant prefix** | `STCRM_` (e.g. `STCRM_VERSION`, `STCRM_DIR`) |
| **Block namespace** | `sublime-crm/` (e.g. `sublime-sublime-crm/support-portal`) |
| **Capability** | `stcrm_manage_tickets` |
| **Option keys** | `stcrm_*` (e.g. `stcrm_db_version`, `stcrm_settings`) |
| **Transient keys** | `stcrm_*` |
| **Action Scheduler group** | `stcrm` |
| **Error codes** | `stcrm_open_ticket_exists`, `stcrm_turn_limit`, `stcrm_ticket_cap_reached` |
| **Session cookie name** | `stcrm_session` |

---

## 1. What This Is

A **self-hosted WordPress support CRM plugin** installed on the SublimeTheme.com vendor site. It handles support tickets from customers of a Freemius-sold plugin.

**Current scope:** Built custom for SublimeTheme.com. Not yet being sold to other theme businesses — that is the eventual goal but not the current build target.

**No code ships inside the pro plugin in v1.** All support actions happen on the vendor site.

### Two faces

| Face | Lives on | What it does |
|---|---|---|
| Admin (wp-admin) | Vendor site backend | Inbox, thread, contacts, settings |
| Customer portal | Vendor site frontend | Ticket form, my tickets, thread, magic-link auth, floating launcher |

---

## 2. Key Reference Files in This Folder

| File | Purpose |
|---|---|
| `wordpress-crm-strategy.md` | High-level CRM vision (contacts, licenses, renewal pipeline, automation) |
| `design_handoff_support_crm/support-crm-spec.md` | **Technical source of truth** — data model, REST API, guards, Freemius, security, phases |
| `design_handoff_support_crm/README.md` | Visual design reference — tokens, components, screen-by-screen specs |
| `design_handoff_support_crm/design/Support CRM.html` | Interactive prototype — open in browser to see all 13 screens |
| `design_handoff_support_crm/design/hi-admin.jsx` | Admin screen prototypes (Inbox, Thread, Contacts, Settings) |
| `design_handoff_support_crm/design/hi-portal.jsx` | Portal screen prototypes |
| `design_handoff_support_crm/design/hi-launcher.jsx` | Floating launcher prototype |
| `design_handoff_support_crm/design/hi-kit.jsx` | Shared primitives: Icon, Status, Priority, Tier, Badge, WP/Portal shells |
| `design_handoff_support_crm/design/hi-app.jsx` | **Prototype router only — IGNORE for production** |
| `design_handoff_support_crm/screenshots/` | 13 PNG references at 1080px (dark top bar in each = prototype nav, ignore it) |

> The 4 JSX files are prototype-only (in-browser Babel + mock data). They are visual references, **not production code to copy**.

---

## 3. Relationship Between Strategy Doc and Spec

These are **not the same document**. They operate at different scopes:

- **`wordpress-crm-strategy.md`** — Full CRM vision: contacts, licenses, theme purchase history, block template usage, renewal pipeline, automation, deals. Admin UI via DataViews + Block Editor.
- **`support-crm-spec.md`** — Focused v1 deliverable: support ticketing only. PHP-rendered admin pages + small React islands.

The spec is the first deliverable of the strategy, not a contradiction. Key differences:
- Strategy uses DataViews/Block Editor for admin; spec uses PHP admin pages
- Strategy has `st_form_submissions` flow for all forms; spec has its own ticket tables (see §5 below)
- Strategy mentions renewal pipeline, automation, deals — all out of scope for spec v1

---

## 4. Architectural Decisions (Finalised)

### 4.1 Plugin is standalone
Not a theme module. Not embedded in SublimeBlocks. No CRM logic in the theme.

### 4.2 Form architecture — WHERE forms live

| Form type | Lives in | Reason |
|---|---|---|
| Support ticket submission | **CRM plugin** | Needs real-time tier check, guard response, magic-link email; launcher uses same endpoint |
| Free download / lead capture | **SublimeBlocks block** → `st_form_submissions` | Genuinely generic, async processing fine |
| Pre-sale / newsletter | **SublimeBlocks block** → `st_form_submissions` | Same — CRM enriches contacts from these |

**The `st_form_submissions` path is for lead capture, NOT for support tickets.**

Routing the ticket form through `st_form_submissions` would break real-time tier verification, the 409 guard response (with existing ticket link), and the immediate magic-link confirmation email (the customer's first access to the thread).

### 4.3 Portal rendering — block in default template (no dedicated template)

The portal uses a **`sublime-crm/support-portal` dynamic block** registered by the CRM plugin, placed directly in a page's content area using the default theme template.

**No dedicated page template.** The classic page template system (`STCRM_Page_Templates`, `templates/support-portal.php`) was removed in Phase 4 — it was unnecessary overhead since the block works in any template. Current setup: page ID 2371, slug `new-support`, block in content, default template.

This approach works identically on classic and FSE themes — no plugin changes needed if the theme migrates.

#### What `sublime-crm/support-portal` does:
- Editor: static placeholder
- Frontend: outputs `<div id="crm-portal"></div>` + enqueues portal JS
- Portal JS handles all view states (new ticket / my tickets / thread / auth / expired / cap) via URL params + session state
- The block is a mount point for the JS app, not a self-contained UI

---

## 5. Data Model

4 custom DB tables, all `wp_` prefixed, InnoDB, utf8mb4. `product_id` written on every insert from day one (multi-product ready).

### `wp_stcrm_contacts`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| product_id | BIGINT UNSIGNED | Freemius product scope |
| fs_user_id | BIGINT UNSIGNED NULL | null = email-only contact |
| email | VARCHAR(190) | Lowercased before insert |
| name | VARCHAR(190) NULL | |
| tier | ENUM('free','pro') | Drives guard matrix |
| plan | VARCHAR(100) NULL | Freemius plan title |
| license_key_hash | VARCHAR(64) NULL | SHA-256(raw_license_key) — for fallback verification at ticket creation |
| verification_pending | TINYINT(1) UNSIGNED | 1 = Freemius API unreachable at ticket creation; stcrm_reverify_contact AS job queued |
| license_status | ENUM('none','active','expired','cancelled') | |
| license_expires | DATETIME NULL | |
| sites_count | SMALLINT UNSIGNED | |
| created_at / updated_at | DATETIME | |

Indexes: `UNIQUE (product_id, email)`, `UNIQUE (product_id, fs_user_id)`, `INDEX (tier)`, `INDEX (license_key_hash)`

### `wp_stcrm_tickets`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| product_id | BIGINT UNSIGNED | |
| contact_id | BIGINT UNSIGNED FK→contacts | |
| subject | VARCHAR(255) | |
| category | VARCHAR(50) NULL | technical/billing/feature/presale/bug |
| status | ENUM('open','awaiting_agent','awaiting_customer','resolved','closed') | |
| priority | ENUM('low','normal','high','critical') | Default: low unverified, normal verified |
| verified | TINYINT(1) | License verified at creation |
| assigned_to | BIGINT UNSIGNED NULL | WP user ID |
| source | ENUM('portal','widget') | widget reserved for future in-plugin client |
| fs_license_id / fs_install_id | BIGINT NULL | |
| env | JSON NULL | User-supplied: site_url, wp_version, php_version, plugin_version |
| created_at / last_activity_at | DATETIME | |
| resolved_at | DATETIME NULL | Drives auto-close |

Indexes: `INDEX (contact_id, status)`, `INDEX (status, last_activity_at)`, `INDEX (assigned_to)`

### `wp_stcrm_messages`
**Immutable** — no edit/delete in v1.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| ticket_id | BIGINT UNSIGNED FK→tickets | |
| sender_type | ENUM('customer','agent','system') | system = status changes, auto-close notices |
| sender_id | BIGINT UNSIGNED NULL | contact_id or WP user ID |
| body | TEXT | wp_kses minimal whitelist |
| is_internal_note | TINYINT(1) | Agent-only; **never exposed via public API** |
| created_at | DATETIME | |
| read_at | DATETIME NULL | |

Index: `INDEX (ticket_id, created_at)`

### `wp_stcrm_tokens`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| token_hash | CHAR(64) UNIQUE | SHA-256 of raw token; raw token **never stored** |
| contact_id | BIGINT UNSIGNED | |
| ticket_id | BIGINT UNSIGNED NULL | Deep-link target |
| type | ENUM('magic_link','session') | |
| expires_at | DATETIME | magic_link: 48h · session: 30 days |
| used_at | DATETIME NULL | magic_link = single-use |
| created_at | DATETIME | |

Nightly cron purges expired rows.

---

## 6. Guard Matrix

Enforced **server-side at the REST layer**. The portal mirrors state from the API — never trust client claims.

| Guard | Free / unverified | Pro / verified |
|---|---|---|
| Max open tickets | **1** → return existing ticket (409 `stcrm_open_ticket_exists`) | **5** → soft cap, friendly 409 |
| Consecutive customer messages/turn | **3** → composer locks (423 `stcrm_turn_limit`) | No visible limit; silent ceiling **10** |

Consecutive check: `COUNT(*)` of `sender_type='customer'` messages on the ticket since the most recent non-internal `sender_type='agent'` message (or since ticket creation if none).

---

## 7. REST API

Namespace: `stcrm/v1` under `/wp-json/`. All responses JSON. Errors use WP_Error shape.

### Authentication models
| Caller | Mechanism |
|---|---|
| Portal ticket form (public) | No auth. Email matched server-side against synced contacts. Strict rate limits. |
| Portal (authenticated) | HttpOnly session cookie (raw session token → SHA-256 hash stored in wp_stcrm_tokens) |
| Agent (wp-admin) | Logged-in WP user + capability `stcrm_manage_tickets` + REST nonce |
| Freemius | HMAC SHA-256 signature header `x-signature` |

### Public endpoints
- **`POST /tickets`** — create ticket (public). Flow: rate-limit → honeypot → validate → tier resolution → guard check → insert ticket + first message → queue confirmation email with magic link
- **`GET /tickets`** — list own tickets (session auth). Returns `[{id, subject, status, priority, last_activity_at, unread_count}]`
- **`GET /tickets/{id}`** — thread (session auth). Ownership check. Returns ticket + messages (internal notes **excluded at query level**) + `composer: {locked, reason, notice}`. Marks agent messages read. **Client polls every 15s; pauses when `document.hidden`.**
- **`POST /tickets/{id}/messages`** — customer reply (session auth). Replying to `resolved` reopens to `awaiting_agent`. 423 on turn limit.
- **`POST /auth/magic-link`** — request login link (public). **Always returns 200** (anti-enumeration). Rate limit: 3/hour/email.
- **`POST /fs-webhook`** — Freemius webhook (public, signed). Always responds 200 immediately; processing queued via Action Scheduler.

### Magic-link redemption (portal page, not REST)
`GET /support/?t={raw_token}` — hash → look up unused unexpired row → mark used_at → issue session cookie → redirect to ticket or portal home. Invalid/expired → show expired screen.

### Admin endpoints (capability `stcrm_manage_tickets` + nonce)
- `GET /admin/tickets` — filterable list, default sort floats `verified` + priority ("Smart" sort)
- `GET /admin/tickets/{id}` — includes internal notes + full contact panel
- `POST /admin/tickets/{id}/messages` — `{message, is_internal_note}`. Non-note: sets `awaiting_customer` + queues content-free customer email. Internal note: no email, no status change.
- `PATCH /admin/tickets/{id}` — status, priority, assigned_to
- `GET /admin/contacts`

---

## 8. Ticket Lifecycle

```
open ──(agent reply)──▶ awaiting_customer
awaiting_customer ──(customer reply)──▶ awaiting_agent ──(agent reply)──▶ awaiting_customer
any ──(agent resolves)──▶ resolved ──(auto after N days)──▶ closed
resolved ──(customer reply)──▶ awaiting_agent  (reopen)
closed ──▶ terminal — customer must open a new ticket
```

Every status change inserts a `system` message in the thread so history is visible.

---

## 9. Freemius Integration

### Webhook receiver (`POST /fs-webhook`)
- Validate: `hash_hmac('sha256', raw_body, product_secret_key)` vs `x-signature` header using `hash_equals()`
- Mismatch → 401, log, stop
- Valid → queue via Action Scheduler (idempotent handlers — upserts keyed on Freemius IDs)

### Event handling
| Event | Action |
|---|---|
| `license.created` / `payment.created` | Upsert contact: tier=pro, license_status=active, plan, expiry, fs IDs |
| `license.plan.changed` | Update plan |
| `license.extended` / `license.shortened` | Update license_expires |
| `license.expired` | license_status=expired, tier=free |
| `license.cancelled` / `subscription.cancelled` / `license.deleted` | license_status=cancelled, tier=free |
| `user.updated` | Refresh name/email |

Tier downgrades **never delete contacts or tickets** — history preserved; only guard tier changes.

### Tier verification at ticket creation
1. **Primary (no API call):** match submitted email against `wp_stcrm_contacts`. Contact with `license_status=active` → verified, tier=pro, priority=normal.
2. **Fallback (license key provided):** verify key against Freemius API → cache result ~1h per key hash. Unreachable → accept as unverified, flag `verification_pending`, re-check via queued job.
3. **No match / failed:** verified=0, tier=free, priority=low. Nothing bounces.

### Backfill
Settings button → Action Scheduler job chain paginating Freemius users + licenses API. Resumable (stores last page). Progress meter needed (currently only trigger button in design — known gap).

---

## 10. Email Notifications

**Transport:** `wp_mail` via SMTP plugin (FluentSMTP or WP Mail SMTP) → SiteGround SMTP initially. Switch to transactional provider (SMTP2GO/Brevo) by changing credentials only.

All sends queued via Action Scheduler. **Debounce: max 1 customer notification per ticket per 10 minutes.**

| Trigger | Recipient | Content |
|---|---|---|
| Ticket created | Customer | "We've received your ticket." + magic-link button to thread |
| Agent public reply | Customer | "Your ticket has a new reply." + magic-link button. **NO message content.** |
| Customer message / new ticket | Agent (fallback: settings address) | Subject + admin link |
| Auto-close | Customer | Closed notice + reopen info |

### Non-negotiable rule
**Customer emails NEVER contain message content — magic-link buttons only.**

---

## 11. Admin UI — Screen Reference

### Inbox
- Page title "Support Inbox" + "6 open" pill — this pill is the **open ticket count** (`count_open_tickets()`, status not in resolved/closed), not an unread count; it is not meant to equal a hand-count of rows showing an unread pill (bugfix note below)
- Filter toolbar: Status / Priority / Tier / Assignee / Product (Phase 6.4, only shown with 2+ configured products) selects + search input
- Split panel (fixed 600px height): **384px list** (fixed) | **reading pane** (flex)
- List item: Product badge (Phase 6.4) + Tier badge + Critical badge if critical + `#id · time` kicker (mono 10px uppercase) + subject (13.5px/600) + who—preview (clamped 1 line) + Status badge + priority badge + unread pill
- Active item: `#f0f6fc` bg + 3px left `--wp-blue` border
- Default sort ("Smart"): floats `verified=1` + priority
- **Bugfix (2026-07-05):** the unread pill (`unread_customer_count`) no longer counts unread messages on `closed` tickets — a closed ticket is terminal, so a customer message left unread when it closed (e.g. via old test data that never went through the real UI flow) should never surface as an actionable indicator. Fixed as a query-level exclusion in `STCRM_Database::get_admin_tickets()`, so it also retroactively cleared stale historical data with no separate backfill needed.

### Thread
- Back button + "Ticket #id" kicker; subject as page title
- Layout: thread panel (flex ~630px) + 300px sidebar
- **Messages:**
  - Customer: left-aligned, grey `cust` avatar (#5a6b7d), white bubble
  - Agent: right-aligned `.me`, blue avatar, `#f0f6fc` bubble
  - Internal note: full-width, amber `--amber-note` bg, amber avatar with note icon, "only visible to agents"
  - System message: centered hairline divider + mono text
- **Composer (two modes — toggled by tabs):**
  - Reply (white bg) → sets `awaiting_customer`, queues content-free email. Helper: "Customer gets a link-only email"
  - Internal note (amber `--amber-note` bg, lock icon) → NOT emailed, NOT status change. Helper: "Not emailed · agents only"
  - Switching mode recolors entire composer bg + textarea border (`.15s transition`)
- **Sidebar (3 panels):**
  1. Customer — Freemius read-only mirror (plan, license masked, expiry, sites, Freemius ID, customer since). Footer: "Synced from Freemius · read-only"
  2. Environment — site, install, WP, PHP, plugin versions (mono). "Provided on the submission form."
  3. Manage — Status / Priority / Assignee selects + Resolve (primary) + Close buttons

### Contacts
- Page title + "Run Freemius backfill" button
- Table: avatar, Name (blue-strong), Email (mono muted), Tier badge, Plan, License badge (dot + status), Open count (blue pill if >0), Last activity, chevron
- Footer: "Showing N of N · synced X ago via webhook"

### Contact detail
- Back button; 300px profile card + ticket-history panel
- Profile card: avatar, name, email, Tier + License badges, key/values, "View in Freemius" button
- Ticket history: table (#, Subject, Status, Priority, Updated, chevron)

### Settings (3 tabs)
**Freemius tab:** Product ID, API bearer token (password), Product secret key (password, encrypted at rest via wp_salt-derived key), Webhook URL (read-only + copy button), success notice, backfill button.

**Email tab:** From name, From address, Agent fallback address, Notification debounce (minutes, default 10), Auto-close after (days resolved, default 7). Warning: "Customer emails never contain message content."

**Tickets & guards tab:** Categories (comma list), Default priority per tier, Guard matrix table (editable inputs).

---

## 12. Customer Portal — Screen Reference

All screens use the `Portal` shell (vendor theme header/nav/footer). Portal base font: 14px. Portal H1: 30px/800/-.025em.

| Screen | Route/trigger | Key behaviour |
|---|---|---|
| New ticket | `/support/` (default) | Form: email, name, subject, category, message, optional license key, optional env fields. Honeypot `company_url` field (off-screen) → fake 201 on trip. Sidebar: docs card + Pro faster-replies card + privacy note |
| My tickets | After sign-in | Header: signed-in email + sign out + "+ New ticket". Card list with #id, "N new reply" pill, subject, status/priority, updated time |
| Thread | `?view=thread&ticket=id` | Chat bubbles (customer right/blue, agent left/grey). 15s poll — pauses on `document.hidden`. Two composer states: active (reply count remaining) vs locked (dashed card, lock icon, "Thanks — we've received your messages") |
| Sign in | `?view=auth` | Email → "Email me a sign-in link". Always shows "Check your inbox" regardless of match |
| Expired link | On redemption failure | Amber hourglass icon. Email field + "Send a new link" |
| Empty state | My tickets, zero rows | Inbox icon, "No tickets yet", "Open your first ticket" CTA |
| Cap reached | On 409 response | Amber banner replaces form. Links to existing open ticket. Pro message is softer |

---

## 13. Floating Launcher

- Bottom-right **60px circular bubble** (blue, chat icon; toggles to × when open)
- **380px panel** (radius 16px, shadow `0 20px 60px rgba(0,0,0,.28)`) above the bubble
- **Header:** gradient blue (`135deg, --wp-blue, --wp-blue-d`). Label "Support" + "We usually reply within a few hours." NO online/offline indicator.
- **Label rule: NEVER "Chat". NEVER an online/offline presence dot.**
- Same REST endpoints as portal. Session cookie shared (same-origin). Native panel (not iframe).

**Three view states:**
1. **No session:** compact form (Email, Subject, Message) + "Send message" + "Already have a ticket? Sign in →"
2. **My tickets:** "+ New" button + compact ticket rows (#id, "N new" pill, subject, status)
3. **Open thread:** back chevron + #id + subject + compact message bubbles + inline reply input + send button

---

## 14. CSS Design Tokens

Defined in `:root` of `design/Support CRM.html`. These are the production values to implement.

```css
/* WordPress admin palette */
--wp-blue: #2271b1;      /* primary action, links, active */
--wp-blue-d: #135e96;    /* hover, link-strong */
--wp-blue-l: #72aee6;    /* admin-bar hover */
--wp-ink: #1d2327;       /* primary text, sidebar bg */
--wp-ink2: #2c3338;      /* sidebar submenu bg */
--wp-ink3: #3c434a;      /* bubble body text */
--g1: #50575e;  --g2: #646970;  --g3: #8c8f94;  --g4: #a7aaad;
--line: #dcdcde;  --line2: #e0e0e0;  --line3: #f0f0f1;
--bg: #f0f0f1;   --card: #fff;
--sidebar: #1d2327;  --sidebar2: #2c3338;

/* Semantic */
--green: #00a32a;  --green-bg: #edfaef;  --green-line: #b8e6bf;
--red: #d63638;    --red-bg: #fcf0f1;    --red-line: #f1adad;
--amber: #dba617;  --amber-bg: #fcf9e8;  --amber-line: #f0e1a8;
--amber-note: #fbf6e3;  /* internal note bubble + composer bg */

/* Shadows */
--shadow-sm: 0 1px 1px rgba(0,0,0,.04);
--shadow: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
--shadow-lg: 0 12px 40px rgba(0,0,0,.16);

--radius: 4px;
--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
--mono: "SF Mono", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace;
```

**Special badge colors (not in tokens):**
- Pro badge: bg `#fff7ed`, text `#9a3412`, border `#fed7aa`
- Awaiting-customer badge: bg `#f0f6fc`, text `#135e96`, border `#c5d9ed`

**Typography scale:**
- Admin base: 13px. Portal base: 14px.
- Admin page title: 23px/400. Portal H1: 30px/800/-.025em.
- Badges: 11.5px/500. "Kick" labels: 10px mono uppercase `.12em` tracking color `--g3`.

---

## 15. Badge System

### Status (label differs by audience — `admin` prop)
| status | Customer label | Admin label | Color class | Dot color |
|---|---|---|---|---|
| `open` | Open | Open | `b-grey` | `#8c8f94` |
| `awaiting_agent` | Awaiting agent | Awaiting agent | `b-amber` | `#dba617` |
| `awaiting_customer` | **Awaiting you** | **Awaiting customer** | `b-blue` | `#2271b1` |
| `resolved` | Resolved | Resolved | `b-green` | `#00a32a` |
| `closed` | Closed | Closed | `b-grey` | `#8c8f94` |

### Priority
`low`/`normal` → `b-grey` | `high` → `b-amber` | `critical` → `b-red`

### Tier
`pro` → "★ Pro" (`b-pro`: bg `#fff7ed`, text `#9a3412`, border `#fed7aa`) | `free` → "Free" (`b-grey`)

---

## 16. Security Rules

- All writes through `$wpdb->prepare()` — never raw SQL
- `body` stored as `wp_kses` minimal whitelist (links, code, line breaks)
- Output escaped on render; URLs in customer messages: `rel="nofollow noopener"`
- Internal notes excluded **at the query level**, not the template level
- Ownership check on every thread read/write
- Tokens: `random_bytes(32)` → URL-safe base64; only SHA-256 hash stored; magic links single-use 48h; sessions 30 days HttpOnly/Secure/SameSite=Lax
- Webhook: HMAC validation via `hash_equals()` (constant-time)
- Rate limits (transient-based, `429` + `Retry-After`):
  - Ticket creation: 5/hour/IP + 3/day/email unverified (verified: 20/day)
  - Messages: 30/day/contact unverified
  - Magic-link: 3/hour/email
- Honeypot: `company_url` field off-screen — non-empty → silent fake 201, nothing stored
- Never trust client tier/license claims — always verify server-side
- `uninstall.php` honours "delete all data on uninstall" setting (default off)

---

## 17. Build Phases

| Phase | Status | Contents | Done when |
|---|---|---|---|
| 1 — Foundation | ✅ Complete (2026-06-22) | Tables + migrations (dbDelta + schema version), Action Scheduler, settings screen, webhook receiver + HMAC validation, backfill job | Existing Freemius customers appear as contacts; test purchase/cancel updates tier within seconds |
| 2 — Tickets core | ✅ Complete (2026-06-25) | REST API (public + admin routes), guard matrix, admin inbox + thread UI + contacts UI | Full conversation round-trip via REST client; guards return 409/423 correctly per tier |
| 3 — Touchpoints | ✅ Complete (2026-06-27) | `sublime-crm/support-portal` block + classic page template; portal views (form, my-tickets, thread, magic-link auth); floating launcher + native panel | Customer can open ticket from launcher with email alone, get auto-verified, hit turn limit, resume via emailed link |
| 4 — Notifications & hardening | ✅ Complete (2026-06-27) | 4.1–4.8 ✅ complete. 4.9 = production ops (no code). 4.10 = removed. QA pass applied: portal-URL transient cache (DAY_IN_SECONDS, bust on save_post), email header injection prevention (CR/LF strip), esc_like added to Launcher, salt-rotation warning in Settings (Freemius tab), dead ViewStub removed from portal App.jsx, auto-close insert error guard. | Reply notice lands in inbox (not spam) with working deep link; abuse attempts throttled |
| 5 — Design-Handoff Gap Closure | ✅ Complete (2026-07-04) | 11 confirmed gaps found via full audit vs. design handoff (see §18). 5.1–5.10 built + Playwright/end-to-end verified; 5.11 ("Lifetime value") explicitly marked out of scope — no spec backing, no payment data captured anywhere, would need a real sub-feature (refund handling, backfill, migration) to build correctly. Full task breakdown in `phase-plan-clickup.md` Phase 5 (5.1–5.11). | All 11 gaps resolved or explicitly marked out-of-scope with reasoning — **done** |
| 6 — Multi-Product Freemius Support | ✅ Complete (2026-07-05), visually verified via Playwright | Settings stores a repeatable `products` list (dynamic add/remove rows, save-time duplicate-secret guard, one-time migration from the old flat fields); webhook resolves the signing secret via hybrid brute-force matching (+ best-effort payload parse for log-only diagnostics); ticket forms (Portal + Launcher) get an explicit product dropdown backed by a new `GET /products` endpoint; admin Inbox/Contacts/Thread/Contact-Detail all show/filter by product; backfill runs independently per product. **6.6 (not in original scope, surfaced mid-6.3):** magic-link sign-in is now email-scoped, spanning every contact a customer has across products. Three live bugs predating this phase were found and fixed along the way, all sharing one root cause (a consumer of the old single-product model not in the design doc's named-files list): magic-link sign-in (6.6), admin Inbox/Contacts (6.4), and the Contacts page's backfill shortcut (found during the Playwright pass). Full 6.1–6.6 task checklist + verification notes in `phase-plan-clickup.md` Phase 6. | All 6.1–6.6 done — **done** |
| 7 — Deep QA Findings | ✅ COMPLETE (2026-07-05) — 10 of 10 done | Full manual code review (all 26 PHP files) across performance/security/optimization/error-handling, requested after Phase 6 shipped. 10 findings, ranked by severity, **all resolved**: **7.1–7.6** stored XSS in system messages; missing `wp_stcrm_contacts.email` index + single-product short-circuit; synchronous Freemius API call moved fully async (which also surfaced and fixed a second live bug — license-key verification silently broken since Phase 6.1 due to a settings-key read that never got updated in that migration); 4th uncached portal-URL-lookup duplicate; missing agent-alert email debounce; unguarded `$wpdb->update()` calls in `STCRM_Freemius_Sync`. **7.7** (Freemius license secret sent as a GET query param) closed as an accepted risk — researched Freemius's actual API docs rather than guessing; every license-key endpoint they document uses the same query-string convention, no POST/header alternative exists anywhere. **7.8** (admin ticket-list sort had no supporting index) — discovered the `priority` ENUM column's declaration order already matches severity order, so the `CASE`-computed sort column (which can never be index-satisfied) was dropped in favor of sorting the raw column directly, paired with a new composite index; confirmed via `EXPLAIN` + `FORCE INDEX` that the filesort is fully eliminated. **7.9** (`resolved_at` left stale after an agent reply) — `STCRM_Admin_Controller::create_message()`'s reply branch now clears `resolved_at`, mirroring the customer-side reopen. **7.10** (no server-side numeric validation on Settings "Product ID") — new `has_invalid_product_id()` guard rejects non-numeric IDs at save time with a clear error, matching the existing duplicate-secret guard's all-or-nothing pattern; verified via `curl` that an invalid submission is fully rejected (no partial save) while valid saves are unaffected. Full list + files + fix directions in `phase-plan-clickup.md` Phase 7 (7.1–7.10). | Each finding independently resolved or explicitly deferred with reasoning, same closure pattern as Phase 5 — **done** |
| 8 — Settings Gap Closure | ✅ Complete (2026-07-06) | Two Settings-screen items flagged "deferred to Phase 2" back in Phase 1 (2026-06-23) and never picked up since — confirmed via code search neither exists in the plugin. Designed via brainstorming session since one item was never actually specced beyond a one-line placeholder. **8.1 Default Priority Per Tier** — the currently-hardcoded `verified_result()`/`unverified_result()` priority defaults (`normal`/`low`) are now two Settings selects (`default_priority_pro`/`default_priority_free`), per the design README's original spec (Free→Low, Pro→Normal); verified via a live Settings-save → real-ticket-creation REST round trip. **8.2 Connection Status** — per-product "Test Connection" button + cached green/red badge, live-pinging Freemius's `installs.json` with the stored API token only (the secret key isn't testable this way — webhook-signature-only), reusing the Contacts page's existing license-badge CSS rather than adding new styles; includes a small in-place consolidation of the "find product by ID" logic previously duplicated in `STCRM_Backfill`/`STCRM_Tier_Resolver`. Full spec + verification notes in `phase-plan-clickup.md` Phase 8 (8.1–8.2). | Both items built, verified, and documented one at a time — same cadence as Phase 7 — **done** |

---

## 18. Known Gaps vs. Design Handoff (full audit 2026-07-03)

A full pass comparing `README.md` + `support-crm-spec.md` against the built plugin (post-Phase-4) found **11 confirmed gaps** — the 4 the README's own list called out (1 of which was already resolved during the build), plus 8 more found by independent audit. Full task-by-task plan: `phase-plan-clickup.md` Phase 5 (5.1–5.11).

**All 4 of the README's own "known design gaps" are now resolved** (1 was already fixed pre-audit; 3 closed via 5.1–5.3 below). 8 gaps remain, all found by the independent 2026-07-03 audit (not on README's own list):

**Resolved during the build (was on README's list, no longer a gap):**
- "Delete all data on uninstall" toggle — `delete_on_uninstall` setting exists (Tickets tab), wired to `uninstall.php`

**Found by the 2026-07-03 audit (not on README's own list):**
4. ~~No Assignee UI anywhere in admin~~ — ✅ **Resolved 2026-07-03** (see below)
5. ~~Inbox search box~~ — ✅ **Resolved 2026-07-03** (see below)
6. ~~Freemius webhook missing event types~~ — ✅ **Resolved 2026-07-03** (see below)
7. ~~Thread sidebar Customer panel missing fields~~ — ✅ **Resolved 2026-07-04** (see below)
8. ~~Thread header missing category badge + "Assigned to you" indicator~~ — ✅ **Resolved 2026-07-04** (see below)
9. ~~Inbox list pane missing header row~~ ("N tickets" / "Sort: Smart") — ✅ **Resolved 2026-07-04** (see below)
10. ~~`POST /tickets` response `thread_url` hardcoded `null`~~ — ✅ **Resolved 2026-07-04** (see below)
11. ~~Contact detail "Lifetime value" field~~ — ❌ **Marked out of scope 2026-07-04** (see below) — **all 11 gaps now closed, Phase 5 complete**

These are additive — nothing here blocks current functionality. Everything else in the spec has a corresponding, verified implementation.

**Resolved 2026-07-03 — Backfill progress meter (5.1), plugin commit `2e47f66`:** `STCRM_Backfill` now tracks a `stcrm_backfill_total` option (from the Freemius API's `total` field) alongside the existing last-page option; `get_progress()` returns `{status, page, total, processed, percent}`. Settings → Freemius tab renders a live progress bar + status line, kept current via a new `wp_ajax_stcrm_backfill_status` AJAX endpoint polled every 3s by `admin/js/stcrm-settings.js` while the job is `running` (self-stops otherwise, pauses while the tab is hidden). Verified end-to-end via Playwright with an injected admin session (no password needed) and a simulated running state — see `phase-plan-clickup.md` 5.1 for full details.

A post-implementation code review found 5 issues; 4 were fixed in the same commit (JS/PHP error-label mismatch on live poll, blank progress text during page-1 processing, missing defensive `return` in `ajax_status()`, no `document.hidden` pause on the poller). One was flagged but not fixed: the new AJAX endpoint uses its own auth check instead of the plugin's established REST + `authenticate_admin()` pattern — a design call, not a bug, left for a future revisit.

**Resolved 2026-07-03 — Capability Assignment UI (5.2), plugin commit `46efc43`:** New "Support Access" row on Settings → Tickets & Guards — a checkbox per registered WP role (Administrator shown checked + disabled, always granted). `STCRM_Settings::get_support_roles()` reads current grants; `sync_support_roles()` grants/revokes via `WP_Role::add_cap()`/`remove_cap()` on save, iterating only real registered roles (never trusts posted role names directly). `uninstall.php` already stripped the capability from every role on uninstall, so no changes needed there. Verified via Playwright: grant/persist/revoke round-trip confirmed with `wp eval`, other Tickets-tab fields unaffected.

**Resolved 2026-07-03 — Launcher Docs-Deflection Link (5.3), plugin commit `f162c15`:** New `docs_url` setting (Tickets & Guards tab). Both the launcher's no-session view and the portal's New Ticket sidebar show a "Check our docs first"/"Search the docs" link when set, omitted entirely otherwise. Also fixed a bonus bug found mid-implementation: the portal's docs button had no `href`/`onClick` at all (dead markup) — now wired to the same setting. Rebuilt `stcrm-portal.js` + `stcrm-launcher.js`. Verified via Playwright: link renders with correct `href` on both surfaces when configured, disappears cleanly from both when cleared.

**Resolved 2026-07-03 — Admin Assignee Controls (5.4), plugin commit `b4cf9b2`:** Thread → Manage panel gained an Assignee `<select>` (Unassigned + agents from new `STCRM_Admin::get_agents()`), wired to the existing `PATCH /admin/tickets/{id}` `assigned_to`. Inbox filter toolbar's Assignee `<select>` is now actually rendered (the JS listener for it already existed as dead code). `GET /admin/tickets?assignee=` extended to accept `me`/`unassigned` keywords alongside numeric IDs. Mid-review, a "Me" dropdown option was added then removed after the user flagged it as redundant with the current user already appearing by name in the same list — kept the harmless `me` REST keyword, dropped only the UI option. Verified via Playwright: assign/persist/unassign round-trip, all three REST filter modes return correct ticket sets.

**Resolved 2026-07-03 — Inbox Search Box (5.5), plugin commit `69ca300`:** New search input in the Inbox filter toolbar ("Search subject or email…"). `GET /admin/tickets?search=` matches ticket subject + contact email via `LIKE` (reuses the existing contacts JOIN). JS debounces the search input on 300ms (unlike the other filters, which fire immediately on `change` since they're discrete selects). Verified via Playwright: subject/email search return correct ticket sets, no-match returns empty, live typed search narrows/restores the visible list correctly.

**Resolved 2026-07-03 — Freemius Webhook Event Coverage (5.6), plugin commit `86dfed2`:** Added handlers for `license.created`/`payment.created` (new pro purchase, reuses the existing `handle_license_status_change()`), `license.plan.changed` (new `handle_plan_changed()`, plan only), `license.extended`/`shortened` (new `handle_license_expiry_changed()`, expiry only), and `license.deleted` (folded into the cancelled/free fallback). `handle_license_status_change()` now also updates `plan` when present, without nulling it on payloads that omit it. All new paths bust the tier-resolution cache transient. Verified via 8 direct event-simulation scenarios (no Freemius product existed yet to test against real/sandbox events) — real/sandbox verification still pending once the product is created. Surfaced the Phase 6 multi-product finding (see below) while investigating this.

**Resolved 2026-07-04 — Thread Sidebar Customer Panel Completeness (5.7), plugin commit `0aa8c06`:** `CustomerPanel` in `src/admin/thread.jsx` gained a `ContactTierBadge` (★ Pro / Free) and `LicenseBadge` (Active/Expired/Cancelled/No license, colored dot) rendered above the KV list, plus `Expires` (`license_expires`) and `Customer since` (`created_at`) rows — both fields were already returned by `GET /admin/tickets/{id}`'s `format_contact()`, just not read by the component. Added a "Synced from Freemius · read-only" footer note. Both new badges reuse the exact CSS classes already shipped on the Contacts page (`stcrm-badge--pro`, `stcrm-badge--tier-free`, `stcrm-badge--license`, `stcrm-badge--lic-*`) rather than introducing new styles. The old plain-text Tier/License KV rows were removed as redundant once the badges covered that data. Masked license key skipped as anticipated — only a SHA-256 hash is stored, no reversible raw key exists to mask. **Judgment call:** used the Contacts page's existing terse badge labels ("Active"/"Expired"/etc.) instead of the design mock's literal "License active" wording, to keep the same license_status badge consistent across both admin screens. Verified via Playwright across all four license states plus null-field edge cases; user confirmed visually via screenshot.

**Resolved 2026-07-04 — Thread Header Completeness (5.8), plugin commit `fbdc1b8`:** Thread header gained a `CategoryBadge` (renders `ticket.category` in a grey badge, hidden entirely when null) and an "Assigned to you" indicator (right-aligned via `margin-left: auto`, shown only when `ticket.assigned_to` matches the logged-in agent). **Bug caught during verification:** the assignee indicator never rendered on the first pass — `wp_localize_script` stringifies all scalars, so `window.stcrmThread.currentUser` is `"1"` while `ticket.assigned_to` from the REST response is the number `1`; the strict `===` comparison silently always failed. Fixed by `Number()`-casting `currentUser` once before comparing. Verified via Playwright against real data (tickets #7 "Pre-sale" and #9 "Technical Support" have categories; most QA test tickets legitimately don't), confirming the badge shows/hides correctly and the assignee indicator only appears for the current user. User independently cross-checked ticket #13 (no category) against #7 (category + assignee both showing) to confirm the feature wasn't mixing up status and category.

**Resolved 2026-07-04 — Inbox List Pane Header Row (5.9), plugin commit `a714528`:** `inbox.jsx` gained a `TicketListHeader` showing a live "N tickets"/"1 ticket" count (tracks the currently-filtered list) plus a static "Sort: Smart" label — plain text, not a dropdown, since the spec never defines an alternate sort order. `.stcrm-list-pane` restructured from one scrollable container into a flex column (fixed header + independently-scrolling `.stcrm-list-pane__rows`) so the header stays pinned during scroll. Verified via Playwright: count tracks filters correctly (including the 0/empty and singular cases), header stays fixed while scrolling, no regression to ticket selection or the reading pane.

**Resolved 2026-07-04 — `POST /tickets` `thread_url` Field (5.10), plugin commit `d5f3c1e`:** `STCRM_Tickets_Controller::create_ticket()`'s 201 response now resolves a real `thread_url` (`{portal_url}?view=thread&ticket={id}`) via new private `get_thread_url()`/`get_portal_url()` helpers — same `stcrm_portal_page_id` transient-cached `post_content LIKE` query as `STCRM_Mailer`/`STCRM_Launcher`'s own copies (a 3rd private duplicate, since none of the three classes expose a shared static entry point). Honeypot's `fake_201()` still returns `thread_url: null` (its `ticket_id` is always `0`). Verified end-to-end with a live `curl POST /stcrm/v1/tickets` call + a manually-issued session cookie: the returned URL rendered the real ticket thread. **Note, not a bug:** `?view=thread` only renders for an authenticated session — a brand-new anonymous ticket has none yet, so the real first-access path is still the magic-link email; no frontend code currently reads this field.

**Marked out of scope 2026-07-04 — Contact Detail "Lifetime Value" (5.11), no code change:** Decision: not building it. `support-crm-spec.md` §3.1 never defines this field — it's a README-only visual mock concept. Verified against the actual webhook handler (`class-stcrm-freemius-sync.php`) that no dollar amount is captured from `payment.created`/`license.created` payloads today; it only flips tier/license status. Building this correctly would require capturing payment amounts + `payment.refunded`/chargeback events going forward, backfilling historical payments via the Freemius API, a new DB column, and a migration — a real sub-feature, not a gap-fill on par with 5.1–5.10. A naive running total that ignores refunds would be actively misleading. **This closes Phase 5 — all 11 gaps are now resolved or explicitly marked out of scope with reasoning.**

**User question addressed (2026-07-04) — no category filter in Inbox:** User asked why the Inbox toolbar has no category filter dropdown. Checked the design mock and spec directly rather than assuming: the Inbox filter toolbar was only ever designed with Status/Priority/Tier/Assignee (`hi-admin.jsx` `Toolbar()`); `support-crm-spec.md` §7 explicitly scopes `GET /admin/tickets` filtering to "status/priority/tier/assignee"; the only spec mention of category-by-filter is a deferred "Admin reporting" line item (per-category breakdown), not a live Inbox filter. Category is designed to be visible (row badge, Thread header per 5.8) but not filterable. Confirmed this is not one of the 11 gaps — it was never in scope, not an oversight — and left it out per the user's decision.

---

## 19. What NOT to Build

| Don't build | Use instead |
|---|---|
| Email delivery / SMTP | FluentSMTP (free) |
| Payment processing | EDD or WooCommerce |
| Form builder for non-support forms | SublimeBlocks form block |
| Authentication system | WP nonces + capabilities + custom session tokens |
| Generic contact import UI | CSV + WP user sync (built-in patterns) |

---

## 20. Go-Live Checklist (from spec §12)

Run in order when pushing to production:

1. **Email transport** — create `support@` mailbox in Site Tools; configure FluentSMTP following SiteGround SMTP tutorial; confirm SPF/DKIM/DMARC; verify 9–10 score on mail-tester.com; test magic-link end-to-end
2. **Freemius wiring** — enter product_id, API bearer token, product secret key in settings; register webhook URL in Freemius dashboard; fire sandbox event; run backfill + spot-check known pro customers
3. **Scheduler reliability** — replace WP-cron with real server cron (Site Tools → every 5 min hitting `wp-cron.php`, `DISABLE_WP_CRON` in wp-config)
4. **Security pass** — HTTPS forced; rate limits + honeypot active; capability checks on admin routes; delete-on-uninstall off; expired-token purge cron scheduled
5. **Portal & launcher** — magic-link round trip on production; launcher on all frontend pages; turn-limit + cap lock states correct for free test contact
6. **Rollback safety** — full DB backup before activation; schema version in options

---

## 21. Deferred Features (designed-for, not built in v1)

| Feature | Design hook |
|---|---|
| Knowledge base / FAQ | Link from portal sidebar + launcher; zero CRM changes |
| CSAT ratings | Hook into resolved-notification; one small `crm_ratings` table |
| Admin reporting | Derived from existing timestamps; read-only queries only |
| In-plugin support widget | `source='widget'` enum + `fs_install_id` column already reserved |
| Newsletter composer | Same SMTP pipe + contacts table |
| Attachments | Deliberately out of v1 |
| Two-way email piping | Needs inbound webhook (Postmark/Mailgun) |
| ~~Multi-product UI~~ | ✅ **Built — see §17 Phase 6 (complete 2026-07-05).** No longer deferred; was designed then fully implemented as Phase 6 (6.1–6.6). |
| Realtime transport | Swap polling for WebSocket service; endpoints unchanged |

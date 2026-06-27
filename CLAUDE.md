# SublimeCRM — Project Knowledge Base

> Complete reference for Claude Code. Read this before touching any file in this folder.
> Last updated: 2026-06-27 (Phase 4.6 — auto-close cron complete)

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

### 4.3 Portal rendering — NOT a dedicated page, NOT a shortcode

The portal uses a **`sublime-crm/support-portal` dynamic block** registered by the CRM plugin.

**The block is the stable piece.** The page template wrapper changes between classic and FSE, but the block is identical in both.

#### Classic theme (current — SublimeTheme is classic now):
```php
// Plugin registers via theme_page_templates filter
// PHP template file renders:
do_blocks( '<!-- wp:sublime-crm/support-portal /-->' );
```
User creates a "Support" page → picks the template from Page Attributes.

#### FSE block theme (future — migration planned):
```
templates/support-portal.html  ← ~20 lines of block markup using sublime-crm/support-portal
```
Registered via `get_block_templates` filter. The block itself is **zero changes**.

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
- Page title "Support Inbox" + "6 open" pill
- Filter toolbar: Status / Priority / Tier / Assignee selects + search input
- Split panel (fixed 600px height): **384px list** (fixed) | **reading pane** (flex)
- List item: Tier badge + Critical badge if critical + `#id · time` kicker (mono 10px uppercase) + subject (13.5px/600) + who—preview (clamped 1 line) + Status badge + priority badge + unread pill
- Active item: `#f0f6fc` bg + 3px left `--wp-blue` border
- Default sort ("Smart"): floats `verified=1` + priority

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
| 4 — Notifications & hardening | 🔄 In progress — 4.1–4.6 ✅ (2026-06-27) | 4.1 ✅: STCRM_Mailer + 5 AS email hooks + email_agent_fallback setting. 4.2–4.5 ✅: all 5 HTML email templates. 4.6 ✅: auto_close_tickets cron — closes resolved tickets past threshold, inserts system message, queues auto_close_notice. Verified 2026-06-27 via Playwright + PHP CLI + AS DB. 4.7–4.10 pending. | Reply notice lands in inbox (not spam) with working deep link; abuse attempts throttled |

---

## 18. Known Design Gaps (spec has these, design doesn't yet)

1. **Backfill progress meter** — Settings only shows the trigger button; spec §6.3 requires resumable progress display
2. **"Delete all data on uninstall" toggle** — spec §10; not in Settings screen design yet
3. **`stcrm_manage_tickets` capability assignment UI** — spec §9; not in Settings yet
4. **Launcher docs-deflection link** — spec §9.1; portal sidebar card has it, launcher panel doesn't

These are additive. Everything else in the spec has a corresponding design.

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
| Multi-product UI | Schema already scoped by `product_id` everywhere |
| Realtime transport | Swap polling for WebSocket service; endpoints unchanged |

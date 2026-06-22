# Support CRM — Technical Specification

**Version:** 1.4 (build-ready baseline — roadmap for deferred features added)
**Scope:** Self-hosted WordPress support CRM for a Freemius-sold plugin
**Deliverable:** A single CRM plugin installed on the vendor site (admin inbox, REST API, Freemius sync, customer portal). **No code ships inside the pro plugin in v1** — all support actions happen on the vendor site.

---

## 1. Scope

### In scope (v1)
- Ticket system with chat-style threads (custom DB tables)
- Public ticket-submission form on the vendor-site portal (the single support entry point)
- Customer portal with magic-link (passwordless) access to threads
- Site-wide floating support launcher (bubble bottom-right) opening an in-place panel
- Freemius integration: email-match tier verification at submission (optional license-key proof), webhook sync, one-time API backfill
- Notification-only emails (link back to thread; **no conversation content in email**)
- Tiered guards: free/unverified vs pro/verified limits
- Admin inbox (split-pane), chat thread view with Freemius sidebar, contacts list, settings

### Out of scope (v1)
- Newsletter / campaigns
- Realtime (WebSockets/SSE) — thread view uses short polling
- File/image attachments (users may paste image-host links as plain text)
- Two-way email piping (replying from the inbox email)
- Deals/pipeline, lead discovery, reports/analytics
- In-plugin support widget (deferred; if revived later it becomes just another client of the same REST API — no schema or endpoint changes required)

---

## 2. System components

| # | Component | Lives on | Responsibility |
|---|-----------|----------|----------------|
| A1 | CRM core | Vendor site (wp-admin) | Tables, settings, admin inbox/thread/contacts UI |
| A2 | Public REST API | Vendor site | Ticket creation, thread read/reply, magic-link auth |
| A3 | Freemius sync | Vendor site | Webhook receiver, license verification, backfill job |
| A4 | Mailer | Vendor site | Notification queue via Action Scheduler → `wp_mail` (SMTP plugin → transactional provider) |
| A5 | Portal | Vendor site (frontend) | Ticket submission form, "My tickets", thread view, magic-link session, site-wide floating support launcher |

The pro plugin ships no support module. Optionally, its existing Freemius contact submenu can be replaced with a plain link to the portal page — a one-line change, not an embedded component.

---

## 3. Data model

All tables use the WP table prefix (shown as `wp_`). Engine InnoDB, charset `utf8mb4`. `product_id` (Freemius product/plugin ID) is written as a constant on every insert from day one.

### 3.1 `wp_crm_contacts`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| product_id | BIGINT UNSIGNED NOT NULL | Freemius product scope |
| fs_user_id | BIGINT UNSIGNED NULL | Freemius user ID (null if email-only contact) |
| email | VARCHAR(190) NOT NULL | Lowercased before insert |
| name | VARCHAR(190) NULL | |
| tier | ENUM('free','pro') NOT NULL DEFAULT 'free' | Drives guard matrix |
| plan | VARCHAR(100) NULL | Freemius plan title |
| license_status | ENUM('none','active','expired','cancelled') DEFAULT 'none' | |
| license_expires | DATETIME NULL | |
| sites_count | SMALLINT UNSIGNED DEFAULT 0 | Active installs |
| created_at / updated_at | DATETIME NOT NULL | |

Indexes: `UNIQUE (product_id, email)`, `UNIQUE (product_id, fs_user_id)` (null-safe), `INDEX (tier)`.

### 3.2 `wp_crm_tickets`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| product_id | BIGINT UNSIGNED NOT NULL | |
| contact_id | BIGINT UNSIGNED NOT NULL FK→contacts | |
| subject | VARCHAR(255) NOT NULL | |
| category | VARCHAR(50) NULL | e.g. technical, billing, feature, presale, bug |
| status | ENUM('open','awaiting_agent','awaiting_customer','resolved','closed') NOT NULL DEFAULT 'open' | |
| priority | ENUM('low','normal','high','critical') NOT NULL | Default: `low` unverified, `normal` verified |
| verified | TINYINT(1) NOT NULL DEFAULT 0 | License verified at creation |
| assigned_to | BIGINT UNSIGNED NULL | WP user ID of agent |
| source | ENUM('portal','widget') NOT NULL DEFAULT 'portal' | 'widget' reserved for a future in-plugin client |
| fs_license_id | BIGINT UNSIGNED NULL | |
| fs_install_id | BIGINT UNSIGNED NULL | |
| env | JSON NULL | Optional, user-supplied form fields `{site_url, wp_version, php_version, plugin_version}` — no auto-collection without an in-plugin client |
| created_at / last_activity_at | DATETIME NOT NULL | |
| resolved_at | DATETIME NULL | Drives auto-close |

Indexes: `INDEX (contact_id, status)`, `INDEX (status, last_activity_at)`, `INDEX (assigned_to)`.

### 3.3 `wp_crm_messages`

Messages are immutable — no edit/delete in v1 (this is what makes the 3-message allowance trivial to enforce).

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| ticket_id | BIGINT UNSIGNED NOT NULL FK→tickets | |
| sender_type | ENUM('customer','agent','system') NOT NULL | `system` = status changes, auto-close notices |
| sender_id | BIGINT UNSIGNED NULL | contact_id or WP user ID per sender_type |
| body | TEXT NOT NULL | Stored as sanitized plain text/limited markup (see §10) |
| is_internal_note | TINYINT(1) NOT NULL DEFAULT 0 | Agent-only; never exposed via public API |
| created_at | DATETIME NOT NULL | |
| read_at | DATETIME NULL | Set when counterpart views thread |

Indexes: `INDEX (ticket_id, created_at)`.

### 3.4 `wp_crm_tokens`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| token_hash | CHAR(64) NOT NULL UNIQUE | SHA-256 of raw token; raw token never stored |
| contact_id | BIGINT UNSIGNED NOT NULL | |
| ticket_id | BIGINT UNSIGNED NULL | Deep-link target (null = portal home) |
| type | ENUM('magic_link','session') NOT NULL | |
| expires_at | DATETIME NOT NULL | magic_link: 48 h · session: 30 days |
| used_at | DATETIME NULL | magic_link is single-use |
| created_at | DATETIME NOT NULL | |

A nightly cron purges expired rows.

---

## 4. Guard matrix (enforced server-side at the REST layer)

| Guard | Free / unverified (`tier=free` or no valid license) | Pro / verified (`tier=pro`, active license) |
|---|---|---|
| Max open tickets (status ∉ resolved, closed) | **1** — submit returns the existing open ticket | **5** — soft cap, friendly error on exceed |
| Consecutive customer messages per turn | **3**, then composer locks until agent replies | No visible limit; silent ceiling **10** (anti-runaway tripwire, never shown in UI) |
| Behavior at limit | Portal shows lock notice + existing thread | Portal shows "continue an existing thread or wait until one is resolved" |

Rules key off **license tier**: a contact synced from Freemius but holding no active paid license is still `tier=free`. The portal mirrors these states in UI; the API is the source of truth.

Consecutive-message check: `COUNT(*)` of `sender_type='customer'` messages on the ticket created after the most recent `sender_type='agent'` non-internal message (or since ticket creation if none).

---

## 5. REST API

Namespace: `yourcrm/v1` under `/wp-json/`. All responses JSON. Errors use standard `WP_Error` shape: `{ code, message, data: { status } }`.

### 5.1 Authentication models

| Caller | Mechanism |
|---|---|
| Portal ticket form (public) | No auth. Identity = submitted email, matched server-side against synced Freemius contacts (§6.2); optional license-key field for manual proof when emails differ. Unmatched → accepted as unverified. Strict rate limits (§10). |
| Portal (vendor site frontend) | Session cookie holding a raw session token; validated against `wp_crm_tokens` (`type=session`). Issued only by magic-link redemption. |
| Agent (wp-admin) | Logged-in WP user with capability `crm_manage_tickets` + REST nonce. Admin routes are not part of the public surface below. |
| Freemius | HMAC SHA-256 signature header (§6.1). |

### 5.2 `POST /tickets` — create ticket (public)

Request (submitted by the portal form):

```json
{
  "subject": "Plugin crashes on activation",
  "category": "bug",
  "message": "Steps: activate on multisite...",
  "contact": { "email": "user@site.com", "name": "Jane Doe" },
  "license_key": "sk_abc...",
  "env": { "site_url": "https://site.com", "wp_version": "6.8", "php_version": "8.2", "plugin_version": "2.4.1" },
  "hp_field": ""
}
```

`license_key` is an optional "License key (if you're a pro user)" field — only needed when the support email differs from the Freemius purchase email. `env` fields are optional user-supplied inputs on the form. `hp_field` is a honeypot — any non-empty value → silent `201`-shaped fake success, nothing stored.

Server flow:
1. Rate-limit + honeypot checks (§10).
2. Validate/sanitize required fields (`subject` ≤ 255, `message` ≤ 20 000 chars, valid email).
3. **Tier resolution (§6.2):**
   a. If `license_key` present → verify against the Freemius API; active paid license → `verified=1`, `tier=pro`, priority `normal`.
   b. Else match `email` (lowercased) against `wp_crm_contacts` for this `product_id`; contact with `license_status=active` → `verified=1`, `tier=pro`, priority `normal`. This is the default seamless path — webhook sync + backfill keep the table current, so pro customers type nothing extra.
   c. No match / failed verification → `verified=0`, `tier=free`, priority `low`. Nothing bounces.
4. Upsert contact by `(product_id, email)`. Freemius IDs/plan come from the sync layer, never from client input.
5. **Guard:** if tier limit on open tickets exceeded → return `409` with the existing/open ticket reference (free) or cap message (pro). No ticket created.
6. Insert ticket (status `awaiting_agent`) + first message. Queue agent notification **and customer confirmation email** (§7) — the confirmation carries the magic link that gives the customer their first access to the thread.

Responses:

```json
// 201 Created
{ "ticket_id": 481, "status": "awaiting_agent", "verified": true,
  "thread_url": "https://vendor.com/support/?ticket=481" }

// 409 Conflict (free tier, open ticket exists)
{ "code": "crm_open_ticket_exists",
  "message": "You already have an open ticket. Please continue the conversation there.",
  "data": { "status": 409, "ticket_id": 472 } }
```

### 5.3 `GET /tickets` — list own tickets (session auth)

Returns the authenticated contact's tickets: `[{ id, subject, status, priority, last_activity_at, unread_count }]`. Pagination via `page`/`per_page` (max 50). Used by the portal "My tickets" screen.

### 5.4 `GET /tickets/{id}` — thread (session auth)

Ownership check: ticket.contact_id must match session contact. Returns ticket header + messages (`is_internal_note=1` rows **excluded**), plus composer state:

```json
{ "ticket": { "id": 481, "subject": "...", "status": "awaiting_agent" },
  "messages": [ { "id": 1, "sender_type": "customer", "body": "...", "created_at": "..." } ],
  "composer": { "locked": true, "reason": "turn_limit",
    "notice": "We've received your messages — you'll get an email when we reply." } }
```

Marks unread agent messages as read. The open thread view polls this endpoint every **15 s**; polling pauses when the tab is hidden (`visibilitychange`).

### 5.5 `POST /tickets/{id}/messages` — customer reply (session auth)

Request: `{ "message": "..." }`. Server flow: ownership check → ticket must not be `closed` (replying to `resolved` reopens it to `awaiting_agent`) → **turn-limit guard** per §4 → insert message → status `awaiting_agent` → queue agent notification. `423 Locked` with `code: crm_turn_limit` when the allowance is spent.

### 5.6 `POST /auth/magic-link` — request login link (public)

Request: `{ "email": "user@site.com" }`. Always returns `200 { "message": "If that address has tickets, a sign-in link is on its way." }` regardless of match (no account enumeration). On match: create `magic_link` token, email it. Rate limit: 3 requests / address / hour.

### 5.7 `GET /support/?t={raw_token}` — magic-link redemption (portal page, not REST)

Flow: hash token → look up unused, unexpired `magic_link` row → mark `used_at` → issue `session` token (raw value in HttpOnly, Secure, SameSite=Lax cookie; hash stored) → redirect to ticket thread (if `ticket_id` set) or portal home. Invalid/expired → portal shows "Link expired — enter your email" form (calls §5.6).

### 5.8 `POST /fs-webhook` — Freemius webhook receiver (public, signed)

See §6.1. Always responds `200` quickly; processing is queued via Action Scheduler so Freemius never times out and retries are harmless (handlers are idempotent — upserts keyed on Freemius IDs).

### 5.9 Admin routes (wp-admin, capability + nonce)

`GET /admin/tickets` (filter by status/priority/tier/assignee, default sort floats `verified` + priority), `GET /admin/tickets/{id}` (includes internal notes + contact panel), `POST /admin/tickets/{id}/messages` (`{ message, is_internal_note }`; non-note replies set status `awaiting_customer` + queue customer notification), `PATCH /admin/tickets/{id}` (status, priority, assigned_to), `GET /admin/contacts`. Internal notes never trigger customer emails or status changes.

---

## 6. Freemius integration

### 6.1 Webhook receiver

- Configure endpoint URL in the Freemius Developer Dashboard (shown read-only on the settings screen for copy-paste).
- **Signature validation:** compute `hash_hmac('sha256', raw_request_body, product_secret_key)` and constant-time compare (`hash_equals`) with the `x-signature` header. Mismatch → `401`, log, stop.

Event handling matrix (anything not listed → acknowledge and ignore):

| Event | Action |
|---|---|
| `license.created` / `payment.created` | Upsert contact: `tier=pro`, `license_status=active`, plan, expiry, fs IDs |
| `license.plan.changed` | Update plan on contact |
| `license.extended` / `license.shortened` | Update `license_expires` |
| `license.expired` | `license_status=expired`, `tier=free` |
| `license.cancelled` / `subscription.cancelled` / `license.deleted` | `license_status=cancelled`, `tier=free` |
| `user.updated` (if subscribed) | Refresh name/email |

Tier downgrades never delete contacts or tickets — history is preserved; only the guard tier changes.

### 6.2 Tier verification at ticket creation

Primary path — **email match, no API call**: the submitted email is matched against `wp_crm_contacts` (kept current by §6.1 webhooks + §6.3 backfill); a contact with an active license verifies the ticket instantly and offline. Fallback path — **license key**: when the optional key field is filled, verify it server-side against the Freemius API (product-scoped Bearer token from the dashboard's API Token tab), fetch plan + expiry, and link/update the contact. Key-verification results cached (transient, ~1 h per key hash). Freemius API unreachable during key verification → degrade gracefully: accept as unverified, flag `verification_pending`, re-check via queued job (the email-match path has no such dependency).

### 6.3 One-time backfill

Settings-screen button → Action Scheduler job chain paginating `GET /products/{product_id}/users.json` and licenses endpoints; upserts contacts with tier/plan/expiry. Progress meter + resumable (stores last page). After backfill, webhooks keep data current — no polling.

---

## 7. Notifications (email)

Transport: `wp_mail` routed through an SMTP plugin (WP Mail SMTP / FluentSMTP) using **authenticated SiteGround SMTP** (the host's mail server — never raw PHP `mail()`). Requirements: SPF, DKIM, and DMARC records on the sending domain (SiteGround supports DKIM); verify with a mail-tester score of 9–10 before launch. Host limit: 400 emails/hour on the current plan — far above notification volume; the Action Scheduler queue still throttles to stay under it as a safety net. All sends queued via Action Scheduler (single retry on failure, then logged). **Fallback path:** because all sending goes through the SMTP-plugin abstraction, switching to a transactional provider (SMTP2GO/Brevo) is a credentials-only config change — flip if notifications start landing in spam or volume needs grow (e.g., a future newsletter).

**Setup reference (follow at go-live):** SiteGround's official WordPress SMTP tutorial — https://my.siteground.com/support/tutorials/wordpress/use-smtp/ — covers creating the mailbox in Site Tools and wiring the SMTP plugin to it. Per SiteGround support: sending via a SiteGround email account over SMTP keeps you under SiteGround's mail limits (400/hour, 40 recipients/message on the current plan); an external provider substitutes its own limits.

| Trigger | Recipient | Content |
|---|---|---|
| Ticket created | Customer | "We've received your ticket *{subject}*." One button → magic-link URL to the thread. This is the customer's first access path — no account needed. |
| Agent public reply | Customer | "Your ticket *{subject}* has a new reply." One button → magic-link URL deep-linking to the thread. **No message content.** |
| Customer message / new ticket | Assigned agent (fallback: settings address) | Subject line + ticket link into wp-admin. Internal alert; may include snippet (vendor-side only). |
| Auto-close (system) | Customer | "Your ticket was closed after N days resolved. Reply link reopens within X days / open a new ticket." |

Debounce: max one customer notification per ticket per 10 minutes (agent sending three consecutive replies → one email).

---

## 8. Ticket lifecycle

```
open ──first agent view──▶ (stays open) ──agent reply──▶ awaiting_customer
awaiting_customer ──customer reply──▶ awaiting_agent ──agent reply──▶ awaiting_customer
any ──agent action──▶ resolved ──auto after N days (default 7)──▶ closed
resolved ──customer reply──▶ awaiting_agent (reopen)
closed ──▶ terminal; customer must open a new ticket
```

`resolved_at` drives the auto-close cron (daily). Status changes insert a `system` message so the thread shows its own history.

---

## 9. Admin UI & settings

Screens (mapped to chosen wireframe variants): **Inbox** — split-pane (TicketsB): filterable list left (status / priority / tier / assignee; "Pro" badge on verified), thread preview right. **Thread** — chat-feel (TicketDetailB): bubbles, internal-note toggle on composer (visually distinct, e.g. amber background), right sidebar = contact card (tier badge, plan, license status/expiry, sites) + env panel (WP/PHP/plugin versions, site URL) + ticket controls (status, priority, assignee). **Contacts** — table list (ContactsA slim): name, email, tier, plan, license status, open tickets, last activity; row → contact detail with ticket history. **Settings** — three groups:

| Group | Fields |
|---|---|
| Freemius | product_id, API bearer token, product secret key (stored encrypted via `wp_salt`-derived key), webhook URL (read-only display), backfill button + progress |
| Email | From name/address, agent fallback address, notification debounce window, auto-close days |
| Tickets | Categories list, default priorities per tier, guard numbers (open-ticket caps, turn allowance, silent ceiling) — defaults per §4, editable |

Roles: new capability `crm_manage_tickets` granted to Administrator by default; assignable to other roles. No customer-facing WP accounts anywhere.

### 9.1 Customer-facing portal & floating launcher

**Portal page** (`/support/`): new-ticket form (email, name, subject, category, message, optional license key, optional env fields, honeypot), "View my tickets" email box (§5.6), ticket list, and the chat-style thread view with 15 s polling and composer lock states.

**Floating launcher** (loaded on all frontend pages of the vendor site): a small bottom-right bubble that opens an in-place panel — a **native panel rendering the same views via the same REST endpoints** (`POST /tickets`, `GET /tickets`, `GET/POST /tickets/{id}/messages`), sharing the session cookie since everything is same-origin. State-aware: active session → ticket list / open thread; no session → new-ticket form + email box. *Implementation alternative to evaluate at coding time:* a compact same-origin iframe of the portal page (`?compact=1` layout) — maximizes code reuse at the cost of iframe quirks; native panel is the primary approach.

**Async framing (required copy/design):** the launcher is labeled "Support" or "Leave a message" — never "Chat"; no online/offline presence indicator; the panel opens with "We usually reply within a few hours — you'll get an email when we do." This sets message-style expectations consistent with the async model (no realtime transport in v1).

---

## 10. Security & abuse controls

- **Rate limits (public endpoints):** ticket creation 5/hour/IP and 3/day/email for unverified (verified bypass to 20/day); messages 30/day/contact unverified; magic-link 3/hour/email. Transient-based counters; `429` with `Retry-After`.
- **Honeypot** field on widget/portal forms (fake success on trip).
- **Input handling:** all writes through `$wpdb->prepare`; `body` sanitized with `wp_kses` minimal whitelist (links, code, line breaks); output escaped on render; URLs in customer messages rendered `rel="nofollow noopener"`.
- **Identity:** never trust client claims — license/install verified server-side (§6.2); ownership checks on every thread read/write; internal notes excluded from all public responses at the query level, not the template level.
- **Tokens:** 32 random bytes (`random_bytes`) → URL-safe base64; only SHA-256 hashes stored; magic links single-use, 48 h; sessions 30 days, HttpOnly/Secure/SameSite=Lax; logout invalidates the row.
- **Webhook:** HMAC validation (§6.1) + idempotent handlers.
- **Uninstall:** `uninstall.php` honors a "delete all data on uninstall" setting (default off).
- **Privacy (GDPR/data protection):** tables store personal data (names, emails, message content, site URLs) on the vendor's own server — no third-party processor beyond the mail relay. Mention the support system in the site privacy policy. Handle data-subject requests by email lookup: export = contact + tickets + messages dump; delete = anonymize contact and message bodies while keeping ticket rows for record integrity. No tracking cookies — the session cookie is strictly functional.
- **Internationalization:** all customer-facing portal/launcher/email strings use a text domain and are translatable; admin UI may remain English-first.

---

## 11. Build phases & acceptance

| Phase | Contents | Done when |
|---|---|---|
| 1 — Foundation | Tables + migrations (dbDelta with stored schema version), bundled Action Scheduler library, settings screen, webhook receiver + signature validation, backfill job | Existing Freemius customers appear as contacts; a test purchase/cancel updates tier within seconds |
| 2 — Tickets core | §5 public + admin routes, guard matrix, admin inbox + thread UI | Full conversation round-trip via REST client; guards return 409/423 correctly per tier |
| 3 — Touchpoints | Portal: ticket form (tier resolution + lock states), "My tickets", thread view, magic-link auth; floating launcher + native in-place panel (§9.1) | A customer can open a ticket from the floating panel on any page with email alone, get auto-verified as pro, hit the turn limit, and resume via the emailed link |
| 4 — Notifications & hardening | Email queue + templates + debounce, auto-close cron, rate limits, security pass, uninstall | Reply notice lands in inbox (not spam) with working deep link; abuse attempts throttled |

## 12. Go-live checklist

Run in order when pushing the plugin to production:

1. **Email transport** — create the `support@` mailbox in Site Tools; configure FluentSMTP / WP Mail SMTP following the SiteGround tutorial (link in §7); confirm SPF, DKIM, DMARC records in DNS; send a test through mail-tester.com and require a 9–10 score; trigger one real ticket-confirmation email end to end and verify the magic link works.
2. **Freemius wiring** — enter product_id, API bearer token, and product secret key in settings; register the webhook URL in the Freemius Developer Dashboard; fire a sandbox/test event and confirm signature validation passes and the contact updates; run the backfill job and spot-check a handful of known pro customers for correct tier/plan/expiry.
3. **Scheduler reliability** — replace default WP-cron with a real server cron (Site Tools cron job hitting `wp-cron.php` every 5 minutes, `DISABLE_WP_CRON` in wp-config) so Action Scheduler email/queue jobs and the auto-close cron run on time regardless of site traffic.
4. **Security pass** — confirm HTTPS is forced site-wide; rate limits and honeypot active on `POST /tickets` and `POST /auth/magic-link`; capability checks on all admin routes; "delete data on uninstall" setting is off; expired-token purge cron scheduled.
5. **Portal & launcher** — magic-link round trip on production (fresh link, expired link, reused link); floating launcher appears on all frontend pages with the async framing copy; turn-limit and open-ticket-cap lock states render correctly for a free-tier test contact.
6. **Rollback safety** — full DB backup immediately before activation; schema version recorded in options so future migrations are incremental.

## 13. Deferred (designed-for, not built)

Candidates for later versions, in rough priority order. None requires schema or endpoint changes beyond what's noted.

| Feature | What it adds | Design hook already in place |
|---|---|---|
| Knowledge base / FAQ | Self-serve answers that deflect repeat tickets — link it from the portal and the floating panel ("Check our docs first") | Can start as plain WP pages/CPT; zero CRM changes. Later: log portal searches to learn which articles to write |
| CSAT ratings | One-click "How did we do?" on resolved tickets — the simplest quality signal for support | Hook into the resolved-notification email or thread view; one small `crm_ratings` table (ticket_id, score, comment) |
| Admin reporting | Volume over time, first-response/resolution times, tickets per tier, per-category breakdown | All derivable from existing `created_at` / `last_activity_at` / status timestamps — read-only queries, no schema change |
| In-plugin support widget | Support tab inside the pro plugin with auto-collected identity/env | Becomes a second client of `POST /tickets`; `source='widget'` enum and `fs_install_id` column already reserved |
| Newsletter composer | Campaigns to contacts, segmentable by tier/plan | Same SMTP pipe + contacts table; switch transport to a transactional provider before any bulk sending |
| Attachments | Screenshots/logs on tickets | Touches storage, upload validation, and REST — scoped deliberately out of v1 |
| Two-way email piping | Customers reply from their inbox | Needs inbound webhook (Postmark/Mailgun) + per-ticket reply-to addresses |
| Multi-product UI | Filters/scoping when a second plugin ships | Schema already scoped by `product_id` everywhere |
| Realtime transport | Live updates instead of 15 s polling | Swap polling for a hosted WebSocket service (Pusher/Ably); endpoints unchanged |

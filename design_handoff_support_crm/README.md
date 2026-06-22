# Handoff: Support CRM (WordPress plugin)

## Overview
A self-hosted WordPress support CRM for a Freemius-sold plugin. It has two faces:

1. **Agent side (wp-admin):** a support inbox, chat-style ticket thread with a Freemius/environment sidebar, a contacts directory, and a settings screen.
2. **Customer side (vendor-site frontend):** a public support portal (ticket form, "my tickets", magic-link thread view) plus a site-wide floating support launcher.

The full product/technical specification lives alongside this README in **`support-crm-spec.md`** — it is the source of truth for data model, REST API, guard rules, Freemius sync, notifications, lifecycle, and security. **Read it first.** This README documents the *visual design* and *front-end behavior* the prototype expresses, so the two together fully describe what to build.

---

## About the Design Files
The files in `design/` are **design references created in HTML/React+Babel** — interactive prototypes showing the intended look and behavior. **They are not production code to copy directly.** They render in a browser via in-page Babel transpilation with mock data; there is no backend, no real routing, and no build step.

Your task is to **recreate these designs inside the real plugin codebase** using its established environment and patterns:

- **Admin UI:** plain PHP-rendered admin pages styled to match WordPress admin (the prototype deliberately mimics core wp-admin classes — `.button`, `.button-primary`, `.form-table`, `.nav-tab-wrapper`, `.notice`, `.wp-list-table`). Reuse WordPress's native admin styles where they exist instead of re-deriving them. Dynamic areas (inbox split-pane, thread polling) can be a small React/Preact/vanilla island mounted into the admin page, talking to the REST API.
- **Portal + launcher:** frontend rendering on the vendor WordPress theme. The launcher is loaded site-wide and is the primary same-origin client of the REST API (§9.1 of the spec).

If you choose to introduce a framework for the dynamic islands, pick what fits the plugin's existing tooling — the design does not require any specific one.

---

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, badge system, and interaction states are all specified below and present in the prototype CSS. Recreate the UI to match. Where the prototype reuses WordPress admin conventions, prefer the real wp-admin styles (they will be visually equivalent and more correct across WP versions/themes).

---

## How to run the prototype
Open `design/Support CRM.html` in a browser. A dark top bar lets you switch between every screen, grouped as **Admin · wp-admin**, **Customer portal**, and **Launcher**. Some screens have an in-canvas toggle (e.g. the portal thread has Active/Locked composer; the launcher has No-session / My-tickets / Open-thread).

File map:
- `Support CRM.html` — shell: all CSS (in `<head>`), font + React/Babel script tags, mount point.
- `hi-kit.jsx` — shared primitives: `Icon`, `Status`, `Priority`, `Tier`, `Badge`, `Dot`, and the two shells `WP` (admin chrome) and `Portal` (frontend chrome).
- `hi-admin.jsx` — `Inbox`, `Thread`, `Contacts`, `Contact`, `Settings`.
- `hi-portal.jsx` — `PortalNew`, `MyTickets`, `PortalThread`, `PortalAuth`, `PortalExpired`, `PortalEmpty`, `PortalCap`.
- `hi-launcher.jsx` — `Launcher` (floating bubble + in-place panel, three view states).
- `hi-app.jsx` — prototype router/chrome only; **not** part of the product.

---

## Design Tokens

All tokens are defined as CSS custom properties in `Support CRM.html` `:root`. The palette intentionally tracks the WordPress admin color scheme so the admin UI feels native.

### Colors
| Token | Hex | Use |
|---|---|---|
| `--wp-blue` | `#2271b1` | Primary action, links, active menu, selection |
| `--wp-blue-d` | `#135e96` | Primary hover, link-strong text |
| `--wp-blue-l` | `#72aee6` | Admin-bar hover text |
| `--wp-ink` | `#1d2327` | Primary text, sidebar bg |
| `--wp-ink2` | `#2c3338` | Sidebar submenu bg |
| `--wp-ink3` | `#3c434a` | Bubble body text |
| `--g1`…`--g4` | `#50575e` `#646970` `#8c8f94` `#a7aaad` | Text greys, muted, placeholders |
| `--line` / `--line2` / `--line3` | `#dcdcde` / `#e0e0e0` / `#f0f0f1` | Borders, dividers, hairlines |
| `--bg` | `#f0f0f1` | Admin content background |
| `--card` | `#fff` | Panels, tables, cards |
| `--sidebar` / `--sidebar2` | `#1d2327` / `#2c3338` | Admin menu / submenu |
| `--green` / `--green-bg` / `--green-line` | `#00a32a` / `#edfaef` / `#b8e6bf` | Resolved, license-active |
| `--red` / `--red-bg` / `--red-line` | `#d63638` / `#fcf0f1` / `#f1adad` | Critical priority, errors |
| `--amber` / `--amber-bg` / `--amber-line` | `#dba617` / `#fcf9e8` / `#f0e1a8` | Awaiting-agent, high priority, warnings |
| `--amber-note` | `#fbf6e3` | Internal-note bubble + note composer bg |
| Pro badge | bg `#fff7ed`, text `#9a3412`, border `#fed7aa` | "★ Pro" tier badge |
| Awaiting-customer (blue badge) | bg `#f0f6fc`, text `#135e96`, border `#c5d9ed` | Status badge |

### Typography
- **Sans (UI):** `--sans` = system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif`) — i.e. the WordPress admin font.
- **Mono:** `--mono` = `"SF Mono", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace` — used for IDs, emails, env values, "kicker" labels.
- Base admin font-size **13px**. Portal base **14px**.
- Key sizes: admin page title `23px/400`; portal H1 `30px/800` (`-.025em`); section/subhead `13–15px`; badges `11.5px/500`; "kick" labels `10px` mono, uppercase, `.12em` tracking, color `--g3`.

### Spacing / radius / shadow
- Spacing is a simple `gap` scale: `4 6 8 10 12 14 16 20 24 px` (utility classes `.g4`…`.g24`).
- Radius: admin `--radius: 4px` (buttons/inputs `3px`); portal cards `8–14px`; launcher panel `16px`; bubble/avatars `50%`.
- Shadows: `--shadow-sm` `0 1px 1px rgba(0,0,0,.04)`; `--shadow` `0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06)`; `--shadow-lg` `0 12px 40px rgba(0,0,0,.16)`; launcher panel `0 20px 60px rgba(0,0,0,.28)`; launcher bubble `0 10px 30px rgba(34,113,177,.4)`.

---

## Shared components (`hi-kit.jsx`)

### Status badge (`Status`)
Maps ticket status → label + color. **Labels differ by audience** (the `admin` prop):
| status | customer label | admin label | color | dot |
|---|---|---|---|---|
| `open` | Open | Open | grey | `#8c8f94` |
| `awaiting_agent` | Awaiting agent | Awaiting agent | amber | `#dba617` |
| `awaiting_customer` | **Awaiting you** | **Awaiting customer** | blue | `#2271b1` |
| `resolved` | Resolved | Resolved | green | `#00a32a` |
| `closed` | Closed | Closed | grey | `#8c8f94` |

Each badge = colored dot + label, in a tinted pill (`b-grey/b-amber/b-blue/b-green/b-red`).

### Priority badge (`Priority`)
`low`→grey, `normal`→grey, `high`→amber, `critical`→red. Labels capitalized.

### Tier badge (`Tier`)
`pro` → "★ Pro" (the orange Pro badge); `free` → "Free" (grey). Pro styling is the verified/prioritized signal used throughout admin and portal.

### Icons (`Icon`)
Inline SVG line/solid icon set (24×24 viewBox, `stroke-width 1.7`). Names used: `dash post page media appearance ticket plug gear search back chev arrow lock note send check mail clock user users copy filter bell flag ext refresh warn hourglass chat inbox doc pin x`. In production, swap for the codebase's icon set (or WordPress Dashicons for admin) — match weight/size, not the exact paths.

### Shells
- **`WP`** — admin chrome: top admin bar ("Howdy, Alex Rivera"), left menu (Dashboard/Posts/…/**Support** active, with submenu Inbox/Contacts/Settings), content area. In production this is just WordPress admin — register a top-level "Support" menu + submenus; don't rebuild the chrome.
- **`Portal`** — frontend chrome: header (brand "SublimeTheme" + nav Home/Features/Pricing/Docs/Support, "Get the plugin" CTA), `#f6f7f8` main area, footer. In production this is the vendor theme; render portal content into a page template.

---

## Screens / Views

> Exact mock copy is included so flows read correctly; replace brand/sample names ("SublimeTheme", "Alex Rivera", "Jane Doe", ticket #481) with real data.

### ADMIN

#### 1. Inbox (`Inbox`) — maps to spec §9 "Inbox", `GET /admin/tickets`
- **Layout:** page title "Support Inbox" + "6 open" pill; subhead; **filter toolbar**; then a **split panel, fixed height ~600px**: left list **384px** (fixed) with a header row ("N tickets" + "Sort: Smart"), scrollable list below; right **reading pane** (flex) with a header (subject, #id, tier/status/priority/category badges, "Open full thread" primary button) + a read-only thread preview + a footer strip directing real replies to the full thread view.
- **Filter toolbar:** four selects — Status (All/Open/Awaiting agent/Awaiting customer/Resolved), Priority (All/Critical/High/Normal/Low), Tier (All/Pro–verified/Free), Assignee (All/Me/Unassigned) — plus a search input ("Search subject or email…"). Default sort is "Smart" = float verified + priority (spec §5.9).
- **List item:** top row = Tier badge + (Critical priority badge if critical) + right-aligned `#id · time` kicker; subject (13.5px/600); one-line `who — preview` (clamped); bottom row = Status badge + (non-critical/non-low priority badge) + right-aligned "N new" unread pill (blue). Active item: `#f0f6fc` bg + 3px left blue border.
- **States:** selected item drives the reading pane. Unread count badge when `unread > 0`.

#### 2. Thread (`Thread`) — spec §9 "Thread", `GET/POST /admin/tickets/{id}`
- **Layout:** back-to-inbox button + "Ticket #481" kicker; full subject as page title; then a **row: thread panel (flex, ~630px tall) + 300px sidebar**.
- **Thread panel:** header (tier/status/priority/category + "Assigned to you"); scrollable message area; **composer** pinned at bottom.
  - **Messages:** customer messages left (grey "cust" avatar, white bubble); agent messages right (`.me`, blue avatar, light-blue bubble `#f0f6fc`); **internal notes** full-width amber bubble (`--amber-note` bg, amber avatar with note icon, "only visible to agents"); **system messages** = centered hairline-divider text ("ticket opened · status set to awaiting_agent").
  - **Composer:** two tabs — **"Reply to customer"** (white) and **"Internal note"** (amber, lock icon). Switching modes recolors the whole composer (white ↔ `--amber-note`) and the textarea border. Reply mode shows "Customer gets a link-only email" + "Notification queued via Action Scheduler — no content, link only"; note mode shows "Not emailed · agents only". Buttons: "Canned reply" + primary **Send reply** / **Save note**. (Per spec: non-note reply sets status `awaiting_customer` + queues a *content-free* customer email; internal note does neither.)
- **Sidebar (3 panels):**
  1. **Customer** — avatar, name, email (mono), Tier + "License active" badges, then key/value rows: Plan, License (masked `sk_live_••••a31f`), Expires, Active sites, Freemius ID, Customer since. Footer "Synced from Freemius · read-only" (this panel is read-only mirror of `wp_crm_contacts`).
  2. **Environment** — Site, Install, WordPress, PHP, Plugin (mono values). "Provided on the submission form." (= the optional `env` JSON, user-supplied — no auto-collection in v1.)
  3. **Manage** — Status / Priority / Assignee selects + **Resolve** (primary) and **Close** buttons. Drives `PATCH /admin/tickets/{id}`.

#### 3. Contacts (`Contacts`) — spec §9 "Contacts", `GET /admin/contacts`
- Page title + **"Run Freemius backfill"** button; subhead; filter toolbar (reused); **table**: avatar, Name (blue-strong), Email (mono muted), Tier badge, Plan, License badge (dot + status, capitalized), Open count (blue pill if >0), Last activity, chevron. Rows clickable → Contact detail. Footer: "Showing N of N · synced X ago via webhook".

#### 4. Contact detail (`Contact`)
- Back button; **row: 300px profile card + ticket-history panel**.
- **Profile card:** avatar, name, email, Tier + License badges, key/values (Plan, Freemius ID, Active sites, Lifetime value, Customer since), "View in Freemius" button.
- **Ticket history:** panel header "Ticket history · N total"; table (#, Subject, Status, Priority, Updated, chevron); rows → Thread.

#### 5. Settings (`Settings`) — spec §9 table
Three tabs (`nav-tab-wrapper`): **Freemius**, **Email**, **Tickets & guards**.
- **Freemius:** Product ID, API bearer token (password), Product secret key (password, "Encrypted at rest"), Webhook URL (read-only + copy button, value `…/wp-json/yourcrm/v1/fs-webhook`). Success notice "Connected. Last webhook … · N contacts synced." "Run one-time backfill" button + helper. **Gap to add (spec §6.3):** a *progress meter* for the backfill (resumable, stores last page) — prototype only shows the trigger.
- **Email:** From name, From address, Agent fallback address, Notification debounce (minutes, default 10), Auto-close after (days resolved, default 7). Warning notice: transport via `wp_mail`/SMTP plugin; "Customer emails never contain message content — magic-link buttons only."
- **Tickets & guards:** Categories (comma list, default `technical, billing, feature, presale, bug`), Default priority per tier (Free→Low, Pro→Normal), and the **Guard matrix table**: Max open tickets (Free **1** → returns existing/409, Pro **5** → soft cap), Messages per turn (Free **3** → composer locks/423, Pro "No visible limit · silent ceiling 10"). All editable. Save bar at bottom.
- **Gaps to add (in spec, not yet in mock):** a "Delete all data on uninstall" toggle (§10, default off), and capability assignment for `crm_manage_tickets` (§9).

### CUSTOMER PORTAL

#### 6. New ticket (`PortalNew`) — spec §5.2 `POST /tickets`, §9.1
- Wide layout. H1 "How can we help?"; subhead with "View your tickets →" link. **Row: form card (flex) + 280px sidebar.**
- **Form fields:** Email + Name(optional) row; Subject + Category(select, the 5 categories) row; "How can we help?" textarea; **License key** (optional — "only if your support email differs from your purchase email"); collapsible **"+ Add environment details"** (Site URL, WP, PHP, Plugin). Submit (primary) + "We usually reply within a few hours." **Honeypot:** an off-screen `company_url` input must be present and must trigger fake-success when filled (spec §10).
- **Sidebar cards:** "Before you post" (docs deflection — search docs button); "★ Pro — Faster replies" (blue card: use purchase email → auto-verified, no key needed); a privacy note (lock icon).

#### 7. My tickets (`MyTickets`) — spec §5.3, session auth
- Header "My tickets" + "Signed in as {email} · Sign out" + "+ New ticket". Card list: each row = `#id` kicker + "N new reply" pill, subject (15.5px/700), Status + Priority + "Updated {time}", chevron. Rows → portal thread.

#### 8. Portal thread (`PortalThread`) — spec §5.4/§5.5, polls every 15s
- Crumb + subject (24px) + #id; status/priority/category badges. **Card:** scrollable thread (max-height ~340px) + composer.
  - Customer messages right-aligned blue ("You"); agent messages left ("SublimeTheme"). Bottom sysmsg "updates automatically — checking for replies" (= the 15s poll, paused on tab hidden).
  - **Two composer states (the key interaction):**
    - **Active:** textarea + "N of 3 replies left before an agent responds" + Send.
    - **Locked (free, turn limit hit, §4):** dashed card, lock icon, "Thanks — we've received your messages / You'll get an email the moment we reply. You'll be able to respond again once we've gotten back to you." (HTTP 423 `crm_turn_limit`.)
  - Prototype exposes a toggle to preview both; in production the state comes from the API `composer: { locked, reason, notice }`.

#### 9. Sign in / magic link (`PortalAuth`) — spec §5.6
- Card, two states. **Request:** "View your tickets", "No password needed", email field, "Email me a sign-in link". **Sent:** mail icon, "Check your inbox", "If that address has tickets, a sign-in link is on its way. The link works once and expires in 48 hours." + "Use a different email". Footer: "we never confirm whether an email has an account" (anti-enumeration; API always 200).

#### 10. Expired link (`PortalExpired`) — spec §5.7 fallback
- Amber hourglass, "This link has expired", "Sign-in links can be used once and expire after 48 hours.", email field + "Send a new link".

#### 11. Empty state (`PortalEmpty`)
- Inbox icon, "No tickets yet", helper, "Open your first ticket".

#### 12. Open-ticket cap (`PortalCap`) — spec §4/§5.2, HTTP 409
- New-ticket page with an **amber banner** replacing the form: "You already have an open ticket / Free accounts keep one open ticket at a time…", then a card linking to the existing ticket (#id + status + subject + "Go to my ticket"). Footnote: pro customers get up to 5 and a softer message.

### LAUNCHER

#### 13. Floating launcher (`Launcher`) — spec §9.1
- Bottom-right **60px circular bubble** (blue, chat icon; toggles to × when open). Opens a **380px panel** (radius 16px) above it.
- **Header:** gradient blue, "**Support**" + "**We usually reply within a few hours**", close ×. **Async framing is required (spec §9.1): label "Support"/"Leave a message", never "Chat"; no online/offline presence dot.**
- **Three view states** (state-aware on session):
  - **No session (`new`):** compact form (Email, Subject, Message) + "Send message" + "Already have a ticket? Sign in →".
  - **My tickets (`list`):** "+ New" + compact ticket rows (#id, "N new" pill, subject, status).
  - **Open thread (`thread`):** back chevron, #id + subject, compact message bubbles, inline reply input + send.
- Uses the **same REST endpoints** as the portal, sharing the session cookie (same-origin). It is a *native panel* (primary approach), not an iframe.
- **Gap to consider (spec §9.1):** a "Check our docs first" link in the panel (the full portal has the docs card; the launcher doesn't yet).

---

## Interactions & Behavior
- **Navigation:** Inbox list select → reading pane; "Open full thread" → Thread; Contacts/Contact rows → Thread; portal ticket rows → Portal thread; portal "View your tickets" → Sign in.
- **Composer mode (admin thread):** Reply ↔ Internal note retints the composer (white ↔ amber) and changes helper text + submit label. Internal notes never email the customer and never change status.
- **Composer lock (portal thread):** free tier locks after 3 consecutive customer messages since the last agent reply; shows the lock card; unlocks when an agent replies. Source of truth = API `composer` object.
- **Magic-link auth:** request form → "check your inbox" confirmation (always, regardless of match). Expired/used link → expired screen → re-request.
- **Polling:** portal thread + launcher thread poll `GET /tickets/{id}` every 15s; **pause when `document.hidden`** (`visibilitychange`). Mark agent messages read on view.
- **Backfill:** Settings/Contacts "Run backfill" kicks the Action Scheduler job chain; show a resumable progress meter (to be added).
- **Transitions:** subtle only — composer bg/border `.15s`, pill/button hovers `.12s`. No decorative animation.

## State Management (front-end islands)
- **Inbox:** `selectedTicketId`; ticket list + filters (server-fetched). 
- **Admin thread:** `composerMode: 'reply'|'note'`; ticket + messages (poll); pending status/priority/assignee edits.
- **Portal thread:** `composer.locked` + `reason` + `notice` from API; messages (poll).
- **Magic-link / launcher:** `sent` boolean; launcher `open` + `view: 'new'|'list'|'thread'`; session presence.
All ticket/contact/message/guard data comes from the REST API in `support-crm-spec.md` §5 — the API is the source of truth; the UI only mirrors guard/lock state.

## Assets
- **No raster image assets.** All iconography is inline SVG (`hi-kit.jsx` `Icon`). Replace with the codebase's icon set / WordPress Dashicons.
- Avatars are CSS circles with initials. The "SublimeTheme" brand mark is a CSS rounded square with an "S".
- Fonts are system stacks (no web-font files to ship).

## Screenshots
PNG references for every screen are in `screenshots/` (1080px wide, captured from the prototype). The top dark bar in each image is the prototype's screen-switcher — **ignore it; it is not part of the product.**
- `admin-01-inbox.png` · `admin-02-thread.png` · `admin-03-contacts.png` · `admin-04-contact-detail.png` · `admin-05-settings.png`
- `portal-06-new-ticket.png` · `portal-07-my-tickets.png` · `portal-08-thread.png` · `portal-09-signin.png` · `portal-10-expired-link.png` · `portal-11-empty.png` · `portal-12-cap-reached.png`
- `launcher-13-floating-panel.png`

## Files in this bundle
- `support-crm-spec.md` — **the full technical spec (data model, REST API, guards, Freemius, notifications, lifecycle, security, phases, go-live).** Primary reference.
- `design/Support CRM.html` — prototype shell + all CSS + tokens.
- `design/hi-kit.jsx` — shared primitives + shells (badges, icons, WP/Portal chrome).
- `design/hi-admin.jsx` — Inbox, Thread, Contacts, Contact, Settings.
- `design/hi-portal.jsx` — portal screens (new, my-tickets, thread, auth, expired, empty, cap).
- `design/hi-launcher.jsx` — floating launcher.
- `design/hi-app.jsx` — prototype router only (ignore for production).

## Known design gaps vs. spec (intentionally listed so you don't miss them)
1. **Backfill progress meter** (spec §6.3) — Settings/Contacts show only the trigger.
2. **"Delete all data on uninstall" toggle** (§10) — not in Settings yet.
3. **`crm_manage_tickets` capability assignment UI** (§9) — not in Settings yet.
4. **Launcher docs-deflection link** (§9.1) — present in portal, not in the launcher panel.

These are additive; everything else in the spec has a corresponding design.

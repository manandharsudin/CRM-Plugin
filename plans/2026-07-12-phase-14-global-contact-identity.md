# Phase 14 — Global Contact Identity Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a SublimeCRM contact represent one real person globally (keyed by email alone), not one row per `(product_id, email)` — fixing the duplicate-Contacts-list-row bug and eliminating the `product_id=0` shell-contact hack, while keeping the free-tier open-ticket cap per-product.

**Architecture:** `wp_stcrm_contacts` is rewritten to person-level fields only (`email` UNIQUE, `name`, `fs_user_id`). A new `wp_stcrm_contact_products` table holds everything product-specific (`tier`, `plan`, `license_key_hash`, `license_status`, `license_expires`, `sites_count`, `verification_pending`), one row per `(contact_id, product_id)`. Every code path that resolves "the contact for this email+product" becomes a two-step lookup: find-or-create the global contact by email, then find-or-create/update its `contact_products` row for the specific product. No migration code ships — this local site's data is disposable test data (confirmed with the user); `install()` just defines the new schema going forward, and this site's 4 tables get reset once, manually, outside any code path that ships in the plugin.

**Tech Stack:** PHP 8.2+ (WordPress plugin, `wp_stcrm_*` custom tables via `dbDelta()`), vanilla `$wpdb` queries (no ORM), React 18 (`@wordpress/element`) for the two customer-facing islands touched here.

## Global Constraints

- This plugin has no PHPUnit suite. Every task's "test" is a disposable PHP-CLI assertion script (`require 'wp-load.php'` from the plugin root, real DB round-trips against the actual local install), run via the project's Bash tool, then deleted or left in the scratchpad — matching how every prior phase in this project was verified. Do not introduce a new `tests/` directory or PHPUnit bootstrap; that would be an unrequested architecture change.
- Every PHP file touched must pass `php -l` before being considered done.
- Every JS/JSX file touched requires `npm run build` (run from `wp-content/plugins/sublime-crm/`) before Playwright verification — this plugin ships pre-built `admin/js/*.js` bundles, not source-served.
- No DB migration code ships in the plugin (per the approved design) — `install()`'s table definitions simply describe the new schema; this local site's `wp_stcrm_contacts`, `wp_stcrm_tickets`, `wp_stcrm_messages`, `wp_stcrm_tokens` tables are reset once, manually, as Task 3 below — never as an automatic step inside `STCRM_Database::install()`.
- Contacts are looked up by lowercased email throughout the existing codebase (`strtolower( sanitize_email( $email ) )` at every call site) — preserve this exactly; do not introduce a case-sensitive lookup anywhere.
- The free-tier open-ticket cap (`STCRM_Guard_Matrix::check_ticket_cap()`) stays scoped `WHERE contact_id = X AND product_id = Y` — do not widen it to a global per-person cap. This was an explicit, confirmed design decision, not an oversight.
- All test data created during verification (contacts, tickets, messages, tokens, WP users) must be deleted at the end of each task's verification step, and confirmed gone via a follow-up query — matching this project's established hygiene standard.

---

## File Map

| File | Change |
|---|---|
| `includes/Database/class-stcrm-database.php` | Schema rewrite (`create_contacts_table()`, new `create_contact_products_table()`); `upsert_contact()` split into `upsert_contact()` (person-only) + new `upsert_contact_product()`; `get_contact_by_email()` drops `$product_id`; `get_contacts_by_email()` deleted; `get_contact_by_license_key_hash()`/`get_contact_by_fs_user_id()` rewritten to JOIN `contact_products`; `get_admin_contacts()`/`count_contacts()`/`get_contacts_last_updated()`/`get_tickets_by_contact()` rewritten |
| `includes/Services/class-stcrm-tier-resolver.php` | `resolve()`, `resolve_free_product()`, `resolve_via_license_key()`, `reverify_contact()`, `verified_result()`/`unverified_result()` rewritten for the two-step lookup |
| `includes/Services/class-stcrm-freemius-sync.php` | `handle_install_event()`, `handle_user_updated()`, `handle_license_status_change()` rewritten to write `contact_products`, not `contacts` |
| `includes/Services/class-stcrm-backfill.php` | `process_single_install()` — one call-site update |
| `api/class-stcrm-tickets-controller.php` | `create_ticket()`'s shell/unknown-contact branch — one call-site update |
| `api/class-stcrm-auth-controller.php` | `request_magic_link()`, `login_wp_account()` — shell-contact call sites simplify; stray "Phase 14" comment renamed |
| `api/class-stcrm-session-auth.php` | `get_contact_ids()` collapses; `attach()` simplifies (no more sibling-contact expansion); SSO fallback call site simplifies; stray "Phase 14" comment renamed |
| `admin/class-stcrm-admin.php` | `render_contacts_page()`, `render_contact_detail_page()` rewritten for one-row-per-person |
| `src/portal/AuthView.jsx`, `src/portal/NewTicketView.jsx`, `blocks/support-portal/render.php` | Stray "Phase 14" comment/label renamed only — no behavior change |
| `src/portal/SetPasswordPrompt.jsx` | **New** — extracted from `MyTicketsView.jsx` |
| `src/portal/MyTicketsView.jsx` | Import `SetPasswordPrompt` from the new shared file instead of defining it locally |
| `src/portal/EmptyView.jsx` | Render `SetPasswordPrompt` too |
| `sublime-crm.php` | `STCRM_DB_VERSION` bump |

---

### Task 1: Rename the stray "Phase 14" label before it collides with the real one

`class-stcrm-session-auth.php` and 5 other files use "Phase 14" as an informal label for the 2026-07-08 WP-login SSO / shell-contact bugfix — predating this actually-numbered Phase 14 in `phase-plan-clickup.md`. Left alone, this becomes genuinely confusing once real Phase 14 work lands in the same files. Do this first, before any functional changes, so later diffs in this plan aren't cluttered by an unrelated find-and-replace.

**Files:**
- Modify: `api/class-stcrm-session-auth.php:14`, `api/class-stcrm-auth-controller.php` (grep for "Phase 14"), `src/portal/AuthView.jsx` (grep for "Phase 14"), `src/portal/NewTicketView.jsx` (grep for "Phase 14"), `blocks/support-portal/render.php` (grep for "Phase 14"), `CLAUDE.md` (grep for "Phase 14" — changelog entries only, leave historical text as written, do not edit past changelog prose)

- [ ] **Step 1: Find every occurrence**

Run: `grep -rn "Phase 14" wp-content/plugins/sublime-crm --include=*.php --include=*.jsx`

Expected: matches in `api/class-stcrm-session-auth.php`, `api/class-stcrm-auth-controller.php`, `src/portal/AuthView.jsx`, `src/portal/NewTicketView.jsx`, `blocks/support-portal/render.php`. Do NOT touch matches inside `CLAUDE.md`'s changelog (those are a historical record of what was said on 2026-07-08 and must not be rewritten).

- [ ] **Step 2: Replace each in-code label**

In `api/class-stcrm-session-auth.php`, change:
```php
 * Phase 14 — WP-login SSO: when no stcrm_session cookie is present (or it's
```
to:
```php
 * WP-login SSO (added 2026-07-08): when no stcrm_session cookie is present (or it's
```

And further down in the same file:
```php
		// Phase 14 — WP-login SSO fallback: no valid stcrm_session cookie, but
```
to:
```php
		// WP-login SSO fallback (2026-07-08): no valid stcrm_session cookie, but
```

Apply the same "Phase 14" → "2026-07-08 WP-login SSO / shell-contact bugfix" substitution to every remaining in-code comment match in `api/class-stcrm-auth-controller.php`, `src/portal/AuthView.jsx`, `src/portal/NewTicketView.jsx`, and `blocks/support-portal/render.php` — read each surrounding comment first so the replacement reads naturally in context, don't do a blind string replace.

- [ ] **Step 3: Confirm no remaining ambiguous references**

Run: `grep -rn "Phase 14" wp-content/plugins/sublime-crm --include=*.php --include=*.jsx`
Expected: no output (all in-code comment references renamed).

- [ ] **Step 4: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l api/class-stcrm-session-auth.php && php -l api/class-stcrm-auth-controller.php`
Expected: `No syntax errors detected` for both.

- [ ] **Step 5: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add -A
git commit -m "Rename stray 'Phase 14' code-comment label before the real Phase 14 lands

An earlier bugfix (2026-07-08, WP-login SSO / shell-contact auto-login)
used 'Phase 14' as an informal in-code label, predating the actually
numbered Phase 14 (Global Contact Identity Model) now starting. Renamed
to avoid confusion once real Phase 14 work touches these same files."
```

---

### Task 2: Rewrite the schema

**Files:**
- Modify: `includes/Database/class-stcrm-database.php:91-119` (`create_contacts_table()`)
- Modify: `sublime-crm.php:22` (`STCRM_DB_VERSION`)

**Interfaces:**
- Produces: `wp_stcrm_contacts(id, email UNIQUE, name, fs_user_id, created_at, updated_at)`; `wp_stcrm_contact_products(id, contact_id, product_id, tier, plan, license_key_hash, license_status, license_expires, sites_count, verification_pending, created_at, updated_at, UNIQUE(contact_id, product_id))`

- [ ] **Step 1: Rewrite `create_contacts_table()`**

Replace the entire method (currently lines 91-119 of `includes/Database/class-stcrm-database.php`, including its docblock) with:

```php
	/**
	 * wp_stcrm_contacts — one row per real person, globally (Phase 14, 2026-07-12).
	 *
	 * Previously scoped per (product_id, email) — rewritten so a person who
	 * touches multiple products gets exactly one row here, with everything
	 * product-specific (tier, license, plan, sites_count, verification_pending)
	 * moved to the new wp_stcrm_contact_products table. fs_user_id lives here,
	 * not per-product — Freemius assigns one user ID per person across every
	 * product they've bought from this vendor.
	 *
	 * @since 1.0.0
	 * @since 1.8.0 Phase 14 — rewritten to person-level fields only.
	 */
	private static function create_contacts_table( string $charset_collate ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contacts';

		$sql = "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL auto_increment,
  email varchar(190) NOT NULL DEFAULT '',
  name varchar(190) DEFAULT NULL,
  fs_user_id bigint(20) unsigned DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY email (email),
  KEY fs_user_id (fs_user_id)
) {$charset_collate};";

		dbDelta( $sql );
	}

	/**
	 * wp_stcrm_contact_products — one row per (contact, product) a person has
	 * actually engaged with (Phase 14, 2026-07-12). Holds everything that used
	 * to live directly on wp_stcrm_contacts before contacts became global:
	 * tier, plan, license verification state, site count. A person with no
	 * rows here yet (e.g. signed in via magic link, never filed a ticket) is
	 * fully represented by their bare wp_stcrm_contacts row — no more
	 * product_id=0 "shell contact" sentinel needed.
	 *
	 * @since 1.8.0
	 */
	private static function create_contact_products_table( string $charset_collate ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contact_products';

		$sql = "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL auto_increment,
  contact_id bigint(20) unsigned NOT NULL,
  product_id bigint(20) unsigned NOT NULL,
  tier enum('free','pro') NOT NULL DEFAULT 'free',
  plan varchar(100) DEFAULT NULL,
  license_key_hash varchar(64) DEFAULT NULL,
  license_status enum('none','active','expired','cancelled') NOT NULL DEFAULT 'none',
  license_expires datetime DEFAULT NULL,
  sites_count smallint(5) unsigned NOT NULL DEFAULT 0,
  verification_pending tinyint(1) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY contact_product (contact_id,product_id),
  KEY product_id (product_id),
  KEY license_key_hash (license_key_hash),
  KEY tier (tier)
) {$charset_collate};";

		dbDelta( $sql );
	}
```

- [ ] **Step 2: Wire the new table into `install()`**

In `includes/Database/class-stcrm-database.php`, find:
```php
		self::create_contacts_table( $charset_collate );
		self::create_tickets_table( $charset_collate );
		self::create_messages_table( $charset_collate );
		self::create_tokens_table( $charset_collate );

		if ( version_compare( $installed, '1.0.5', '<' ) ) {
			self::backfill_status_change_messages_internal();
		}

		update_option( 'stcrm_db_version', STCRM_DB_VERSION );
	}
```
Replace with:
```php
		self::create_contacts_table( $charset_collate );
		self::create_contact_products_table( $charset_collate );
		self::create_tickets_table( $charset_collate );
		self::create_messages_table( $charset_collate );
		self::create_tokens_table( $charset_collate );

		if ( version_compare( $installed, '1.0.5', '<' ) ) {
			self::backfill_status_change_messages_internal();
		}

		update_option( 'stcrm_db_version', STCRM_DB_VERSION );
	}
```

- [ ] **Step 3: Bump the DB version**

In `sublime-crm.php`, change:
```php
define( 'STCRM_DB_VERSION', '1.0.6' );
```
to:
```php
define( 'STCRM_DB_VERSION', '1.8.0' );
```

- [ ] **Step 4: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l includes/Database/class-stcrm-database.php && php -l sublime-crm.php`
Expected: `No syntax errors detected` for both.

- [ ] **Step 5: Do NOT run `install()` yet**

Task 3 resets this local site's tables first — running `install()` against the *old* `wp_stcrm_contacts` schema right now would leave old and new column definitions in a half-migrated state via `dbDelta()`'s limited ALTER support. Stop here; Task 3 is next.

- [ ] **Step 6: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add includes/Database/class-stcrm-database.php sublime-crm.php
git commit -m "Phase 14: rewrite contacts schema — person-level table + new contact_products

wp_stcrm_contacts becomes person-level only (email UNIQUE, name,
fs_user_id). New wp_stcrm_contact_products holds everything that used
to be per-(product_id,email) on the old contacts row: tier, plan,
license fields, sites_count, verification_pending.

Not yet wired into any consumer -- this commit is schema-only.
STCRM_DB_VERSION bumped to 1.8.0. Local site's tables not yet reset
(next task)."
```

---

### Task 3: One-time manual reset of this local site's data (not shipped code)

This step is **not part of the plugin** — it's a one-off operation against this specific local database, run directly, never as code that ships. Do not add this to any PHP file.

**Files:** none (direct SQL/PHP-CLI against the local DB only)

- [ ] **Step 1: Confirm this is genuinely disposable data**

Run: `cd /c/laragon/www/sublimetheme && php -r "require 'wp-load.php'; global \$wpdb; foreach (['contacts','tickets','messages','tokens'] as \$t) { echo \$t . ': ' . \$wpdb->get_var(\"SELECT COUNT(*) FROM {\$wpdb->prefix}stcrm_{\$t}\") . \" rows\n\"; }"`

Expected: some non-zero counts (this site's accumulated test data from Phases 1-13 and today's bugfixes). This is expected and fine — it was already confirmed with the user that none of it is real production data.

- [ ] **Step 2: Drop the 4 tables**

Run:
```bash
cd /c/laragon/www/sublimetheme && php -r "
require 'wp-load.php';
global \$wpdb;
foreach (['tokens','messages','tickets','contacts'] as \$t) {
    \$wpdb->query(\"DROP TABLE IF EXISTS {\$wpdb->prefix}stcrm_{\$t}\");
}
delete_option('stcrm_db_version');
echo \"Dropped 4 tables, cleared stcrm_db_version option.\n\";
"
```

Note the drop order (tokens, messages, tickets, contacts) — no FK constraints are actually declared in this schema (plain `bigint` columns + indexes, not `FOREIGN KEY`), so order doesn't matter for the DROP itself, but this order avoids any transient confusion if MySQL strict mode is ever enabled later.

- [ ] **Step 3: Recreate via the plugin's own `install()`, now running against the Task 2 schema**

Run:
```bash
cd /c/laragon/www/sublimetheme && php -r "
require 'wp-load.php';
STCRM_Database::install();
global \$wpdb;
echo 'stcrm_db_version option: ' . get_option('stcrm_db_version') . \"\n\";
foreach (['contacts','contact_products','tickets','messages','tokens'] as \$t) {
    \$cols = \$wpdb->get_col(\"SHOW COLUMNS FROM {\$wpdb->prefix}stcrm_{\$t}\");
    echo \"{\$t}: \" . implode(', ', \$cols) . \"\n\";
}
"
```

Expected: `stcrm_db_version option: 1.8.0`; `contacts` columns are exactly `id, email, name, fs_user_id, created_at, updated_at` (no `product_id`/`tier`/`plan`/etc.); `contact_products` columns are `id, contact_id, product_id, tier, plan, license_key_hash, license_status, license_expires, sites_count, verification_pending, created_at, updated_at`; `tickets`/`messages`/`tokens` unchanged from before.

- [ ] **Step 4: No commit** — this step touched only the local database, not any file in either repo. Nothing to commit.

---

### Task 4: Rewrite the DB access layer

**Files:**
- Modify: `includes/Database/class-stcrm-database.php` (multiple methods — see steps)
- Test: one-off PHP-CLI script in the scratchpad

**Interfaces:**
- Produces:
  - `STCRM_Database::upsert_contact( string $email, string $name = '', int $fs_user_id = 0 ): int|false` — person-only, replaces the old 6-arg signature
  - `STCRM_Database::upsert_contact_product( int $contact_id, int $product_id, string $tier, array $license_data = array() ): bool`
  - `STCRM_Database::get_contact_by_email( string $email ): ?object` — drops `$product_id`
  - `STCRM_Database::get_contact_product( int $contact_id, int $product_id ): ?object`
  - `STCRM_Database::get_contact_by_license_key_hash( int $product_id, string $key_hash ): ?object` — same signature, now JOINs
  - `STCRM_Database::get_contact_by_fs_user_id( int $fs_user_id ): ?object` — drops `$product_id` (fs_user_id is person-level now)
- Deletes: `STCRM_Database::get_contacts_by_email()` (Phase 6.6 sibling-lookup helper — no longer meaningful, only one contact per email exists)

- [ ] **Step 1: Rewrite `upsert_contact()`**

Find the current method (starts at what was line 266, docblock included — locate via `grep -n "public static function upsert_contact" includes/Database/class-stcrm-database.php`) and replace the entire method + its docblock with:

```php
	/**
	 * Upsert a contact by email — person-level only (Phase 14, 2026-07-12).
	 *
	 * Matches on email alone. Updates name/fs_user_id on conflict only when a
	 * non-empty value is actually supplied — never overwrites an existing
	 * known name/fs_user_id with a blank one from a caller that doesn't have
	 * that data (e.g. a magic-link shell-contact creation with no name).
	 *
	 * @since  1.0.0
	 * @since  1.8.0 Phase 14 — dropped product_id/tier/license_data; those now
	 *               live on wp_stcrm_contact_products via upsert_contact_product().
	 * @param  string $email      Customer email (lowercased before insert).
	 * @param  string $name       Customer display name, optional.
	 * @param  int    $fs_user_id Freemius user ID, optional (0 = unknown).
	 * @return int|false          Contact ID, or false on DB failure.
	 */
	public static function upsert_contact( string $email, string $name = '', int $fs_user_id = 0 ): int|false {
		global $wpdb;

		$table = $wpdb->prefix . 'stcrm_contacts';
		$now   = gmdate( 'Y-m-d H:i:s' );
		$email = strtolower( $email );

		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT id FROM {$table} WHERE email = %s LIMIT 1",
				$email
			)
		);

		if ( $existing_id ) {
			$data    = array( 'updated_at' => $now );
			$formats = array( '%s' );
			if ( $name ) {
				$data['name'] = $name;
				$formats[]    = '%s';
			}
			if ( $fs_user_id ) {
				$data['fs_user_id'] = $fs_user_id;
				$formats[]          = '%d';
			}
			$result = $wpdb->update( $table, $data, array( 'id' => (int) $existing_id ), $formats, array( '%d' ) );
			return ( false !== $result ) ? (int) $existing_id : false;
		}

		$result = $wpdb->insert(
			$table,
			array(
				'email'      => $email,
				'name'       => $name ?: null,
				'fs_user_id' => $fs_user_id ?: null,
				'created_at' => $now,
				'updated_at' => $now,
			),
			array( '%s', '%s', '%d', '%s', '%s' )
		);

		return ( false !== $result ) ? (int) $wpdb->insert_id : false;
	}

	/**
	 * Upsert a contact's per-product tier/license state (Phase 14, 2026-07-12).
	 * Matches on (contact_id, product_id). Mirrors the old upsert_contact()'s
	 * license_data shape exactly, so every existing caller only needs to
	 * change which method it calls, not how it builds $license_data.
	 *
	 * @since  1.8.0
	 * @param  int    $contact_id
	 * @param  int    $product_id
	 * @param  string $tier         'free' or 'pro'.
	 * @param  array  $license_data Keys: plan, status, expires, license_key_hash, sites_count.
	 * @return bool
	 */
	public static function upsert_contact_product( int $contact_id, int $product_id, string $tier, array $license_data = array() ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'stcrm_contact_products';
		$now   = gmdate( 'Y-m-d H:i:s' );

		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT id FROM {$table} WHERE contact_id = %d AND product_id = %d LIMIT 1",
				$contact_id,
				$product_id
			)
		);

		$data = array(
			'tier'             => in_array( $tier, array( 'free', 'pro' ), true ) ? $tier : 'free',
			'plan'             => $license_data['plan'] ?? null,
			'license_key_hash' => $license_data['license_key_hash'] ?? null,
			'license_status'   => $license_data['status'] ?? 'none',
			'license_expires'  => $license_data['expires'] ?? null,
			'sites_count'      => absint( $license_data['sites_count'] ?? 0 ),
			'updated_at'       => $now,
		);
		$formats = array( '%s', '%s', '%s', '%s', '%s', '%d', '%s' );

		if ( $existing_id ) {
			$result = $wpdb->update( $table, $data, array( 'id' => (int) $existing_id ), $formats, array( '%d' ) );
			return false !== $result;
		}

		$insert_data    = array_merge(
			array( 'contact_id' => $contact_id, 'product_id' => $product_id, 'created_at' => $now ),
			$data
		);
		$insert_formats = array_merge( array( '%d', '%d', '%s' ), $formats );

		return false !== $wpdb->insert( $table, $insert_data, $insert_formats );
	}

	/**
	 * Find a contact's row for one specific product.
	 *
	 * @since  1.8.0
	 * @param  int $contact_id
	 * @param  int $product_id
	 * @return object|null
	 */
	public static function get_contact_product( int $contact_id, int $product_id ): ?object {
		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contact_products';

		return $wpdb->get_row(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT * FROM {$table} WHERE contact_id = %d AND product_id = %d LIMIT 1",
				$contact_id,
				$product_id
			)
		) ?: null;
	}
```

- [ ] **Step 2: Rewrite `get_contact_by_email()`, delete `get_contacts_by_email()`**

Find the current `get_contact_by_email()` method and replace it (keep the same method name and position in the file) with:

```php
	/**
	 * Find a contact by email — global, not product-scoped (Phase 14, 2026-07-12).
	 *
	 * @since  1.0.0
	 * @since  1.8.0 Phase 14 — dropped $product_id; contacts are person-level now.
	 * @param  string $email
	 * @return object|null
	 */
	public static function get_contact_by_email( string $email ): ?object {
		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contacts';

		return $wpdb->get_row(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT * FROM {$table} WHERE email = %s LIMIT 1",
				strtolower( $email )
			)
		) ?: null;
	}
```

Delete the entire `get_contacts_by_email()` method that immediately follows it (the Phase 6.6 sibling-lookup helper, docblock included) — there is only ever one contact per email now, so nothing to expand across siblings. Confirm via `grep -rn "get_contacts_by_email" wp-content/plugins/sublime-crm --include=*.php` that after this step and Task 7 (which updates its 3 call sites), zero references remain anywhere in the plugin.

- [ ] **Step 3: Rewrite `get_contact_by_license_key_hash()` and `get_contact_by_fs_user_id()`**

Replace both methods with:

```php
	/**
	 * Find a contact by product_id + SHA-256 license key hash (Phase 14: now
	 * joins wp_stcrm_contact_products, since license_key_hash moved there).
	 *
	 * @since  1.0.1
	 * @since  1.8.0 Phase 14 — joins contact_products instead of reading contacts directly.
	 * @param  int    $product_id
	 * @param  string $key_hash SHA-256 hex hash of the raw license key.
	 * @return object|null Contact row (person-level fields) with tier/license
	 *                     fields from its contact_products row merged in.
	 */
	public static function get_contact_by_license_key_hash( int $product_id, string $key_hash ): ?object {
		global $wpdb;
		$c = $wpdb->prefix . 'stcrm_contacts';
		$cp = $wpdb->prefix . 'stcrm_contact_products';

		return $wpdb->get_row(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT c.*, cp.tier, cp.plan, cp.license_key_hash, cp.license_status,
				        cp.license_expires, cp.sites_count, cp.verification_pending
				 FROM {$c} c
				 INNER JOIN {$cp} cp ON cp.contact_id = c.id
				 WHERE cp.product_id = %d AND cp.license_key_hash = %s
				 LIMIT 1",
				$product_id,
				$key_hash
			)
		) ?: null;
	}

	/**
	 * Find a contact by Freemius user ID — global, not product-scoped
	 * (Phase 14, 2026-07-12: fs_user_id moved onto the person-level contact row).
	 *
	 * @since  1.0.0
	 * @since  1.8.0 Phase 14 — dropped $product_id.
	 * @param  int $fs_user_id
	 * @return object|null
	 */
	public static function get_contact_by_fs_user_id( int $fs_user_id ): ?object {
		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contacts';

		return $wpdb->get_row(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT * FROM {$table} WHERE fs_user_id = %d LIMIT 1",
				$fs_user_id
			)
		) ?: null;
	}
```

Note: `get_contact_by_license_key_hash()`'s returned object now carries the merged tier/license fields directly (via the JOIN), so every existing caller that reads `$contact->tier`, `$contact->license_status`, etc. off its return value keeps working unmodified — only callers that need the *bare* person-level contact (e.g. to pass `$contact->id` into `upsert_contact_product()`) need to be aware the row is now a merge, not a raw `contacts` row. `$contact->id` is still the correct global contact ID either way (it's `c.*` first in the SELECT list, so `c.id` wins over any ambiguity).

- [ ] **Step 4: Rewrite `get_admin_contacts()`, `count_contacts()`, `get_contacts_last_updated()`, `get_tickets_by_contact()`**

Replace `get_admin_contacts()` with:

```php
	/**
	 * Paginated contact list for the admin Contacts page — one row per person
	 * (Phase 14, 2026-07-12), LEFT JOINing contact_products for tier/plan/
	 * license aggregation and a product count. A person with zero
	 * contact_products rows (never engaged with any product yet) still
	 * appears, with tier defaulting to 'free' and product_count 0.
	 *
	 * $product_id, when given, filters to people who have at least one
	 * contact_products row for that product — matching the old per-product
	 * filter's intent, now expressed as a WHERE EXISTS instead of a direct
	 * WHERE c.product_id = %d (that column no longer exists on contacts).
	 *
	 * @since  1.0.7
	 * @since  1.8.0 Phase 14 — one row per person; product_id is now a filter, not a column.
	 * @param  int|null $product_id Null = all people, regardless of product.
	 * @param  int      $page
	 * @param  int      $per_page
	 * @return object[]
	 */
	public static function get_admin_contacts( ?int $product_id, int $page, int $per_page ): array {
		global $wpdb;
		$c  = $wpdb->prefix . 'stcrm_contacts';
		$cp = $wpdb->prefix . 'stcrm_contact_products';
		$t  = $wpdb->prefix . 'stcrm_tickets';

		$offset = ( max( 1, $page ) - 1 ) * $per_page;

		$where_sql = null !== $product_id
			? "WHERE EXISTS (SELECT 1 FROM {$cp} cpf WHERE cpf.contact_id = c.id AND cpf.product_id = %d)"
			: '';
		$args = null !== $product_id ? array( $product_id, $per_page, $offset ) : array( $per_page, $offset );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
				"SELECT c.id, c.email, c.name, c.fs_user_id, c.created_at, c.updated_at,
				        (
				            SELECT COUNT(DISTINCT cp2.product_id)
				            FROM {$cp} cp2 WHERE cp2.contact_id = c.id
				        ) AS product_count,
				        (
				            SELECT MAX(cp3.updated_at)
				            FROM {$cp} cp3 WHERE cp3.contact_id = c.id
				        ) AS product_updated_at,
				        (
				            SELECT MAX(cp4.tier = 'pro')
				            FROM {$cp} cp4 WHERE cp4.contact_id = c.id
				        ) AS has_pro,
				        (
				            SELECT COUNT(*)
				            FROM {$t} tk
				            WHERE tk.contact_id = c.id
				              AND tk.status NOT IN ('resolved', 'closed')
				        ) AS open_tickets_count
				 FROM {$c} c
				 {$where_sql}
				 ORDER BY GREATEST(c.updated_at, COALESCE(
				     (SELECT MAX(cp5.updated_at) FROM {$cp} cp5 WHERE cp5.contact_id = c.id),
				     c.updated_at
				 )) DESC
				 LIMIT %d OFFSET %d",
				$args
			)
		);

		return is_array( $rows ) ? $rows : array();
	}
```

Replace `count_contacts()` with:

```php
	/**
	 * Count total people, optionally filtered to those with a contact_products
	 * row for one specific product.
	 *
	 * @since  1.0.7
	 * @since  1.8.0 Phase 14 — filters via contact_products, not a direct column.
	 * @param  int|null $product_id Null = everyone, regardless of product.
	 * @return int
	 */
	public static function count_contacts( ?int $product_id ): int {
		global $wpdb;
		$c  = $wpdb->prefix . 'stcrm_contacts';
		$cp = $wpdb->prefix . 'stcrm_contact_products';

		if ( null === $product_id ) {
			return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$c}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT COUNT(*) FROM {$c} c
				 WHERE EXISTS (SELECT 1 FROM {$cp} cpf WHERE cpf.contact_id = c.id AND cpf.product_id = %d)",
				$product_id
			)
		);
	}
```

Replace `get_contacts_last_updated()` with:

```php
	/**
	 * Most recently updated person (or their product data), optionally
	 * filtered to one product.
	 *
	 * @since  1.0.7
	 * @since  1.8.0 Phase 14 — considers both contacts.updated_at and contact_products.updated_at.
	 * @param  int|null $product_id Null = across everyone, regardless of product.
	 * @return string|null MySQL datetime string, or null if no contacts exist.
	 */
	public static function get_contacts_last_updated( ?int $product_id ): ?string {
		global $wpdb;
		$c  = $wpdb->prefix . 'stcrm_contacts';
		$cp = $wpdb->prefix . 'stcrm_contact_products';

		if ( null === $product_id ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			return $wpdb->get_var( "SELECT GREATEST(COALESCE((SELECT MAX(updated_at) FROM {$c}), '1970-01-01'), COALESCE((SELECT MAX(updated_at) FROM {$cp}), '1970-01-01'))" ) ?: null;
		}

		return $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT MAX(updated_at) FROM {$cp} WHERE product_id = %d",
				$product_id
			)
		) ?: null;
	}
```

Replace `get_tickets_by_contact()` with:

```php
	/**
	 * Ticket history for one contact (Phase 14, 2026-07-12: now spans every
	 * product they've touched, not just one — $product_id becomes an
	 * optional filter instead of a required scope).
	 *
	 * @since  1.0.7
	 * @since  1.8.0 Phase 14 — $product_id is now optional (null = all products).
	 * @param  int      $contact_id
	 * @param  int|null $product_id Null = every product this contact has tickets for.
	 * @param  int      $page
	 * @param  int      $per_page
	 * @return object[]
	 */
	public static function get_tickets_by_contact( int $contact_id, ?int $product_id = null, int $page = 1, int $per_page = 20 ): array {
		global $wpdb;
		$t = $wpdb->prefix . 'stcrm_tickets';
		$m = $wpdb->prefix . 'stcrm_messages';

		$offset = ( max( 1, $page ) - 1 ) * $per_page;

		$product_sql = null !== $product_id ? 'AND t.product_id = %d' : '';
		$args        = null !== $product_id
			? array( $contact_id, $product_id, $per_page, $offset )
			: array( $contact_id, $per_page, $offset );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
				"SELECT t.id, t.product_id, t.subject, t.status, t.priority, t.last_activity_at,
				        (
				            SELECT COUNT(*)
				            FROM {$m} m
				            WHERE m.ticket_id    = t.id
				              AND m.sender_type  = 'agent'
				              AND m.is_internal_note = 0
				              AND m.read_at      IS NULL
				        ) AS unread_count
				 FROM {$t} t
				 WHERE t.contact_id = %d
				   {$product_sql}
				 ORDER BY t.last_activity_at DESC
				 LIMIT %d OFFSET %d",
				$args
			)
		);

		return is_array( $rows ) ? $rows : array();
	}
```

**IMPORTANT:** `get_tickets_by_contact()`'s parameter *order* changed (`$contact_id` first now, `$product_id` second and optional) — this is a breaking signature change from the old `( int $product_id, int $contact_id, int $page, int $per_page )`. Task 9 updates its one call site (`render_contact_detail_page()`); grep for any other callers before moving on:

Run: `grep -rn "get_tickets_by_contact(" wp-content/plugins/sublime-crm --include=*.php`
Expected: the method definition itself, plus exactly one call site in `admin/class-stcrm-admin.php` (updated in Task 9).

- [ ] **Step 5: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l includes/Database/class-stcrm-database.php`
Expected: `No syntax errors detected`.

- [ ] **Step 6: Write and run the verification script**

Save to scratchpad as `verify_task4_db_layer.php`:

```php
<?php
$_SERVER['REMOTE_ADDR'] = '203.0.113.200';
require 'C:/laragon/www/sublimetheme/wp-load.php';
global $wpdb;

$email = 'phase14-task4-' . time() . '@example.com';

// upsert_contact() person-only
$id1 = STCRM_Database::upsert_contact( $email, 'First Name' );
echo "A) First upsert -> id={$id1}\n";
$id2 = STCRM_Database::upsert_contact( $email, 'Updated Name' );
echo "B) Second upsert, same email -> id={$id2} (expect same as A)\n";
$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}stcrm_contacts WHERE id=%d", $id1 ) );
echo "C) Name after 2nd upsert: {$row->name} (expect 'Updated Name')\n";

// upsert_contact_product() + get_contact_product()
$ok = STCRM_Database::upsert_contact_product( $id1, 123456, 'pro', array( 'plan' => 'Agency', 'status' => 'active', 'sites_count' => 3 ) );
echo "D) upsert_contact_product -> " . var_export( $ok, true ) . "\n";
$cp = STCRM_Database::get_contact_product( $id1, 123456 );
echo "E) get_contact_product: tier={$cp->tier} plan={$cp->plan} sites={$cp->sites_count}\n";

// get_contact_by_email() no longer takes product_id
$found = STCRM_Database::get_contact_by_email( $email );
echo "F) get_contact_by_email found id={$found->id} (expect {$id1})\n";

// get_contact_by_license_key_hash() joins contact_products
$hash = hash( 'sha256', 'sk_test_task4' );
STCRM_Database::upsert_contact_product( $id1, 123456, 'pro', array( 'status' => 'active', 'license_key_hash' => $hash ) );
$by_hash = STCRM_Database::get_contact_by_license_key_hash( 123456, $hash );
echo "G) get_contact_by_license_key_hash -> id={$by_hash->id} tier={$by_hash->tier} (expect id={$id1}, tier=pro)\n";

// get_contact_by_fs_user_id() no longer takes product_id
STCRM_Database::upsert_contact( $email, '', 999888 );
$by_fs = STCRM_Database::get_contact_by_fs_user_id( 999888 );
echo "H) get_contact_by_fs_user_id -> id={$by_fs->id} (expect {$id1})\n";

// get_contacts_by_email() must be gone
echo "I) get_contacts_by_email exists? " . ( method_exists( 'STCRM_Database', 'get_contacts_by_email' ) ? 'YES (bug!)' : 'NO (correct)' ) . "\n";

// Cleanup
$wpdb->delete( $wpdb->prefix . 'stcrm_contact_products', array( 'contact_id' => $id1 ) );
$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $id1 ) );
echo "\nCleanup done.\n";
```

Run: `php verify_task4_db_layer.php` (from the scratchpad directory)

Expected output: A/B report the same ID; C shows `Updated Name`; D reports `true`; E shows `tier=pro plan=Agency sites=3`; F/G/H each resolve to `id1`; I reports `NO (correct)`.

- [ ] **Step 7: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add includes/Database/class-stcrm-database.php
git commit -m "Phase 14: rewrite DB access layer for global contacts

upsert_contact() becomes person-only (email, name, fs_user_id); new
upsert_contact_product()/get_contact_product() handle the per-product
side. get_contact_by_email() drops product_id. get_contacts_by_email()
(Phase 6.6 sibling-lookup) deleted -- only one contact per email now.
get_contact_by_license_key_hash()/get_contact_by_fs_user_id() rewritten
to join/query contact_products or the person row directly.
get_admin_contacts()/count_contacts()/get_contacts_last_updated()/
get_tickets_by_contact() rewritten for one-row-per-person (the last one
also drops its required product_id -- Task 9 updates its call site).

Verified via a PHP-CLI script covering every rewritten method against
the real (now-empty, freshly reset) local DB."
```

---

### Task 5: Rewrite the tier resolver's two-step lookup

**Files:**
- Modify: `includes/Services/class-stcrm-tier-resolver.php` (`resolve()`, `resolve_free_product()`, `resolve_via_license_key()`, `reverify_contact()`, `verified_result()`, `unverified_result()`)
- Test: scratchpad PHP-CLI script

**Interfaces:**
- Consumes: `STCRM_Database::upsert_contact()`, `upsert_contact_product()`, `get_contact_by_email()`, `get_contact_product()`, `get_contact_by_license_key_hash()` (all from Task 4)
- Produces: `resolve()`/`resolve_free_product()` return shape is UNCHANGED (`array{contact, tier, verified, priority}`) — callers in `class-stcrm-tickets-controller.php` need no change to how they read the result, only `$contact->id` now means "the global contact," same as before

- [ ] **Step 1: Rewrite `resolve()`**

Replace the method with:

```php
	public function resolve( int $product_id, string $email, string $license_key = '' ): array {
		$email = strtolower( sanitize_email( $email ) );

		// Phase 14 (2026-07-12): the global contact is found-or-created first,
		// unconditionally -- every ticket submission touches a real person
		// regardless of which resolution path fires below.
		$contact_id = STCRM_Database::upsert_contact( $email );
		$contact    = $contact_id ? STCRM_Database::get_contact_by_email( $email ) : null;
		$cp         = $contact_id ? STCRM_Database::get_contact_product( $contact_id, $product_id ) : null;

		// (1) Primary path — email + product lookup, no API call.
		if ( $cp && 'active' === $cp->license_status ) {
			$result = $this->verified_result( $contact, $cp );
		} elseif ( '' !== $license_key ) {
			// (2-4) Fallback — license key provided.
			$result = $this->resolve_via_license_key( $product_id, $email, $contact, $cp, $license_key );
		} else {
			// (5) No key, no active match.
			$result = $this->unverified_result( $contact, $cp );
		}

		STCRM_Logger::info(
			'tier.resolved',
			"Tier resolved for {$email}: {$result['tier']}" . ( $result['verified'] ? ' (verified)' : ' (unverified)' ),
			array(
				'product_id' => $product_id,
				'email'      => $email,
				'tier'       => $result['tier'],
				'verified'   => (bool) $result['verified'],
				'priority'   => $result['priority'],
			)
		);

		return $result;
	}
```

- [ ] **Step 2: Rewrite `resolve_free_product()`**

Replace with:

```php
	public function resolve_free_product( int $product_id, string $email ): array {
		$email      = strtolower( sanitize_email( $email ) );
		$contact_id = STCRM_Database::upsert_contact( $email );
		$contact    = $contact_id ? STCRM_Database::get_contact_by_email( $email ) : null;
		$cp         = $contact_id ? STCRM_Database::get_contact_product( $contact_id, $product_id ) : null;

		$result = $this->unverified_result( $contact, $cp );

		STCRM_Logger::info(
			'tier.resolved',
			"Tier resolved for {$email}: free (wporg product, no resolution)",
			array(
				'product_id' => $product_id,
				'email'      => $email,
				'tier'       => $result['tier'],
				'verified'   => false,
				'priority'   => $result['priority'],
			)
		);

		return $result;
	}
```

- [ ] **Step 3: Rewrite `resolve_via_license_key()`**

Replace with:

```php
	private function resolve_via_license_key(
		int $product_id,
		string $email,
		?object $contact,
		?object $cp,
		string $license_key
	): array {
		$key_hash = hash( 'sha256', $license_key );

		// (2) Hash already in contact_products — no API call.
		$contact_by_key = STCRM_Database::get_contact_by_license_key_hash( $product_id, $key_hash );
		if ( $contact_by_key && 'active' === $contact_by_key->license_status ) {
			return $this->verified_result( $contact_by_key, $contact_by_key );
		}

		// (3a) Transient cache from a prior API call.
		$cached = get_transient( self::CACHE_PREFIX . $key_hash );
		if ( false !== $cached ) {
			$anchor_contact = $contact ?? $contact_by_key;
			$anchor_cp      = $cp ?? $contact_by_key;
			return 'pro' === $cached['tier']
				? $this->verified_result( $anchor_contact, $anchor_cp )
				: $this->unverified_result( $anchor_contact, $anchor_cp );
		}

		// (3b) Not cached, no DB hash match — verify in the background, same
		// as before Phase 14 (see CLAUDE.md "What NOT to do").
		$anchor_contact = $contact ?? $contact_by_key;
		$anchor_cp      = $cp ?? $contact_by_key;

		if ( '' !== $this->find_product_api_token( $product_id ) && $anchor_contact ) {
			$this->flag_verification_pending( $anchor_contact, $product_id );
			$this->queue_reverify( $anchor_contact, $product_id, $email, $license_key );
		}

		return $this->unverified_result( $anchor_contact, $anchor_cp );
	}
```

Note: `$contact_by_key` (from `get_contact_by_license_key_hash()`, Task 4 Step 3) already carries merged tier/license fields via its JOIN, so passing it as both the `$contact` and `$cp` argument to `verified_result()`/`unverified_result()` below works correctly — those two methods only ever read `$cp->tier`/`$cp->license_status`/etc. off whichever object is passed as the second argument, and `$contact->id` off the first.

- [ ] **Step 4: Rewrite `flag_verification_pending()` and `queue_reverify()`**

These currently operate on a `contacts` row; they now need a `$product_id` to target the right `contact_products` row. Replace both:

```php
	/**
	 * Set verification_pending=1 on a contact's contact_products row for one product.
	 *
	 * @since 1.0.1
	 * @since 1.8.0 Phase 14 — targets contact_products, needs $product_id.
	 */
	private function flag_verification_pending( ?object $contact, int $product_id ): void {
		if ( ! $contact ) {
			return;
		}

		$cp = STCRM_Database::get_contact_product( (int) $contact->id, $product_id );
		STCRM_Database::upsert_contact_product(
			(int) $contact->id,
			$product_id,
			$cp->tier ?? 'free',
			array(
				'plan'             => $cp->plan ?? null,
				'status'           => $cp->license_status ?? 'none',
				'expires'          => $cp->license_expires ?? null,
				'license_key_hash' => $cp->license_key_hash ?? null,
				'sites_count'      => $cp->sites_count ?? 0,
			)
		);

		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'stcrm_contact_products',
			array( 'verification_pending' => 1, 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ),
			array( 'contact_id' => (int) $contact->id, 'product_id' => $product_id ),
			array( '%d', '%s' ),
			array( '%d', '%d' )
		);
	}
```

Note the two-step write in `flag_verification_pending()`: `upsert_contact_product()` first (so a row exists at all, for a contact with no prior product engagement — e.g. their very first ticket, submitted with an unrecognized license key), then a targeted `$wpdb->update()` to set just the `verification_pending` flag without disturbing anything `upsert_contact_product()` just wrote from the (possibly-null) prior `$cp`.

`queue_reverify()` needs no signature change — it already takes `$contact`/`$product_id`/`$email`/`$license_key` separately and just calls `as_enqueue_async_action()`; leave it exactly as-is.

- [ ] **Step 5: Rewrite `reverify_contact()`'s DB-write branch**

Find the `if ( $contact_id > 0 ) { ... } else { ... }` block inside `reverify_contact()` and replace it with:

```php
		if ( $contact_id > 0 ) {
			STCRM_Database::upsert_contact_product(
				$contact_id,
				$product_id,
				$api_result['tier'],
				array(
					'plan'             => $api_result['plan'],
					'status'           => $api_result['license_status'],
					'expires'          => $api_result['license_expires'],
					'license_key_hash' => $key_hash,
					'sites_count'      => 0,
				)
			);
			global $wpdb;
			$wpdb->update(
				$wpdb->prefix . 'stcrm_contact_products',
				array( 'verification_pending' => 0 ),
				array( 'contact_id' => $contact_id, 'product_id' => $product_id ),
				array( '%d' ),
				array( '%d', '%d' )
			);
		} else {
			// Contact was absent at ticket-creation time — create it now.
			$new_contact_id = STCRM_Database::upsert_contact( $email, $api_result['name'], absint( $api_result['fs_user_id'] ) );
			if ( $new_contact_id ) {
				STCRM_Database::upsert_contact_product(
					$new_contact_id,
					$product_id,
					$api_result['tier'],
					array(
						'plan'             => $api_result['plan'],
						'status'           => $api_result['license_status'],
						'expires'          => $api_result['license_expires'],
						'license_key_hash' => $key_hash,
						'sites_count'      => 0,
					)
				);
			}
		}
```

Note: `sites_count` is deliberately reset to `0` on reverify (matching the pre-Phase-14 code's behavior exactly) — a license-key reverify has no site-count data to report, same limitation as before.

- [ ] **Step 6: Rewrite `verified_result()` and `unverified_result()`**

Both now take the `contact_products` row too, so they can read tier/license fields correctly regardless of whether they came from a merged JOIN result or a separate lookup:

```php
	/** @since 1.0.1 */
	private function verified_result( ?object $contact, ?object $cp ): array {
		return array(
			'contact'  => $contact,
			'tier'     => 'pro',
			'verified' => 1,
			'priority' => STCRM_Settings::get_setting( 'default_priority_pro' ),
		);
	}

	/** @since 1.0.1 */
	private function unverified_result( ?object $contact, ?object $cp ): array {
		return array(
			'contact'  => $contact,
			'tier'     => 'free',
			'verified' => 0,
			'priority' => STCRM_Settings::get_setting( 'default_priority_free' ),
		);
	}
```

(`$cp` is accepted but unused in the body — both builders only ever return a hardcoded tier based on *which* builder was called, never read it off `$cp`; this matches the pre-Phase-14 behavior exactly, where `verified_result()`/`unverified_result()` never read `$contact->tier` either. Keeping the parameter documents the caller's intent and leaves room for a future change without another signature break.)

- [ ] **Step 7: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l includes/Services/class-stcrm-tier-resolver.php`
Expected: `No syntax errors detected`.

- [ ] **Step 8: Write and run the verification script**

Save to scratchpad as `verify_task5_tier_resolver.php`:

```php
<?php
$_SERVER['REMOTE_ADDR'] = '203.0.113.201';
require 'C:/laragon/www/sublimetheme/wp-load.php';
global $wpdb;

$resolver = new STCRM_Tier_Resolver();
$settings = STCRM_Settings::get_settings();
$product_id = (int) $settings['products'][0]['product_id'];
$email = 'phase14-task5-' . time() . '@example.com';

// Path 5: no key, no active match -> free/unverified, and a contact row now exists
$r1 = $resolver->resolve( $product_id, $email );
echo "A) No key, first-ever contact -> tier={$r1['tier']} verified={$r1['verified']} contact_id=" . ( $r1['contact']->id ?? 'NULL' ) . "\n";
$contact = STCRM_Database::get_contact_by_email( $email );
echo "B) Global contact now exists: id={$contact->id}\n";
$cp = STCRM_Database::get_contact_product( $contact->id, $product_id );
echo "C) contact_products row after unverified resolve: " . ( $cp ? "exists (tier={$cp->tier})" : "none (expected -- unverified path never creates one)" ) . "\n";

// Simulate an active pro license directly, then re-resolve -> path (1)
STCRM_Database::upsert_contact_product( $contact->id, $product_id, 'pro', array( 'status' => 'active', 'plan' => 'Agency' ) );
$r2 = $resolver->resolve( $product_id, $email );
echo "D) Active license present -> tier={$r2['tier']} verified={$r2['verified']} (expect pro/1)\n";

// resolve_free_product() still creates the global contact but no contact_products row
$email2 = 'phase14-task5b-' . time() . '@example.com';
$r3 = $resolver->resolve_free_product( $product_id, $email2 );
echo "E) resolve_free_product -> tier={$r3['tier']} verified={$r3['verified']} contact_id=" . ( $r3['contact']->id ?? 'NULL' ) . " (expect free/0, real id)\n";

// Cleanup
$wpdb->delete( $wpdb->prefix . 'stcrm_contact_products', array( 'contact_id' => $contact->id ) );
$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $contact->id ) );
if ( $r3['contact'] ) { $wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $r3['contact']->id ) ); }
echo "\nCleanup done.\n";
```

Run: `php verify_task5_tier_resolver.php`

Expected: A shows `free`/`0` with a real contact ID; B confirms the same ID; C reports "none"; D shows `pro`/`1` after simulating an active license; E shows `free`/`0` with a real (different) contact ID.

- [ ] **Step 9: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add includes/Services/class-stcrm-tier-resolver.php
git commit -m "Phase 14: rewrite tier resolver for the two-step global-contact lookup

resolve()/resolve_free_product() now find-or-create the global contact
by email unconditionally, then find-or-create/read its contact_products
row for the specific product. resolve_via_license_key(),
reverify_contact(), flag_verification_pending() all updated to write
contact_products instead of contacts directly. verified_result()/
unverified_result() gain a $cp parameter (return shape to callers is
unchanged).

Verified via a PHP-CLI script covering all 3 resolution paths (no
match, active license, free-product) plus confirming a first-time
unverified resolve creates the global contact but no contact_products
row (nothing to record yet)."
```

---

### Task 6: Rewrite the Freemius webhook + backfill sync

**Files:**
- Modify: `includes/Services/class-stcrm-freemius-sync.php` (`handle_install_event()`, `handle_user_updated()`, `handle_license_status_change()`)
- Modify: `includes/Services/class-stcrm-backfill.php` (`process_single_install()`)
- Test: scratchpad PHP-CLI script

- [ ] **Step 1: Rewrite `handle_install_event()`**

Find (in `includes/Services/class-stcrm-freemius-sync.php`):
```php
		$contact_id = STCRM_Database::upsert_contact(
			$product_id,
			$fs_user_id,
			$email,
			$name,
			$tier,
			$license_data
		);

		if ( ! $contact_id ) {
			$this->log( "Failed to upsert contact for {$email} (product {$product_id})", 'error' );
		}
```
Replace with:
```php
		$contact_id = STCRM_Database::upsert_contact( $email, $name, $fs_user_id );

		if ( ! $contact_id ) {
			$this->log( "Failed to upsert contact for {$email} (product {$product_id})", 'error' );
		} elseif ( ! STCRM_Database::upsert_contact_product( $contact_id, $product_id, $tier, $license_data ) ) {
			$this->log( "Failed to upsert contact_product for {$email} (product {$product_id})", 'error' );
		}
```

- [ ] **Step 2: Rewrite `handle_user_updated()`**

This method currently does a targeted `$wpdb->update()` against `stcrm_contacts` using `product_id` to find the row via `get_contact_by_fs_user_id( $product_id, $fs_user_id )`. Since `fs_user_id` is now person-level, this simplifies — replace the entire method body from `$contact = STCRM_Database::get_contact_by_fs_user_id(...)` onward:

Find:
```php
		$contact = STCRM_Database::get_contact_by_fs_user_id( $product_id, $fs_user_id );

		if ( ! $contact ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contacts';
		$name  = sanitize_text_field( trim( ( $user['first'] ?? '' ) . ' ' . ( $user['last'] ?? '' ) ) );
		$email = sanitize_email( $user['email'] ?? '' );

		$update_data    = array( 'updated_at' => gmdate( 'Y-m-d H:i:s' ) );
		$update_formats = array( '%s' );

		if ( $name ) {
			$update_data['name'] = $name;
			$update_formats[]    = '%s';
		}

		if ( $email && $email !== $contact->email ) {
			$update_data['email'] = strtolower( $email );
			$update_formats[]     = '%s';
		}

		$result = $wpdb->update( $table, $update_data, array( 'id' => (int) $contact->id ), $update_formats, array( '%d' ) );

		if ( false === $result ) {
			$this->log( "Failed to update contact #{$contact->id} for user.updated (product {$product_id}) — possibly a duplicate (product_id, email) collision", 'error' );
		}
```
Replace with:
```php
		$contact = STCRM_Database::get_contact_by_fs_user_id( $fs_user_id );

		if ( ! $contact ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'stcrm_contacts';
		$name  = sanitize_text_field( trim( ( $user['first'] ?? '' ) . ' ' . ( $user['last'] ?? '' ) ) );
		$email = sanitize_email( $user['email'] ?? '' );

		$update_data    = array( 'updated_at' => gmdate( 'Y-m-d H:i:s' ) );
		$update_formats = array( '%s' );

		if ( $name ) {
			$update_data['name'] = $name;
			$update_formats[]    = '%s';
		}

		if ( $email && $email !== $contact->email ) {
			$update_data['email'] = strtolower( $email );
			$update_formats[]     = '%s';
		}

		$result = $wpdb->update( $table, $update_data, array( 'id' => (int) $contact->id ), $update_formats, array( '%d' ) );

		if ( false === $result ) {
			$this->log( "Failed to update contact #{$contact->id} for user.updated (product {$product_id}) — possibly a duplicate email collision", 'error' );
		}
```

(Only the lookup call and the log message's wording changed — `$table` still correctly targets `stcrm_contacts` since `name`/`email` genuinely still live there.)

- [ ] **Step 3: Rewrite `handle_license_status_change()`**

Find the `if ( $existing ) { ... } else { ... }` block and replace entirely:

```php
		$existing = STCRM_Database::get_contact_by_email( $email );

		if ( $existing ) {
			// Targeted update — preserve sites_count and other install-level fields
			// already on the contact_products row for this product.
			$cp = STCRM_Database::get_contact_product( (int) $existing->id, $product_id );

			$plan = sanitize_text_field( $license['plan_name'] ?? '' );

			$ok = STCRM_Database::upsert_contact_product(
				(int) $existing->id,
				$product_id,
				$tier,
				array(
					'plan'             => $plan ?: ( $cp->plan ?? null ),
					'status'           => $license_status,
					'expires'          => $this->parse_expiry( $license['expiration'] ?? '' ),
					'license_key_hash' => $cp->license_key_hash ?? null,
					'sites_count'      => $cp->sites_count ?? 0,
				)
			);

			if ( ! $ok ) {
				$this->log( "Failed to update contact_product for contact #{$existing->id} on license status change to {$license_status} (product {$product_id})", 'error' );
			}
		} else {
			// Contact not yet in DB — full upsert so we at least have a record.
			$contact_id = STCRM_Database::upsert_contact( $email, $name, $fs_user_id );
			if ( $contact_id ) {
				STCRM_Database::upsert_contact_product(
					$contact_id,
					$product_id,
					$tier,
					array(
						'plan'             => sanitize_text_field( $license['plan_name'] ?? '' ) ?: null,
						'status'           => $license_status,
						'expires'          => $this->parse_expiry( $license['expiration'] ?? '' ),
						'license_key_hash' => $this->hash_license_key( $license['secret_key'] ?? '' ),
						'sites_count'      => 0,
					)
				);
			}
		}
```

Note the "only overwrite plan when the payload actually carries one" behavior from the pre-Phase-14 code is preserved via `$plan ?: ( $cp->plan ?? null )` — if this event's payload has no `plan_name`, the existing `contact_products` row's plan is kept rather than nulled out. `license_key_hash`/`sites_count` are similarly preserved from the existing row (this event type never carries install-level data, matching the original code's documented limitation).

- [ ] **Step 4: Rewrite `STCRM_Backfill::process_single_install()`**

In `includes/Services/class-stcrm-backfill.php`, find:
```php
		STCRM_Database::upsert_contact( $product_id, $fs_user_id, $email, $name, $tier, $license_data );
```
Replace with:
```php
		$contact_id = STCRM_Database::upsert_contact( $email, $name, $fs_user_id );
		if ( $contact_id ) {
			STCRM_Database::upsert_contact_product( $contact_id, $product_id, $tier, $license_data );
		}
```

- [ ] **Step 5: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l includes/Services/class-stcrm-freemius-sync.php && php -l includes/Services/class-stcrm-backfill.php`
Expected: `No syntax errors detected` for both.

- [ ] **Step 6: Write and run the verification script**

Save to scratchpad as `verify_task6_webhook_backfill.php`:

```php
<?php
$_SERVER['REMOTE_ADDR'] = '203.0.113.202';
require 'C:/laragon/www/sublimetheme/wp-load.php';
global $wpdb;

$settings   = STCRM_Settings::get_settings();
$product_id = (int) $settings['products'][0]['product_id'];
$email      = 'phase14-task6-' . time() . '@example.com';

// Simulate handle_install_event() via reflection (private method) on a fresh payload.
$sync = new STCRM_Freemius_Sync();
$method = new ReflectionMethod( $sync, 'handle_install_event' );
$method->setAccessible( true );
$method->invoke( $sync, $product_id, 'install.installed', array(
	'objects' => array(
		'user'    => array( 'id' => 555444, 'email' => $email, 'first' => 'Task6', 'last' => 'Test' ),
		'install' => array( 'sites_count' => 2 ),
		'license' => array( 'status' => 'active', 'plan_name' => 'Pro', 'secret_key' => 'sk_task6_test' ),
	),
) );

$contact = STCRM_Database::get_contact_by_email( $email );
echo "A) Contact created by webhook: " . ( $contact ? "id={$contact->id} name={$contact->name} fs_user_id={$contact->fs_user_id}" : "MISSING (bug!)" ) . "\n";
$cp = $contact ? STCRM_Database::get_contact_product( $contact->id, $product_id ) : null;
echo "B) contact_product: " . ( $cp ? "tier={$cp->tier} plan={$cp->plan} sites={$cp->sites_count} status={$cp->license_status}" : "MISSING (bug!)" ) . "\n";

// handle_user_updated() via reflection
$method2 = new ReflectionMethod( $sync, 'handle_user_updated' );
$method2->setAccessible( true );
$method2->invoke( $sync, $product_id, array( 'objects' => array( 'user' => array( 'id' => 555444, 'first' => 'Renamed', 'last' => 'Person', 'email' => $email ) ) ) );
$reloaded = STCRM_Database::get_contact_by_email( $email );
echo "C) Name after user.updated: {$reloaded->name} (expect 'Renamed Person')\n";

// handle_license_status_change() via reflection, existing contact branch
$method3 = new ReflectionMethod( $sync, 'handle_license_status_change' );
$method3->setAccessible( true );
$method3->invoke( $sync, $product_id, 'cancelled', 'free', array( 'objects' => array( 'user' => array( 'email' => $email ), 'license' => array() ) ) );
$cp2 = STCRM_Database::get_contact_product( $reloaded->id, $product_id );
echo "D) After license.cancelled: tier={$cp2->tier} status={$cp2->license_status} plan={$cp2->plan} sites={$cp2->sites_count} (expect free/cancelled, plan+sites PRESERVED from B)\n";

// STCRM_Backfill::process_single_install()
$backfill = new STCRM_Backfill();
$method4 = new ReflectionMethod( $backfill, 'process_single_install' );
$method4->setAccessible( true );
$email2 = 'phase14-task6b-' . time() . '@example.com';
$method4->invoke( $backfill, $product_id, array(
	'user_id' => 777666,
	'user'    => array( 'email' => $email2, 'first' => 'Backfill', 'last' => 'Person' ),
	'license' => array( 'id' => 1, 'status' => 'active', 'secret_key' => 'sk_backfill_test' ),
	'plan_name' => 'Solo',
	'sites_count' => 1,
) );
$bf_contact = STCRM_Database::get_contact_by_email( $email2 );
$bf_cp = $bf_contact ? STCRM_Database::get_contact_product( $bf_contact->id, $product_id ) : null;
echo "E) Backfill contact: " . ( $bf_contact ? "id={$bf_contact->id}" : "MISSING (bug!)" ) . ", contact_product: " . ( $bf_cp ? "tier={$bf_cp->tier}" : "MISSING (bug!)" ) . "\n";

// Cleanup
foreach ( array( $contact->id ?? null, $bf_contact->id ?? null ) as $cid ) {
	if ( $cid ) {
		$wpdb->delete( $wpdb->prefix . 'stcrm_contact_products', array( 'contact_id' => $cid ) );
		$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $cid ) );
	}
}
echo "\nCleanup done.\n";
```

Run: `php verify_task6_webhook_backfill.php`

Expected: A/B show a real contact + `pro`/`Pro`/2 sites/`active`; C shows `Renamed Person`; D shows `free`/`cancelled` with `plan`/`sites` preserved from B (not reset); E shows both the backfill contact and its `contact_product` correctly created.

- [ ] **Step 7: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add includes/Services/class-stcrm-freemius-sync.php includes/Services/class-stcrm-backfill.php
git commit -m "Phase 14: rewrite webhook + backfill sync for global contacts

handle_install_event()/handle_license_status_change() now upsert
contact_products alongside the person-level contact instead of writing
tier/plan/license fields directly onto contacts. handle_user_updated()
looks up by fs_user_id alone (person-level now, no product_id).
STCRM_Backfill::process_single_install() gets the same two-step
upsert. The 'only overwrite plan when the payload has one' and
'preserve sites_count on license-status-only events' behaviors are
preserved exactly, just against contact_products instead of contacts.

Verified via a PHP-CLI script driving all 4 rewritten methods via
reflection against real install/user-updated/license-status-change/
backfill payloads."
```

---

### Task 7: Eliminate shell contacts — auth + session layer

**Files:**
- Modify: `api/class-stcrm-auth-controller.php` (`request_magic_link()`, `login_wp_account()`)
- Modify: `api/class-stcrm-session-auth.php` (`authenticate()`'s SSO fallback, `attach()`, `get_contact_ids()`)
- Modify: `api/class-stcrm-tickets-controller.php` (`create_ticket()`'s unknown-contact branch, `get_ticket()`/`create_message()`/`resolve_ticket()`/`reopen_ticket()` ownership checks — no code change needed here, just confirm `get_contact_ids()`'s new simpler return value still satisfies the existing `in_array( ..., get_contact_ids(...), true )` checks)
- Test: scratchpad PHP-CLI script

- [ ] **Step 1: Simplify `request_magic_link()`'s zero-history branch**

In `api/class-stcrm-auth-controller.php`, find (inside the `else` branch handling the generic "sign in to view my tickets" case):
```php
			$matches = STCRM_Database::get_contacts_by_email( $email );

			if ( empty( $matches ) ) {
				// No contact yet — this email has never filed a ticket or
				// logged in before. Same "logged in should mean logged in"
				// principle as login_wp_account()'s shell-contact fallback:
				// receiving mail at this address IS the entire proof of
				// identity this endpoint ever checks (the link click, not
				// this request) — there's no extra enumeration risk in
				// creating a contact and actually sending, since the HTTP
				// response here is already identical either way. Without
				// this, a first-time visitor could never sign in before
				// filing a ticket at all.
				$new_contact_id = STCRM_Database::upsert_contact( 0, 0, $email, '', 'free' );
				$contact        = $new_contact_id ? STCRM_Database::get_contact_by_id( $new_contact_id ) : null;
				if ( null === $contact ) {
					return $ok; // DB failure — still the generic anti-enumeration response.
				}
			} else {
				$contact = $matches[0];
			}
```
Replace with:
```php
			// Phase 14 (2026-07-12): contacts are global now — find-or-create
			// unconditionally, since there's only ever one contact per email
			// to resolve to (no more "several sibling contact rows" case).
			// Same "logged in should mean logged in" principle as
			// login_wp_account()'s shell-contact fallback: receiving mail at
			// this address IS the entire proof of identity this endpoint ever
			// checks (the link click, not this request) — no extra
			// enumeration risk in creating a contact and actually sending,
			// since the HTTP response here is already identical either way.
			$contact_id = STCRM_Database::upsert_contact( $email );
			$contact    = $contact_id ? STCRM_Database::get_contact_by_email( $email ) : null;
			if ( null === $contact ) {
				return $ok; // DB failure — still the generic anti-enumeration response.
			}
```

- [ ] **Step 2: Simplify `login_wp_account()`'s contact resolution**

Find:
```php
		$matches            = STCRM_Database::get_contacts_by_email( $user->user_email );
		$contact_ids        = array_map( static fn( object $c ): int => (int) $c->id, $matches );
		$anchor_contact_id  = $matches ? (int) $matches[0]->id : null; // Most-recently-updated match is the default anchor.
		$resolved_ticket_id = null;

		if ( null !== $ticket_id && $anchor_contact_id ) {
			$ticket = STCRM_Database::get_ticket_by_id( $ticket_id );
			if ( $ticket && in_array( (int) $ticket->contact_id, $contact_ids, true ) ) {
				$anchor_contact_id  = (int) $ticket->contact_id;
				$resolved_ticket_id = $ticket_id;
			}
			// A ticket_id that doesn't belong to this email is silently ignored
			// (same anti-enumeration posture as magic-link) — still signs the
			// user into their own tickets generically rather than failing.
		}

		if ( null === $anchor_contact_id ) {
			$anchor_contact_id = STCRM_Database::upsert_contact( 0, 0, $user->user_email, $user->display_name, 'free' );
			if ( ! $anchor_contact_id ) {
				return STCRM_Rest_Helper::error(
					'stcrm_db_error',
					__( 'A database error occurred. Please try again.', 'sublime-crm' ),
					500
				);
			}
		}
```
Replace with:
```php
		// Phase 14 (2026-07-12): one global contact per email — find-or-create
		// unconditionally, no more "pick an anchor among several sibling rows."
		$anchor_contact_id = STCRM_Database::upsert_contact( $user->user_email, $user->display_name );
		if ( ! $anchor_contact_id ) {
			return STCRM_Rest_Helper::error(
				'stcrm_db_error',
				__( 'A database error occurred. Please try again.', 'sublime-crm' ),
				500
			);
		}

		$resolved_ticket_id = null;
		if ( null !== $ticket_id ) {
			$ticket = STCRM_Database::get_ticket_by_id( $ticket_id );
			if ( $ticket && (int) $ticket->contact_id === $anchor_contact_id ) {
				$resolved_ticket_id = $ticket_id;
			}
			// A ticket_id that doesn't belong to this email is silently ignored
			// (same anti-enumeration posture as magic-link) — still signs the
			// user into their own tickets generically rather than failing.
		}
```

- [ ] **Step 3: Simplify `STCRM_Session_Auth::authenticate()`'s SSO fallback**

In `api/class-stcrm-session-auth.php`, find:
```php
		if ( is_user_logged_in() ) {
			$wp_user = wp_get_current_user();
			$matches = STCRM_Database::get_contacts_by_email( $wp_user->user_email );
			$anchor  = $matches ? $matches[0] : null; // Most-recently-updated — same heuristic as the other login paths.

			$contact_created = false;
			if ( ! $anchor ) {
				$new_id          = STCRM_Database::upsert_contact( 0, 0, $wp_user->user_email, $wp_user->display_name, 'free' );
				$anchor          = $new_id ? STCRM_Database::get_contact_by_id( $new_id ) : null;
				$contact_created = null !== $anchor;
			}

			if ( $anchor && STCRM_Auth_Controller::mint_session( (int) $anchor->id ) ) {
```
Replace with:
```php
		if ( is_user_logged_in() ) {
			$wp_user = wp_get_current_user();

			// Phase 14 (2026-07-12): one global contact per email.
			$existing_before = STCRM_Database::get_contact_by_email( $wp_user->user_email );
			$anchor_id        = STCRM_Database::upsert_contact( $wp_user->user_email, $wp_user->display_name );
			$anchor           = $anchor_id ? STCRM_Database::get_contact_by_email( $wp_user->user_email ) : null;
			$contact_created  = null === $existing_before && null !== $anchor;

			if ( $anchor && STCRM_Auth_Controller::mint_session( (int) $anchor->id ) ) {
```

(The rest of the `if` block — the `STCRM_Logger::info()` call and `$this->attach( $request, $anchor, null ); return true;` — is unchanged; only the contact-resolution lines above it change.)

- [ ] **Step 4: Simplify `attach()` and `get_contact_ids()`**

Replace `attach()` entirely:
```php
	/**
	 * Attach a resolved contact (plus its token, when there is one) to the
	 * request — shared by the cookie-token path and the WP-login SSO fallback.
	 *
	 * @since  1.6.0
	 * @since  1.8.0 Phase 14 — no more sibling-contact expansion; one contact per email.
	 * @param  WP_REST_Request $request
	 * @param  object           $contact
	 * @param  object|null      $token
	 * @return void
	 */
	private function attach( WP_REST_Request $request, object $contact, ?object $token ): void {
		$request->set_param( '_stcrm_contact', $contact );
		$request->set_param( '_stcrm_contact_ids', array( (int) $contact->id ) );
		$request->set_param( '_stcrm_token', $token );
	}
```

Replace `get_contact_ids()`'s docblock only (the method body itself — `return $request->get_param( '_stcrm_contact_ids' ) ?: array();` — is unchanged and still correct, since `attach()` now always sets it to a single-element array):
```php
	/**
	 * The current session's authorized contact ID, as a single-element array
	 * (Phase 14, 2026-07-12: contacts are global now, so there's no more
	 * "sibling contacts across products" to expand — kept as an array purely
	 * so every existing `in_array( $x, get_contact_ids(...), true )` call
	 * site across STCRM_Tickets_Controller keeps working unmodified).
	 *
	 * @since  1.2.0
	 * @since  1.8.0 Phase 14 — always exactly one ID now.
	 * @param  WP_REST_Request $request
	 * @return int[]
	 */
	public static function get_contact_ids( WP_REST_Request $request ): array {
		return $request->get_param( '_stcrm_contact_ids' ) ?: array();
	}
```

Also update the class-level docblock comment referencing "Phase 6.6" sibling-contact behavior if present near the top of the file (grep for "Phase 6.6" in this file specifically) — replace any such comment with a note that this was removed in Phase 14, so a future reader doesn't go looking for sibling-expansion logic that no longer exists.

Also, in the SQL query inside `authenticate()`'s cookie-token path (the `SELECT t.id AS token_id, ... c.product_id, ...` query), remove `c.product_id` from the SELECT list and remove the corresponding `$contact->product_id = (int) $row->product_id;` line below it — the joined `contacts` row no longer has a `product_id` column after Task 2's schema rewrite, so this query would otherwise fail outright.

- [ ] **Step 5: Update `STCRM_Tickets_Controller::create_ticket()`'s unknown-contact branch**

In `api/class-stcrm-tickets-controller.php`, find:
```php
		if ( null === $contact ) {
			$contact_id = STCRM_Database::upsert_contact( $product_id, 0, $email, $name, $tier );
			if ( false === $contact_id ) {
```
Replace with:
```php
		if ( null === $contact ) {
			$contact_id = STCRM_Database::upsert_contact( $email, $name );
			if ( $contact_id ) {
				STCRM_Database::upsert_contact_product( $contact_id, $product_id, $tier );
			}
			if ( false === $contact_id ) {
```

(`$tier` was previously passed straight into `upsert_contact()`; it's now written via `upsert_contact_product()` instead, alongside the ticket's own product. No `$license_data` here — this branch only ever fires for a contact the tier resolver didn't already find/build, i.e. an unverified free-tier submission with no license data to record.)

- [ ] **Step 6: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l api/class-stcrm-auth-controller.php && php -l api/class-stcrm-session-auth.php && php -l api/class-stcrm-tickets-controller.php`
Expected: `No syntax errors detected` for all three.

- [ ] **Step 7: Write and run the verification script**

Save to scratchpad as `verify_task7_auth_session.php`:

```php
<?php
$_SERVER['REMOTE_ADDR'] = '203.0.113.203';
require 'C:/laragon/www/sublimetheme/wp-load.php';
global $wpdb;

// A) request_magic_link() zero-history creates exactly one global contact, no shell hack needed
$email_a = 'phase14-task7a-' . time() . '@example.com';
$req = new WP_REST_Request( 'POST', '/stcrm/v1/auth/magic-link' );
$req->set_param( 'email', $email_a );
$resp = rest_do_request( $req );
echo "A) magic-link request status: " . $resp->get_status() . "\n";
$contact_a = STCRM_Database::get_contact_by_email( $email_a );
echo "B) Contact created: " . ( $contact_a ? "id={$contact_a->id}" : "MISSING (bug!)" ) . "\n";

// C) login_wp_account() with a real WP user + zero contacts
$stamp = time();
$wp_user_id = wp_insert_user( array( 'user_login' => "phase14t7_{$stamp}", 'user_email' => "phase14-task7b-{$stamp}@example.com", 'user_pass' => wp_generate_password(), 'role' => 'subscriber', 'display_name' => 'Task7 Person' ) );
$req2 = new WP_REST_Request( 'POST', '/stcrm/v1/auth/wp-login' );
$req2->set_param( 'identifier', "phase14-task7b-{$stamp}@example.com" );
$req2->set_param( 'password', '' ); // will fail auth -- this is fine, we're testing the DB-layer call, not wp_authenticate
// Call login_wp_account() indirectly is awkward without the real password; instead exercise the
// SSO fallback path directly, which uses the identical upsert_contact() call:
wp_set_current_user( $wp_user_id );
$session_auth = new STCRM_Session_Auth();
$fake_req = new WP_REST_Request( 'GET', '/stcrm/v1/tickets' );
$result = $session_auth->authenticate( $fake_req );
echo "D) SSO fallback authenticate() result: " . ( true === $result ? 'true (correct)' : 'WP_Error (bug!)' ) . "\n";
$contact_b = STCRM_Database::get_contact_by_email( "phase14-task7b-{$stamp}@example.com" );
echo "E) SSO-created contact: " . ( $contact_b ? "id={$contact_b->id} name={$contact_b->name}" : "MISSING (bug!)" ) . "\n";
$contact_ids = STCRM_Session_Auth::get_contact_ids( $fake_req );
echo "F) get_contact_ids() -> " . wp_json_encode( $contact_ids ) . " (expect exactly [" . $contact_b->id . "])\n";

// Cleanup
$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $contact_a->id ) );
$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $contact_b->id ) );
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $wp_user_id );
echo "\nCleanup done.\n";
```

Run: `php verify_task7_auth_session.php`

Expected: A returns `200`; B/C/D/E/F all confirm a single real contact created per path, `get_contact_ids()` returns exactly one ID.

- [ ] **Step 8: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add api/class-stcrm-auth-controller.php api/class-stcrm-session-auth.php api/class-stcrm-tickets-controller.php
git commit -m "Phase 14: eliminate shell contacts across auth + session layer

request_magic_link()'s zero-history branch, login_wp_account()'s
contact resolution, and STCRM_Session_Auth's WP-login SSO fallback all
simplify from 'find or create a product_id=0 shell contact among
several sibling rows' to a plain unconditional upsert_contact() --
there's only ever one global contact per email now, so there's nothing
to pick an anchor among. get_contact_ids() collapses to a single-element
array (kept as an array so every existing in_array() ownership check
across STCRM_Tickets_Controller works unmodified). create_ticket()'s
unknown-contact branch now writes the person via upsert_contact() and
the ticket's product via upsert_contact_product() separately.

Verified via a PHP-CLI script covering magic-link zero-history and the
WP-login SSO fallback, confirming each creates exactly one contact and
get_contact_ids() returns a single ID."
```

---

### Task 8: Verify ticket creation + the per-product guard cap end-to-end

This task is verification-only — Task 7 already updated `create_ticket()`'s one affected line, and the design explicitly kept `STCRM_Guard_Matrix::check_ticket_cap()` unchanged in shape. This task exists to prove that decision actually holds once contacts are global.

**Files:** none modified — verification only
- Test: scratchpad PHP-CLI script

- [ ] **Step 1: Write and run the verification script**

Save to scratchpad as `verify_task8_cap.php`:

```php
<?php
$_SERVER['REMOTE_ADDR'] = '203.0.113.204';
require 'C:/laragon/www/sublimetheme/wp-load.php';
global $wpdb;

$settings = STCRM_Settings::get_settings();
if ( count( $settings['products'] ) < 2 ) {
	echo "Need at least 2 configured products for this test -- found " . count( $settings['products'] ) . ". Aborting.\n";
	exit( 1 );
}
$product_a = (int) $settings['products'][0]['product_id'];
$product_b = (int) $settings['products'][1]['product_id'];
$email = 'phase14-task8-' . time() . '@example.com';

function submit( $product_id, $email, $subject ) {
	$req = new WP_REST_Request( 'POST', '/stcrm/v1/tickets' );
	$req->set_body_params( array( 'email' => $email, 'subject' => $subject, 'message' => 'Task 8 test.', 'product_id' => (string) $product_id ) );
	return rest_do_request( $req );
}

$r1 = submit( $product_a, $email, 'Product A ticket #1' );
echo "A) First ticket on Product A -> " . $r1->get_status() . " (expect 201)\n";
$r2 = submit( $product_a, $email, 'Product A ticket #2' );
echo "B) Second ticket, SAME product, same email -> " . $r2->get_status() . " (expect 409 -- per-product cap still enforced)\n";
$r3 = submit( $product_b, $email, 'Product B ticket #1' );
echo "C) First ticket on Product B, SAME email -> " . $r3->get_status() . " (expect 201 -- different product, cap is independent)\n";

$contacts = $wpdb->get_results( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}stcrm_contacts WHERE email=%s", $email ) );
echo "D) Contact rows for this email: " . count( $contacts ) . " (expect EXACTLY 1 -- this is the core Phase 14 fix)\n";

$tickets = $wpdb->get_results( $wpdb->prepare(
	"SELECT t.id, t.product_id FROM {$wpdb->prefix}stcrm_tickets t
	 JOIN {$wpdb->prefix}stcrm_contacts c ON c.id = t.contact_id WHERE c.email=%s", $email
) );
echo "E) Ticket rows: " . count( $tickets ) . " (expect 2 -- one per product, both under the ONE contact from D)\n";

// Cleanup
foreach ( $tickets as $t ) {
	$wpdb->delete( $wpdb->prefix . 'stcrm_messages', array( 'ticket_id' => $t->id ) );
	$wpdb->delete( $wpdb->prefix . 'stcrm_tickets', array( 'id' => $t->id ) );
}
foreach ( $contacts as $c ) {
	$wpdb->delete( $wpdb->prefix . 'stcrm_contact_products', array( 'contact_id' => $c->id ) );
	$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $c->id ) );
}
echo "\nCleanup done.\n";
```

Run: `php verify_task8_cap.php`

Expected: A `201`, B `409`, C `201`, D exactly `1`, E exactly `2`. If this local install has only one configured product, add a second test product via Settings first, or note in the task result that this specific check was skipped and why.

- [ ] **Step 2: No commit** — nothing was modified in this task.

---

### Task 9: Rewrite the admin Contacts pages

**Files:**
- Modify: `admin/class-stcrm-admin.php` (`render_contacts_page()`, `render_contact_detail_page()`)
- Test: scratchpad PHP-CLI script + Playwright

- [ ] **Step 1: Rewrite `render_contacts_page()`'s table body**

Locate the `<tbody>` loop (currently iterates `foreach ( $contacts as $contact )`, reading `$contact->tier`, `$contact->plan`, `$contact->license_status`, `$contact->product_id` directly — all now gone from the row shape returned by Task 4's rewritten `get_admin_contacts()`, replaced with `product_count`, `has_pro`).

Find the columns rendering tier/plan/license/product (inside the `<tr>` loop):
```php
								<?php if ( count( $products ) > 1 ) : ?>
									<td class="stcrm-col-product">
										<?php echo esc_html( $this->resolve_product_label( (int) $contact->product_id ) ); ?>
									</td>
								<?php endif; ?>
								<td class="stcrm-col-tier">
									<?php echo $this->render_tier_badge( $contact->tier ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
								</td>
								<td class="stcrm-col-plan">
									<?php echo esc_html( $contact->plan ?? '—' ); ?>
								</td>
								<td class="stcrm-col-license">
									<?php echo $this->render_license_badge( $contact->license_status ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
								</td>
```
Replace with:
```php
								<?php if ( count( $products ) > 1 ) : ?>
									<td class="stcrm-col-product">
										<?php
										// Phase 14 (2026-07-12): a contact can span multiple products now.
										if ( 1 === (int) $contact->product_count ) {
											echo esc_html( $this->resolve_product_label_for_contact( (int) $contact->id ) );
										} elseif ( (int) $contact->product_count > 1 ) {
											printf(
												/* translators: %d: number of products */
												esc_html__( '%d products', 'sublime-crm' ),
												(int) $contact->product_count
											);
										} else {
											esc_html_e( '—', 'sublime-crm' );
										}
										?>
									</td>
								<?php endif; ?>
								<td class="stcrm-col-tier">
									<?php echo $this->render_tier_badge( $contact->has_pro ? 'pro' : 'free' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
								</td>
								<td class="stcrm-col-plan">
									<?php echo esc_html( 1 === (int) $contact->product_count ? ( $this->single_product_field( (int) $contact->id, 'plan' ) ?? '—' ) : '—' ); ?>
								</td>
								<td class="stcrm-col-license">
									<?php echo 1 === (int) $contact->product_count
										? $this->render_license_badge( $this->single_product_field( (int) $contact->id, 'license_status' ) ?? 'none' ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
										: '<span class="stcrm-muted">—</span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
									?>
								</td>
```

Also update the `activity` column, which currently reads `$contact->updated_at` — `get_admin_contacts()` (Task 4) now also exposes `product_updated_at`; use the more recent of the two:
```php
								<td class="stcrm-col-activity">
									<span class="stcrm-muted"><?php echo esc_html( $this->human_time_diff_ago( max( $contact->updated_at, $contact->product_updated_at ?? $contact->updated_at ) ) ); ?></span>
								</td>
```

- [ ] **Step 2: Add the two small helper methods this references**

Add near `resolve_product_label()` in the same file:

```php
	/**
	 * For a contact touching exactly one product, resolve that product's
	 * label (Phase 14, 2026-07-12 — the Contacts list only shows a single
	 * product name when there's exactly one to show unambiguously).
	 *
	 * @since  1.8.0
	 * @param  int $contact_id
	 * @return string
	 */
	private function resolve_product_label_for_contact( int $contact_id ): string {
		global $wpdb;
		$product_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT product_id FROM {$wpdb->prefix}stcrm_contact_products WHERE contact_id = %d LIMIT 1",
				$contact_id
			)
		);
		return $this->resolve_product_label( $product_id );
	}

	/**
	 * For a contact touching exactly one product, read one field off that
	 * single contact_products row (Phase 14, 2026-07-12).
	 *
	 * @since  1.8.0
	 * @param  int    $contact_id
	 * @param  string $field 'plan' or 'license_status' — whitelisted, never
	 *                       interpolated from anything user-controlled.
	 * @return string|null
	 */
	private function single_product_field( int $contact_id, string $field ): ?string {
		if ( ! in_array( $field, array( 'plan', 'license_status' ), true ) ) {
			return null;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_var(
			$wpdb->prepare(
				"SELECT {$field} FROM {$wpdb->prefix}stcrm_contact_products WHERE contact_id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$contact_id
			)
		) ?: null;
	}
```

- [ ] **Step 3: Rewrite `render_contact_detail_page()`**

Find the profile card's flat tier/plan/license/sites block:
```php
					<div class="stcrm-profile-badges">
						<?php echo $this->render_tier_badge( $contact->tier ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						<?php echo $this->render_license_badge( $contact->license_status ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					</div>

					<dl class="stcrm-kv-list stcrm-profile-meta">
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Product', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val"><?php echo esc_html( $this->resolve_product_label( (int) $contact->product_id ) ); ?></dd>
						</div>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Email', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val stcrm-kv-list__val--mono"><?php echo esc_html( $contact->email ); ?></dd>
						</div>
						<?php if ( $contact->plan ) : ?>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Plan', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val"><?php echo esc_html( $contact->plan ); ?></dd>
						</div>
						<?php endif; ?>
						<?php if ( $contact->fs_user_id ) : ?>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Freemius ID', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val stcrm-kv-list__val--mono"><?php echo esc_html( $contact->fs_user_id ); ?></dd>
						</div>
						<?php endif; ?>
						<?php if ( (int) $contact->sites_count > 0 ) : ?>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Active sites', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val"><?php echo esc_html( number_format_i18n( (int) $contact->sites_count ) ); ?></dd>
						</div>
						<?php endif; ?>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Customer since', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val"><?php echo esc_html( date_i18n( get_option( 'date_format' ), strtotime( $contact->created_at ) ) ); ?></dd>
						</div>
					</dl>
```
Replace with (fetch `$contact_products` right after `$contact` is loaded, near the top of the method where `$tickets`/`$display_name` are already computed):
```php
					<?php
					global $wpdb;
					$contact_products = $wpdb->get_results( $wpdb->prepare(
						"SELECT * FROM {$wpdb->prefix}stcrm_contact_products WHERE contact_id = %d ORDER BY updated_at DESC",
						$contact_id
					) );
					$has_pro = false;
					foreach ( $contact_products as $cp ) { if ( 'pro' === $cp->tier ) { $has_pro = true; break; } }
					?>
					<div class="stcrm-profile-badges">
						<?php echo $this->render_tier_badge( $has_pro ? 'pro' : 'free' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					</div>

					<dl class="stcrm-kv-list stcrm-profile-meta">
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Email', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val stcrm-kv-list__val--mono"><?php echo esc_html( $contact->email ); ?></dd>
						</div>
						<?php if ( $contact->fs_user_id ) : ?>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Freemius ID', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val stcrm-kv-list__val--mono"><?php echo esc_html( $contact->fs_user_id ); ?></dd>
						</div>
						<?php endif; ?>
						<div class="stcrm-kv-list__row">
							<dt class="stcrm-kv-list__key"><?php esc_html_e( 'Customer since', 'sublime-crm' ); ?></dt>
							<dd class="stcrm-kv-list__val"><?php echo esc_html( date_i18n( get_option( 'date_format' ), strtotime( $contact->created_at ) ) ); ?></dd>
						</div>
					</dl>

					<?php if ( ! empty( $contact_products ) ) : ?>
					<h3 style="margin-top:18px;font-size:13px;text-transform:uppercase;color:var(--stcrm-muted,#666);"><?php esc_html_e( 'Products', 'sublime-crm' ); ?></h3>
					<table class="wp-list-table widefat fixed striped">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Product', 'sublime-crm' ); ?></th>
								<th><?php esc_html_e( 'Tier', 'sublime-crm' ); ?></th>
								<th><?php esc_html_e( 'Plan', 'sublime-crm' ); ?></th>
								<th><?php esc_html_e( 'License', 'sublime-crm' ); ?></th>
								<th><?php esc_html_e( 'Sites', 'sublime-crm' ); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ( $contact_products as $cp ) : ?>
							<tr>
								<td><?php echo esc_html( $this->resolve_product_label( (int) $cp->product_id ) ); ?></td>
								<td><?php echo $this->render_tier_badge( $cp->tier ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></td>
								<td><?php echo esc_html( $cp->plan ?: '—' ); ?></td>
								<td><?php echo $this->render_license_badge( $cp->license_status ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></td>
								<td><?php echo (int) $cp->sites_count > 0 ? esc_html( number_format_i18n( (int) $cp->sites_count ) ) : '—'; ?></td>
							</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
					<?php else : ?>
					<p class="stcrm-muted" style="margin-top:14px;"><?php esc_html_e( 'No product history yet.', 'sublime-crm' ); ?></p>
					<?php endif; ?>
```

- [ ] **Step 4: Update the ticket-history call site**

Find:
```php
		$tickets      = STCRM_Database::get_tickets_by_contact( (int) $contact->product_id, $contact_id, 1, 50 );
```
Replace with:
```php
		// Phase 14 (2026-07-12): ticket history now spans every product this
		// contact has touched, not just one — $product_id omitted entirely.
		$tickets      = STCRM_Database::get_tickets_by_contact( $contact_id, null, 1, 50 );
```

If the ticket-history `<table>` further down doesn't already show a Product column, add one (find the ticket-history `<thead>`/`<tbody>` loop and add a `<th>Product</th>` / `<td><?php echo esc_html( $this->resolve_product_label( (int) $ticket->product_id ) ); ?></td>` pair, matching the existing column style) — `get_tickets_by_contact()`'s rewritten `SELECT` (Task 4 Step 4) already includes `t.product_id` in its result rows, so no further backend change is needed for this.

- [ ] **Step 5: Lint check**

Run: `cd wp-content/plugins/sublime-crm && php -l admin/class-stcrm-admin.php`
Expected: `No syntax errors detected`.

- [ ] **Step 6: PHP-CLI verification**

Save to scratchpad as `verify_task9_admin_pages.php`:

```php
<?php
$_SERVER['REMOTE_ADDR'] = '203.0.113.205';
require 'C:/laragon/www/sublimetheme/wp-load.php';
global $wpdb;

$settings = STCRM_Settings::get_settings();
$product_a = (int) $settings['products'][0]['product_id'];
$product_b = isset( $settings['products'][1] ) ? (int) $settings['products'][1]['product_id'] : null;
$email = 'phase14-task9-' . time() . '@example.com';

$contact_id = STCRM_Database::upsert_contact( $email, 'Task9 Person' );
STCRM_Database::upsert_contact_product( $contact_id, $product_a, 'free', array( 'plan' => null ) );
if ( $product_b ) {
	STCRM_Database::upsert_contact_product( $contact_id, $product_b, 'pro', array( 'plan' => 'Agency', 'status' => 'active' ) );
}

$rows = STCRM_Database::get_admin_contacts( null, 1, 20 );
$row = null;
foreach ( $rows as $r ) { if ( (int) $r->id === $contact_id ) { $row = $r; break; } }
echo "A) Found in admin list: " . ( $row ? 'yes' : 'NO (bug!)' ) . "\n";
if ( $row ) {
	echo "B) product_count={$row->product_count} has_pro=" . var_export( (bool) $row->has_pro, true ) . " (expect " . ( $product_b ? '2/true' : '1/false' ) . ")\n";
}

$tickets_page = STCRM_Database::get_tickets_by_contact( $contact_id, null, 1, 50 );
echo "C) get_tickets_by_contact(contact_id, null, ...) callable with new signature: " . ( is_array( $tickets_page ) ? 'yes' : 'NO (bug!)' ) . "\n";

// Cleanup
$wpdb->delete( $wpdb->prefix . 'stcrm_contact_products', array( 'contact_id' => $contact_id ) );
$wpdb->delete( $wpdb->prefix . 'stcrm_contacts', array( 'id' => $contact_id ) );
echo "\nCleanup done.\n";
```

Run: `php verify_task9_admin_pages.php`
Expected: A `yes`; B matches the number of products configured on this install; C `yes`.

- [ ] **Step 7: Playwright verification**

Dispatch a Playwright check (real admin login) confirming: the Contacts list page loads with no PHP errors/warnings visible; a contact touching 2+ products shows "N products" in the Product column and a Pro tier badge if any of their products is Pro; the Contact detail page for that same contact shows a per-product table with correct tier/plan/license per row, and its ticket history includes tickets from every product. Clean up all test data afterward.

- [ ] **Step 8: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add admin/class-stcrm-admin.php
git commit -m "Phase 14: rewrite admin Contacts pages for one-row-per-person

List page: Product column shows 'N products' (or the single product
name) instead of one hardcoded product_id; Tier badge is Pro if any of
the contact's products is Pro. Detail page: flat Tier/Plan/License/
Sites block replaced with a per-product table (one row per
contact_products entry); ticket history now spans every product the
contact has touched (get_tickets_by_contact()'s product_id is null),
gaining a Product column per row.

Verified via PHP-CLI (multi-product contact correctly aggregated) and
Playwright (both pages render correctly for a real multi-product
contact, no errors)."
```

---

### Task 10: Move the password on-ramp to the first sign-in

**Files:**
- Create: `src/portal/SetPasswordPrompt.jsx`
- Modify: `src/portal/MyTicketsView.jsx` (remove local `SetPasswordPrompt`, import the shared one)
- Modify: `src/portal/EmptyView.jsx` (render `SetPasswordPrompt` too)
- Test: Playwright

- [ ] **Step 1: Extract `SetPasswordPrompt` to its own file**

Read the current `SetPasswordPrompt` function body out of `src/portal/MyTicketsView.jsx` (lines 16-109 per the last read of this file this session) and create `src/portal/SetPasswordPrompt.jsx`:

```jsx
import { useState } from '@wordpress/element';
import apiFetch       from './api.js';

// ─── Set-password prompt ──────────────────────────────────────────────────
//
// Phase 13's original on-ramp (2026-06-25): shown once a session exists
// (proves email ownership via magic-link or an earlier password sign-in) to
// anyone with no plain WP account yet, so they can sign in with a password
// next time instead of waiting on another magic-link email. Never touches an
// existing account — set_password() guards server-side, but has_wp_account
// already keeps this out of that account's way entirely.
//
// Phase 14 (2026-07-12): extracted out of MyTicketsView.jsx into its own
// file so EmptyView.jsx can render it too — the whole point of this change
// is offering this prompt on the very first sign-in, zero tickets required,
// not only once a ticket exists.

export default function SetPasswordPrompt( { hasWpAccount } ) {
	const [ open,      setOpen      ] = useState( false );
	const [ password,  setPassword  ] = useState( '' );
	const [ confirm,   setConfirm   ] = useState( '' );
	const [ saving,    setSaving    ] = useState( false );
	const [ err,       setErr       ] = useState( null );
	const [ done,      setDone      ] = useState( false );

	if ( hasWpAccount ) {
		return (
			<div className="pt-card" style={ { padding: '16px 20px', marginBottom: 18, fontSize: 13.5 } }>
				You already have an account for this email — sign in with your password next time.
			</div>
		);
	}

	if ( done ) {
		return (
			<div className="pt-card" style={ { padding: '16px 20px', marginBottom: 18, fontSize: 13.5, color: '#0a6116' } }>
				Password set — sign in with your email + password next time.
			</div>
		);
	}

	async function handleSubmit( e ) {
		e.preventDefault();
		if ( password.length < 8 ) {
			setErr( 'Password must be at least 8 characters.' );
			return;
		}
		if ( password !== confirm ) {
			setErr( 'Passwords do not match.' );
			return;
		}

		setSaving( true );
		setErr( null );
		try {
			await apiFetch( { path: '/stcrm/v1/auth/set-password', method: 'POST', data: { password } } );
			setDone( true );
		} catch ( error ) {
			setErr( error?.message ?? 'Something went wrong. Please try again.' );
		} finally {
			setSaving( false );
		}
	}

	if ( ! open ) {
		return (
			<div className="pt-card" style={ { padding: '16px 20px', marginBottom: 18 } }>
				<div className="row ac jb g16">
					<span style={ { fontSize: 13.5 } }>Set a password for faster sign-in next time.</span>
					<button className="pt-btn" onClick={ () => setOpen( true ) } style={ { flexShrink: 0 } }>
						Set password
					</button>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={ handleSubmit } className="pt-card" style={ { padding: '18px 20px', marginBottom: 18 } }>
			{ err && <div className="pt-form-error" style={ { marginBottom: 12 } }>{ err }</div> }
			<div className="row g12 wrap" style={ { alignItems: 'flex-end' } }>
				<div className="pt-field grow" style={ { marginBottom: 0, minWidth: 160 } }>
					<label className="pt-label">New password</label>
					<input
						type="password"
						className="pt-input"
						autoComplete="new-password"
						value={ password }
						onChange={ ( e ) => setPassword( e.target.value ) }
					/>
				</div>
				<div className="pt-field grow" style={ { marginBottom: 0, minWidth: 160 } }>
					<label className="pt-label">Confirm password</label>
					<input
						type="password"
						className="pt-input"
						autoComplete="new-password"
						value={ confirm }
						onChange={ ( e ) => setConfirm( e.target.value ) }
					/>
				</div>
				<button type="submit" className="pt-btn pt-btn-primary" disabled={ saving } style={ { flexShrink: 0 } }>
					{ saving ? 'Saving…' : 'Save' }
				</button>
				<button type="button" className="pt-btn" onClick={ () => setOpen( false ) } style={ { flexShrink: 0 } }>
					Cancel
				</button>
			</div>
		</form>
	);
}
```

- [ ] **Step 2: Update `MyTicketsView.jsx`**

Remove the entire local `function SetPasswordPrompt( { hasWpAccount } ) { ... }` block (lines 16-109) from `src/portal/MyTicketsView.jsx`, and add an import at the top of the file:
```jsx
import SetPasswordPrompt from './SetPasswordPrompt.jsx';
```
The existing usage `<SetPasswordPrompt hasWpAccount={ !! contact.has_wp_account } />` further down in the file needs no change — it already matches the extracted component's props exactly.

- [ ] **Step 3: Add `SetPasswordPrompt` to `EmptyView.jsx`**

Read the current `src/portal/EmptyView.jsx` first to find where its "Signed in as {email} · Sign out" header line renders (per the 2026-07-10 bugfix, `EmptyView` already receives `session` as a prop). Add the import:
```jsx
import SetPasswordPrompt from './SetPasswordPrompt.jsx';
```
And render it right after the "Signed in as..." header block, before the "No tickets yet" empty-state content — matching where `MyTicketsView.jsx` places it (immediately below its own header, before the ticket list):
```jsx
<SetPasswordPrompt hasWpAccount={ !! session?.contact?.has_wp_account } />
```

- [ ] **Step 4: Rebuild**

Run: `cd wp-content/plugins/sublime-crm && npm run build`
Expected: webpack compiles successfully, no errors; `stcrm-portal.js` regenerated.

- [ ] **Step 5: Playwright verification**

Dispatch a Playwright check: mint a session for a contact with zero tickets and `has_wp_account: false` (via `GET /me`), navigate to the portal — confirm `EmptyView` renders and now shows the "Set a password for faster sign-in next time" prompt (not just on `MyTicketsView`). Complete the flow (set a password, confirm success message). Separately confirm `MyTicketsView`'s existing prompt (for a contact WITH a ticket) still renders identically to before — no regression from the extraction. Clean up test data afterward.

- [ ] **Step 6: Commit**

```bash
cd wp-content/plugins/sublime-crm
git add src/portal/SetPasswordPrompt.jsx src/portal/MyTicketsView.jsx src/portal/EmptyView.jsx admin/js/stcrm-portal.js admin/js/stcrm-portal.asset.php
git commit -m "Phase 14: offer the password on-ramp on the very first sign-in

SetPasswordPrompt extracted from MyTicketsView.jsx into its own shared
file so EmptyView.jsx can render it too -- previously it only appeared
once a ticket existed. Directly answers Issue #3 ('isn't a WP user
yet'): magic link stays the only first-time entry point, but the
'Set a password' offer now appears immediately after that first
sign-in instead of requiring a second visit.

Verified via Playwright: prompt renders on EmptyView for a zero-ticket
session, full set-password flow completes successfully; MyTicketsView's
existing prompt confirmed unchanged after the extraction."
```

---

### Task 11: Full end-to-end verification + final cleanup pass

**Files:** none modified — verification only

- [ ] **Step 1: Re-run every prior task's PHP-CLI script back-to-back**

Run each of `verify_task4_db_layer.php` through `verify_task9_admin_pages.php` (skip Task 8's, already run standalone) once more in sequence, against the fully-assembled codebase, to catch any cross-task interaction a single-task run might have missed.

- [ ] **Step 2: One combined multi-product, multi-auth-path scenario**

Write and run a final scratchpad script that: creates one person via magic link (zero tickets) → confirms `SetPasswordPrompt` would be offered (`has_wp_account: false` via `GET /me`) → files a ticket on Product A (free tier) → files a ticket on Product B with an active license key (pro tier on B only) → confirms exactly one `wp_stcrm_contacts` row exists for this email throughout → confirms `wp_stcrm_contact_products` has exactly 2 rows (A: free, B: pro) → confirms the guard cap blocks a second Product-A ticket but allows a second Product-B... wait, Product B is pro-tier now, so its cap is `guard_pro_open` (default 5), not 1 — confirm a second Product B ticket is *allowed* (since pro cap is 5, not hit yet) while a second Product A ticket is still blocked (free cap is 1). Delete everything afterward, confirm zero rows remain across all 5 SublimeCRM tables for this test email.

- [ ] **Step 3: `php -l` every touched file one final time**

Run: `cd wp-content/plugins/sublime-crm && for f in includes/Database/class-stcrm-database.php includes/Services/class-stcrm-tier-resolver.php includes/Services/class-stcrm-freemius-sync.php includes/Services/class-stcrm-backfill.php api/class-stcrm-tickets-controller.php api/class-stcrm-auth-controller.php api/class-stcrm-session-auth.php admin/class-stcrm-admin.php sublime-crm.php; do php -l "$f"; done`
Expected: `No syntax errors detected` for every file listed.

- [ ] **Step 4: `npm run build` one final time**

Run: `cd wp-content/plugins/sublime-crm && npm run build`
Expected: clean compile, no errors or warnings about missing imports.

- [ ] **Step 5: Update plugin `CLAUDE.md`**

Add a new changelog entry (following this project's established format — see any prior Phase entry in the same file for the exact style) documenting: what changed, why, the key file list, and a summary of the verification performed across Tasks 4-11.

- [ ] **Step 6: Flip every checklist item in `phase-plan-clickup.md` Phase 14 to `[x]`**

In the docs repo, mark all 14 checklist items done, add an "Implementation notes" + "Verified" section matching the format of every other completed phase in that file (see Phase 12/13 for the exact structure), and update the Summary table row from "designed, not started" to "✅ COMPLETE."

- [ ] **Step 7: Final combined commit + push, both repos**

Do not commit/push without the user's explicit go-ahead, per this project's standing convention — present the full verification summary and wait for "commit and push" before running `git add`/`git commit`/`git push` in either `wp-content/plugins/sublime-crm/` or `wp-content/CRM-Plugin/`.

---

## Self-Review

**Spec coverage** — every one of Phase 14's 14 design-doc checklist items maps to a task above: schema rewrite (Task 2), manual reset (Task 3), `get_contact_by_email()`/`get_contacts_by_email()` (Task 4), new contact_products methods (Task 4), tier resolver two-step (Task 5), shell-contact call sites (Task 7), `get_contact_ids()` collapse (Task 7), guard-cap verification (Task 8), `SetPasswordPrompt` extraction (Task 10), `get_admin_contacts()`/`count_contacts()`/`get_contacts_last_updated()`/`get_tickets_by_contact()` (Task 4 + Task 9), admin Contacts list/detail pages (Task 9). One item beyond the original design doc's scope was found necessary while writing this plan and folded in: the Freemius webhook + backfill sync rewrite (Task 6) — not optional, since both write directly to columns the schema rewrite removes from `contacts`.

**Placeholder scan** — no TBD/TODO/"add appropriate error handling" language anywhere above; every code block is complete, runnable code, not a sketch.

**Type consistency** — `upsert_contact( string $email, string $name = '', int $fs_user_id = 0 ): int|false` is used with this exact signature in every task from Task 4 onward (Tasks 5, 6, 7). `get_tickets_by_contact( int $contact_id, ?int $product_id = null, int $page = 1, int $per_page = 20 )`'s new parameter order is called correctly in both its Task 4 definition and its one Task 9 call site. `get_contact_ids()`'s return type (`int[]`) is unchanged from before Phase 14, so no existing caller outside this plan's scope needs touching.

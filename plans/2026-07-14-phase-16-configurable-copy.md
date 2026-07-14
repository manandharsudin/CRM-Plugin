# Phase 16 — Configurable Portal & Launcher Copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every primary UI string across the Support Portal's 7 view components and the floating launcher admin-customizable — portal text via a block attribute edited through Inspector Controls (with a state-switchable live-look preview in the editor canvas), launcher text via a new Settings tab — with zero behavior/visual change for any install that doesn't touch the new controls.

**Architecture:** One flat, per-screen-grouped `DEFAULT_COPY` object per surface (`src/portal/copy-defaults.js`, `src/launcher/copy-defaults.js`) is the single source of default English text. Overrides are stored sparse (only explicitly-customized keys) — a block attribute `copy` (object, default `{}`) for the portal, a `launcher_copy` setting (array, default `[]`) for the launcher. Every view component reads merged copy (`{ ...DEFAULTS[screen], ...overrides[screen] }`) via a small React Context (`CopyContext`/`useCopy()`), never hardcoded JSX text directly. Every portal view component also gains a `previewMode` prop: when true, API-calling `useEffect`s are replaced with fixed sample data and every handler becomes a no-op, so the block editor can render the *real* component inertly instead of a static mockup or a genuinely-live (and therefore unsafe — real tickets/emails) app.

**Tech Stack:** PHP 8.2+ (WordPress plugin), React 18 via `@wordpress/element` + `@wordpress/block-editor`/`@wordpress/components` for the editor UI, vanilla `$wpdb`-free (no DB changes this phase) — pure settings/attributes.

## Global Constraints

- This plugin has no PHPUnit suite. Every task's "test" is a disposable PHP-CLI assertion script (`require 'wp-load.php'` from the plugin root) and/or a Playwright script against the real local site (`sublimetheme.test`), matching how every prior phase in this project was verified. Do not introduce a `tests/`/PHPUnit bootstrap.
- Every PHP file touched must pass `php -l` before being considered done.
- Every JS/JSX file touched requires `npm run build` (run from `wp-content/plugins/sublime-crm/`) before Playwright verification — this plugin ships pre-built `admin/js/*.js` bundles, not source-served.
- **No DB schema changes in this phase at all** — pure settings/attributes, `STCRM_DB_VERSION` does not change.
- All verification test data (settings values, block attributes on a real page) must be restored to defaults / cleaned up at the end of each task's verification step.
- Sparse-by-default storage is a hard requirement: an untouched install (empty `copy` attribute / empty `launcher_copy` setting) MUST render byte-identical output to pre-Phase-16 — every task's verification must include an explicit "defaults still render correctly with zero overrides" check, not just "overrides work."
- Error/fallback/server-driven strings (e.g. `'Something went wrong. Please try again.'`, `'Unable to load ticket. Please refresh.'`, real 409/429 API error text) are explicitly OUT of scope — do not add copy keys for them, per the approved design.
- `SetPasswordPrompt.jsx` (shared by `MyTicketsView.jsx`/`EmptyView.jsx`) is explicitly OUT of scope for this phase — not in the approved design's file list, leave its hardcoded text untouched.

---

## File Map

| File | Change |
|---|---|
| `src/portal/copy-defaults.js` | **New.** `DEFAULT_COPY` object (all 9 portal screens) + `CopyContext`/`CopyProvider`/`useCopy()` |
| `src/portal/App.jsx` | Wrap `RouteView` in `CopyProvider`, sourced from `window.stcrmPortal.copy` |
| `src/portal/NewTicketView.jsx` | Replace hardcoded text with `useCopy('newTicket')`; extract `SuccessState` as a named export reading `useCopy('ticketSubmitted')`; add `previewMode` prop |
| `src/portal/CapReachedView.jsx` | Replace hardcoded text with `useCopy('capReachedFree')`/`useCopy('capReachedPro')`; add `previewMode` prop |
| `src/portal/AuthView.jsx` | Replace hardcoded text with `useCopy('signIn')`; extract sent-state as named export `SentState` reading `useCopy('checkInbox')`; add `previewMode` prop |
| `src/portal/ExpiredView.jsx` | Replace hardcoded text with `useCopy('expiredLink')`; its local `CheckInboxState` reads `useCopy('checkInbox')` (shared namespace with `AuthView`'s `SentState` — same screen, reached two ways); add `previewMode` prop |
| `src/portal/MyTicketsView.jsx` | Replace hardcoded text with `useCopy('myTickets')`; add `previewMode` prop |
| `src/portal/EmptyView.jsx` | Replace hardcoded text with `useCopy('emptyState')`; add `previewMode` prop |
| `src/portal/ThreadView.jsx` | Replace hardcoded text with `useCopy('thread')`; add `previewMode` prop |
| `blocks/support-portal/block.json` | Add `attributes: { copy: { type: 'object', default: {} } }` |
| `blocks/support-portal/render.php` | Pass `$attributes['copy']` through `wp_localize_script` |
| `src/portal/editor.jsx` | Rewritten from bare placeholder into a real component: state switcher + per-screen `InspectorControls` + inert canvas preview |
| `src/launcher/copy-defaults.js` | **New.** `DEFAULT_COPY` for the launcher's screens + `CopyContext`/`CopyProvider`/`useCopy()` |
| `src/launcher/Launcher.jsx` | Replace hardcoded text with `useCopy()`, wrap root in `CopyProvider` sourced from `window.stcrmLauncher.copy` |
| `includes/class-stcrm-launcher.php` | Localize `launcher_copy` setting into `window.stcrmLauncher.copy` |
| `includes/class-stcrm-launcher-copy.php` | **New.** `STCRM_Launcher_Copy::DEFAULTS` — PHP mirror of `src/launcher/copy-defaults.js`, used only for Settings-tab placeholder text |
| `admin/class-stcrm-settings.php` | Add `launcher_copy => []` to `$defaults`; new "Launcher" Settings tab (moves `launcher_enabled` here from Advanced, adds text fields); new `'launcher'` case in `handle_save()` |

---

## Copy Key Schema (reference for every task below)

### Portal — `src/portal/copy-defaults.js`

```js
export const DEFAULT_COPY = {
	newTicket: {
		heading: 'How can we help?',
		subtitle: 'Open a support ticket and we’ll reply by email — no account needed.',
		viewTicketsLink: 'View your tickets →',
		wpRecognizedNote: 'You don’t have any tickets yet.',
		emailLabel: 'Your email',
		emailPlaceholder: 'you@yoursite.com',
		emailLockedNote: 'Verified via sign-in — this ticket will be tied to this email.',
		nameLabel: 'Name',
		nameOptionalTag: '(optional)',
		namePlaceholder: 'Jane Doe',
		subjectLabel: 'Subject',
		subjectPlaceholder: 'Short summary of the issue',
		categoryLabel: 'Category',
		selectPlaceholder: '— Select —',
		productLabel: 'Which product is this about?',
		productLoadingPlaceholder: 'Loading…',
		messageLabel: 'How can we help?',
		messagePlaceholder: 'Describe what’s happening, what you expected, and any steps to reproduce…',
		licenseKeyLabel: 'License key',
		licenseKeyHint: '(optional — only if your support email differs from your purchase email)',
		licenseKeyPlaceholder: 'sk_••••••••••••',
		envToggleLabel: '+ Add environment details (optional)',
		envSiteUrlLabel: 'Site URL',
		envSiteUrlPlaceholder: 'https://yoursite.com',
		envWpLabel: 'WP',
		envWpPlaceholder: '6.8',
		envPhpLabel: 'PHP',
		envPhpPlaceholder: '8.2',
		envPluginLabel: 'Plugin',
		envPluginPlaceholder: '2.4.1',
		submitLabel: 'Submit ticket',
		submitSendingLabel: 'Submitting…',
		submitNote: 'We usually reply within a few hours.',
		docsCardTitle: 'Before you post',
		docsCardBody: 'Many questions are answered in our documentation — setup, demo import, and common conflicts.',
		docsCardLink: 'Search the docs',
		proCardTitle: 'Faster replies',
		proCardBody: 'Use your purchase email and you’re verified automatically — your tickets are prioritized, no license key needed.',
		privacyNote: 'Your details are used only to handle your request. We reply by email with a secure link to your conversation.',
		formUnavailableTitle: 'Support form unavailable',
		formUnavailableBody: 'No products are configured for support yet. Please contact the site administrator.',
	},
	ticketSubmitted: {
		heading: 'Ticket submitted!',
		body: 'We’ll reply by email — check your inbox for a sign-in link to follow this conversation.',
		ctaLabel: 'View your tickets',
	},
	capReachedFree: {
		crumb: 'Support',
		heading: 'How can we help?',
		subtitle: 'Open a support ticket and we’ll reply by email — no account needed.',
		bannerTitle: 'You already have an open ticket',
		bannerBody: 'Free accounts keep one open ticket at a time so we can give each one proper attention. Please continue the conversation on your existing ticket.',
		loadingLabel: 'Loading…',
		ctaAuthenticated: 'Go to my ticket',
		ctaUnauthenticated: 'Sign in to view',
		footerNote: 'Pro customers can keep up to 5 open tickets at a time — upgrade to get faster replies and more concurrent threads.',
	},
	capReachedPro: {
		crumb: 'Support',
		heading: 'How can we help?',
		subtitle: 'Open a support ticket and we’ll reply by email — no account needed.',
		bannerTitle: 'You’ve reached your open ticket limit',
		bannerBody: 'You have the maximum number of open tickets. Please resolve or close an existing ticket before opening a new one.',
		ctaAuthenticated: 'View my tickets',
		ctaUnauthenticated: 'Sign in to view your tickets',
	},
	signIn: {
		heading: 'Sign in to view your tickets',
		subtitle: 'Already have a WordPress account on this site? Use it below — or we can email you a sign-in link instead.',
		passwordUsernameLabel: 'Username or email',
		passwordLabel: 'Password',
		passwordSubmitLabel: 'Sign in with password',
		passwordSubmitSendingLabel: 'Signing in…',
		orDivider: 'or',
		emailLabel: 'Email address',
		emailSubmitLabel: 'Email me a sign-in link',
		emailSubmitSendingLabel: 'Sending…',
		privacyNote: 'For your security we never confirm whether an email has an account.',
		submitTicketInsteadLink: 'Don’t want to sign in? Submit a ticket instead →',
	},
	checkInbox: {
		heading: 'Check your inbox',
		body: 'If that address has tickets, a sign-in link is on its way. The link works once and expires in 48 hours.',
		useAnotherEmailLink: '← Use a different email',
		privacyNote: 'For your security we never confirm whether an email has an account.',
		submitTicketInsteadLink: 'Don’t want to sign in? Submit a ticket instead →',
	},
	expiredLink: {
		heading: 'This link has expired',
		body: 'Sign-in links are single-use and expire after 48 hours. Enter your email to receive a new one.',
		emailLabel: 'Email address',
		submitLabel: 'Send a new link',
		submitSendingLabel: 'Sending…',
		passwordInsteadLink: 'Sign in with your password instead →',
		submitTicketInsteadLink: 'Don’t want to sign in? Submit a ticket instead →',
	},
	myTickets: {
		heading: 'My tickets',
		signedInAsPrefix: 'Signed in as',
		signOutLink: 'Sign out',
		signingOutLabel: 'Signing out…',
		newTicketButton: '+ New ticket',
		unreadPillTemplate: '{count} new {word}',
		updatedPrefix: 'Updated',
	},
	emptyState: {
		heading: 'My tickets',
		iconAltHeading: 'No tickets yet',
		body: 'When you open a support request it’ll appear here, so you can follow the whole conversation in one place.',
		ctaLabel: 'Open your first ticket',
	},
	thread: {
		backLink: '← My tickets',
		resolveButton: 'Mark as resolved',
		resolvingLabel: 'Marking resolved…',
		detailsToggleLabel: 'Ticket details you submitted',
		updatesNote: 'updates automatically — checking for replies',
		lockedClosedTitle: 'This ticket has been closed',
		lockedClosedBody: 'Open a new ticket if you need further help.',
		lockedResolvedTitle: 'This ticket has been marked resolved',
		lockedResolvedBody: 'Still need help with this? Reopen it to add more details — otherwise, open a new ticket any time.',
		reopenButton: 'Reopen ticket',
		reopeningLabel: 'Reopening…',
		lockedTurnLimitTitle: 'Thanks — we’ve received your messages',
		lockedTurnLimitBody: 'You’ll get an email the moment we reply. You’ll be able to respond again right here once we’ve gotten back to you.',
		replyPlaceholder: 'Write a reply…',
		repliesLeftTemplate: '{remaining} of {turnLimit} {word} left before an agent responds',
		sendButton: 'Send reply',
		sendingLabel: 'Sending…',
	},
};
```

### Launcher — `src/launcher/copy-defaults.js`

```js
export const DEFAULT_COPY = {
	panelHeader: {
		title: 'Support',
		subtitle: 'We usually reply within a few hours',
	},
	compose: {
		docsLink: 'Check our docs first',
		emailLabel: 'Email',
		nameLabel: 'Name',
		nameOptionalTag: '(optional)',
		subjectLabel: 'Subject',
		categoryLabel: 'Which product is this about?',
		selectPlaceholder: '— Select —',
		productLoadingPlaceholder: 'Loading…',
		messageLabel: 'Message',
		messagePlaceholder: 'How can we help?',
		licenseKeyPlaceholder: 'sk_••••••••••••',
		submitLabel: 'Send message',
		submitSendingLabel: 'Sending…',
		alreadySignedIn: 'Already signed in',
		backToTicketsLink: 'Back to my tickets →',
		alreadyHaveTicket: 'Already have a ticket?',
		signInLink: 'Sign in →',
		formUnavailableTitle: 'Support form unavailable',
		formUnavailableBody: 'No products are configured for support yet. Please contact the site administrator.',
	},
	sent: {
		heading: 'We’ve received your message',
		body: 'Check your email for a sign-in link to view and track your ticket.',
		ctaLabel: 'Sign in to view →',
	},
	myTickets: {
		kicker: 'My tickets',
		newButton: '+ New',
		signedInAsPrefix: 'Signed in as',
		signOutLink: 'Sign out',
		signingOutLabel: 'Signing out…',
		emptyLabel: 'No tickets yet.',
	},
	thread: {
		replyPlaceholder: 'Reply…',
		lockedClosed: 'This ticket is closed.',
		lockedResolved: 'This ticket has been marked resolved.',
		lockedTurnLimit: 'Reply limit reached — wait for an agent response.',
		reopenButton: 'Reopen',
		reopeningLabel: 'Reopening…',
	},
};
```

---

### Task 1: Portal `copy-defaults.js` + `CopyContext`

**Files:**
- Create: `src/portal/copy-defaults.js`

**Interfaces:**
- Produces: `DEFAULT_COPY` (object, 9 top-level screen keys, per schema above), `CopyContext` (React context), `CopyProvider({ overrides, children })` (component), `useCopy( screen )` (hook — returns `{ ...DEFAULT_COPY[screen], ...(overrides?.[screen] ?? {}) }`)

- [ ] **Step 1: Create the file with defaults + context**

```js
/**
 * Single source of default English copy for the Support Portal, plus the
 * React Context used to read merged (defaults + admin overrides) copy from
 * every view component without prop-drilling. Phase 16, 2026-07-14.
 */
import { createContext, useContext } from '@wordpress/element';

export const DEFAULT_COPY = {
	// ... (paste the full DEFAULT_COPY object from the "Copy Key Schema" section above, portal block)
};

const CopyContext = createContext( {} );

/**
 * @param {object}  props
 * @param {object}  [props.overrides] Sparse override object, same shape as
 *                                    DEFAULT_COPY but only customized keys
 *                                    present (e.g. { newTicket: { heading: '...' } }).
 * @param {ReactNode} props.children
 */
export function CopyProvider( { overrides = {}, children } ) {
	return (
		<CopyContext.Provider value={ overrides }>
			{ children }
		</CopyContext.Provider>
	);
}

/**
 * @param {string} screen One of DEFAULT_COPY's top-level keys (e.g. 'newTicket').
 * @return {object} Merged copy for that screen — every key always present,
 *                   falling back to DEFAULT_COPY[screen][key] when unset.
 */
export function useCopy( screen ) {
	const overrides = useContext( CopyContext );
	return { ...DEFAULT_COPY[ screen ], ...( overrides?.[ screen ] ?? {} ) };
}
```

Copy the complete `DEFAULT_COPY` object from the Copy Key Schema section at the top of this plan verbatim — all 9 screens (`newTicket`, `ticketSubmitted`, `capReachedFree`, `capReachedPro`, `signIn`, `checkInbox`, `expiredLink`, `myTickets`, `emptyState`, `thread`).

- [ ] **Step 2: Verify with a disposable Node script**

```bash
cd wp-content/plugins/sublime-crm
node -e "
const { DEFAULT_COPY } = require('./src/portal/copy-defaults.js');
" 2>&1 || echo "expected: ESM import error is fine, this just confirms the file parses — real verification happens via npm run build in Task 2"
```

Run `npm run build` once (build will fail here since nothing imports this file yet in a way webpack processes standalone — that's expected; real build verification happens once Task 2 wires it in). Confirm no syntax typos by eye: exactly 9 top-level keys, no trailing commas causing issues, all curly quotes (`’`/`—`/`→`/`…`/`•`/`←`) render correctly by opening the file in an editor.

- [ ] **Step 3: Commit**

```bash
git add src/portal/copy-defaults.js
git commit -m "Add portal copy-defaults.js with DEFAULT_COPY + CopyContext (Phase 16)"
```

---

### Task 2: Wire `CopyProvider` into `App.jsx`

**Files:**
- Modify: `src/portal/App.jsx`

**Interfaces:**
- Consumes: `CopyProvider` from `./copy-defaults.js` (Task 1)
- Produces: every child of `RouteView` now has access to `useCopy()` via context, sourced from `window.stcrmPortal.copy` (localized in Task 10)

- [ ] **Step 1: Import `CopyProvider`**

Modify `src/portal/App.jsx:20-30` (the import block) — add one line:

```js
import { CopyProvider } from './copy-defaults.js';
```

- [ ] **Step 2: Wrap the `RouteView` return in `App()`**

Modify `src/portal/App.jsx:144` (`return <RouteView view={ view } session={ session } />;`) to:

```js
	return (
		<CopyProvider overrides={ window.stcrmPortal?.copy ?? {} }>
			<RouteView view={ view } session={ session } />
		</CopyProvider>
	);
```

- [ ] **Step 3: Build and verify no regressions**

```bash
cd wp-content/plugins/sublime-crm
npm run build
```

Expected: clean build, `stcrm-portal.js` recompiled. Since no view component reads `useCopy()` yet, this step only proves the wiring compiles — full behavioral verification happens after Task 3 lands.

- [ ] **Step 4: Commit**

```bash
git add src/portal/App.jsx
git commit -m "Wrap portal RouteView in CopyProvider (Phase 16)"
```

---

### Task 3: `NewTicketView.jsx` — merged copy + extracted `SuccessState` + `previewMode`

**Files:**
- Modify: `src/portal/NewTicketView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js` (Task 1)
- Produces: `NewTicketView({ session, previewMode })` (default export, `previewMode` new, optional, default `false`); `SuccessState({ session })` (now a **named export**, unchanged signature — needed by `editor.jsx` in Task 11 to preview the "Ticket Submitted" screen independently)

- [ ] **Step 1: Export `SuccessState` and wire its copy**

Modify `src/portal/NewTicketView.jsx:8-44` (the whole `SuccessState` function) — change `function SuccessState` to `export function SuccessState`, and replace its two hardcoded strings:

```jsx
export function SuccessState( { session } ) {
	const copy = useCopy( 'ticketSubmitted' );
	return (
		<div className="pt-wrap" style={ { paddingTop: 32 } }>
			<div className="pt-card" style={ { padding: '48px 32px', textAlign: 'center', maxWidth: 520, margin: '0 auto' } }>
				<div style={ {
					width: 56, height: 56, borderRadius: '50%',
					background: '#edfaef', color: '#0a6116',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					margin: '0 auto 18px',
				} }>
					<Icon n="check" s={ 26 } />
				</div>
				<h1 className="pt-h1" style={ { fontSize: 22, marginBottom: 8 } }>{ copy.heading }</h1>
				<p className="muted" style={ { fontSize: 14, lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 380 } }>
					{ copy.body }
				</p>
				<button
					className="pt-btn pt-btn-primary"
					onClick={ () => {
						if ( session?.authenticated ) {
							window.location.href = buildUrl( VIEWS.MY_TICKETS );
						} else {
							navigate( VIEWS.AUTH );
						}
					} }
				>
					{ copy.ctaLabel } <Icon n="arrow" s={ 15 } />
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Add the `useCopy` import and `previewMode` to the default export's signature**

Modify `src/portal/NewTicketView.jsx:1-4` (imports) — add:

```jsx
import { useCopy } from './copy-defaults.js';
```

Modify `src/portal/NewTicketView.jsx:62` (`export default function NewTicketView( { session } ) {`) to:

```jsx
export default function NewTicketView( { session, previewMode = false } ) {
	const copy = useCopy( 'newTicket' );
```

- [ ] **Step 3: Skip the products `useEffect` in preview mode**

Modify `src/portal/NewTicketView.jsx:196-202` (the products-fetching `useEffect`):

```jsx
	useEffect( () => {
		if ( previewMode ) {
			setProducts( [ { product_id: 'demo-1', label: 'Sample Product', source: 'freemius' } ] );
			return;
		}
		let cancelled = false;
		apiFetch( { path: '/stcrm/v1/products' } )
			.then( ( list ) => { if ( ! cancelled ) setProducts( Array.isArray( list ) ? list : [] ); } )
			.catch( () => { if ( ! cancelled ) setProducts( [] ); } );
		return () => { cancelled = true; };
	}, [ previewMode ] );
```

- [ ] **Step 4: No-op `handleSubmit` in preview mode**

Modify `src/portal/NewTicketView.jsx:204-206` (start of `handleSubmit`):

```jsx
	async function handleSubmit( e ) {
		e.preventDefault();
		if ( previewMode ) return;
```

- [ ] **Step 5: Replace every hardcoded string with `copy.*`**

Modify `src/portal/NewTicketView.jsx:242-251` (the `null !== products && 0 === products.length` empty state):

```jsx
	if ( null !== products && 0 === products.length ) {
		return (
			<div style={ { padding: '32px 20px', textAlign: 'center' } }>
				<div style={ { fontWeight: 700, fontSize: 14.5, marginBottom: 8, color: '#1d2327' } }>{ copy.formUnavailableTitle }</div>
				<p style={ { fontSize: 13, color: '#646970', lineHeight: 1.6, margin: 0 } }>
					{ copy.formUnavailableBody }
				</p>
			</div>
		);
	}
```

Modify `src/portal/NewTicketView.jsx:186-200` (heading/subtitle block):

```jsx
			<h1 className="pt-h1">{ copy.heading }</h1>
			<p className="pt-sub">
				{ copy.subtitle }{ ' ' }
				{ wpRecognizedNoTickets ? (
					<span style={ { fontWeight: 700 } }>{ copy.wpRecognizedNote }</span>
				) : (
					<a
						onClick={ () => navigate( session?.authenticated ? VIEWS.MY_TICKETS : VIEWS.AUTH ) }
						style={ { fontWeight: 700 } }
					>
						{ copy.viewTicketsLink }
					</a>
				) }
			</p>
```

Modify `src/portal/NewTicketView.jsx:227-244` (email + name fields):

```jsx
						<div className="row g16 wrap">
							<div className="pt-field grow">
								<label className="pt-label">{ copy.emailLabel }</label>
								<input
									className="pt-input"
									type="email"
									required
									autoComplete="email"
									placeholder={ copy.emailPlaceholder }
									value={ fields.email }
									onChange={ set( 'email' ) }
									readOnly={ !! lockedEmail }
									style={ lockedEmail ? { background: 'var(--pt-bg2, #f6f7f7)', cursor: 'not-allowed' } : undefined }
								/>
								{ lockedEmail && (
									<p className="muted tiny" style={ { marginTop: 4 } }>{ copy.emailLockedNote }</p>
								) }
							</div>
							<div className="pt-field grow">
								<label className="pt-label">{ copy.nameLabel } <span className="opt">{ copy.nameOptionalTag }</span></label>
								<input
									className="pt-input"
									type="text"
									autoComplete="name"
									placeholder={ copy.namePlaceholder }
									value={ fields.name }
									onChange={ set( 'name' ) }
								/>
							</div>
						</div>
```

Modify `src/portal/NewTicketView.jsx:258-270` (subject field):

```jsx
						<div className="row g16 wrap">
							<div className="pt-field grow">
								<label className="pt-label">{ copy.subjectLabel }</label>
								<input
									className="pt-input"
									type="text"
									required
									placeholder={ copy.subjectPlaceholder }
									value={ fields.subject }
									onChange={ set( 'subject' ) }
								/>
							</div>
						</div>
```

Modify `src/portal/NewTicketView.jsx:272-303` (category + product selects):

```jsx
						<div className="row g16 wrap">
							{ categories.length > 0 && (
								<div className="pt-field grow">
									<label className="pt-label">{ copy.categoryLabel }</label>
									<select
										className="pt-select"
										value={ fields.category }
										onChange={ set( 'category' ) }
									>
										<option value="">{ copy.selectPlaceholder }</option>
										{ categories.map( ( c ) => (
											<option key={ c } value={ c }>{ c }</option>
										) ) }
									</select>
								</div>
							) }
							<div className="pt-field grow">
								<label className="pt-label">{ copy.productLabel }</label>
								<select
									className="pt-select"
									required
									disabled={ null === products }
									value={ fields.productId }
									onChange={ set( 'productId' ) }
								>
									<option value="">{ null === products ? copy.productLoadingPlaceholder : copy.selectPlaceholder }</option>
									{ ( products ?? [] ).map( ( p ) => (
										<option key={ p.product_id } value={ p.product_id }>{ p.label }</option>
									) ) }
								</select>
							</div>
						</div>
```

Modify `src/portal/NewTicketView.jsx:305-314` (message field):

```jsx
						<div className="pt-field">
							<label className="pt-label">{ copy.messageLabel }</label>
							<textarea
								className="pt-textarea"
								required
								placeholder={ copy.messagePlaceholder }
								value={ fields.message }
								onChange={ set( 'message' ) }
							/>
						</div>
```

Modify `src/portal/NewTicketView.jsx:316-330` (license key field):

```jsx
						{ ! isWporgProduct && (
							<div className="pt-field">
								<label className="pt-label">
									{ copy.licenseKeyLabel }{ ' ' }
									<span className="opt">{ copy.licenseKeyHint }</span>
								</label>
								<input
									className="pt-input"
									type="text"
									placeholder={ copy.licenseKeyPlaceholder }
									value={ fields.licenseKey }
									onChange={ set( 'licenseKey' ) }
								/>
							</div>
						) }
```

Modify `src/portal/NewTicketView.jsx:332-354` (environment details details/summary):

```jsx
						<details style={ { marginBottom: 18 } }>
							<summary style={ { fontSize: 13.5, color: 'var(--pt-blue)', fontWeight: 600, cursor: 'pointer' } }>
								{ copy.envToggleLabel }
							</summary>
							<div className="row g12 wrap" style={ { marginTop: 12 } }>
								<div className="pt-field grow" style={ { minWidth: 180, marginBottom: 0 } }>
									<label className="pt-label">{ copy.envSiteUrlLabel }</label>
									<input className="pt-input" type="url" placeholder={ copy.envSiteUrlPlaceholder } value={ fields.siteUrl } onChange={ set( 'siteUrl' ) } />
								</div>
								<div className="pt-field" style={ { width: 96, marginBottom: 0 } }>
									<label className="pt-label">{ copy.envWpLabel }</label>
									<input className="pt-input" placeholder={ copy.envWpPlaceholder } value={ fields.wpVersion } onChange={ set( 'wpVersion' ) } />
								</div>
								<div className="pt-field" style={ { width: 96, marginBottom: 0 } }>
									<label className="pt-label">{ copy.envPhpLabel }</label>
									<input className="pt-input" placeholder={ copy.envPhpPlaceholder } value={ fields.phpVersion } onChange={ set( 'phpVersion' ) } />
								</div>
								<div className="pt-field" style={ { width: 110, marginBottom: 0 } }>
									<label className="pt-label">{ copy.envPluginLabel }</label>
									<input className="pt-input" placeholder={ copy.envPluginPlaceholder } value={ fields.pluginVersion } onChange={ set( 'pluginVersion' ) } />
								</div>
							</div>
						</details>
```

Modify `src/portal/NewTicketView.jsx:356-367` (submit button):

```jsx
						<div className="row ac g16" style={ { marginTop: 4 } }>
							<button
								className="pt-btn pt-btn-primary"
								type="submit"
								disabled={ loading }
								style={ { padding: '12px 24px' } }
							>
								<Icon n="send" s={ 16 } />
								{ loading ? copy.submitSendingLabel : copy.submitLabel }
							</button>
							<span className="muted" style={ { fontSize: 13 } }>{ copy.submitNote }</span>
						</div>
```

Modify `src/portal/NewTicketView.jsx:373-404` (sidebar docs card + pro card):

```jsx
				{ /* ── Sidebar ── */ }
				<div style={ { width: 280, flex: 'none' } } className="col g16">
					{ /* Docs card */ }
					{ docsUrl && (
						<div className="pt-card" style={ { padding: 20 } }>
							<div className="row ac g8" style={ { marginBottom: 10 } }>
								<Icon n="doc" s={ 18 } style={ { color: 'var(--pt-blue)' } } />
								<b style={ { fontSize: 14.5 } }>{ copy.docsCardTitle }</b>
							</div>
							<p style={ { fontSize: 13.5, color: 'var(--pt-g1)', lineHeight: 1.55, margin: '0 0 12px' } }>
								{ copy.docsCardBody }
							</p>
							<a
								className="pt-btn"
								style={ { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' } }
								href={ docsUrl }
								target="_blank"
								rel="noopener noreferrer"
							>
								{ copy.docsCardLink } <Icon n="ext" s={ 15 } />
							</a>
						</div>
					) }

					{ /* Pro card */ }
					<div className="pt-card" style={ { padding: 20, background: '#f0f6fc', borderColor: '#c5d9ed' } }>
						<div className="row ac g8" style={ { marginBottom: 8 } }>
							<span className="badge b-pro">★ Pro</span>
							<b style={ { fontSize: 14 } }>{ copy.proCardTitle }</b>
						</div>
						<p style={ { fontSize: 13.5, color: 'var(--pt-g1)', lineHeight: 1.55, margin: 0 } }>
							{ copy.proCardBody }
						</p>
					</div>

					{ /* Privacy note */ }
					<div style={ { padding: '0 4px' } }>
						<div className="row g10" style={ { fontSize: 12.5, color: 'var(--pt-g2)', lineHeight: 1.5 } }>
							<Icon n="lock" s={ 15 } style={ { marginTop: 1 } } />
							<span>{ copy.privacyNote }</span>
						</div>
					</div>
				</div>
```

> Implementation note: the original `proCardBody` bolded the phrase "purchase email" via a nested `<b>` JSX element. That's dropped here in favor of one plain customizable string — keeping every field a safe plain-text value (no `dangerouslySetInnerHTML` for admin-entered text). Minor, in-scope simplification.

- [ ] **Step 6: Build**

```bash
cd wp-content/plugins/sublime-crm
npm run build
```

Expected: clean build, `stcrm-portal.js` recompiled, zero webpack warnings about unused imports (`useCopy` must actually be used — it is).

- [ ] **Step 7: Verify — defaults unchanged, then a real override**

Playwright script against `sublimetheme.test` (the New Ticket form is the homepage's default portal view for an anonymous visitor):

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://sublimetheme.test/new-support/', { waitUntil: 'load', timeout: 20000 });
  const heading = await page.locator('h1.pt-h1').first().innerText();
  console.log('Default heading (expect "How can we help?"):', heading);
  await browser.close();
})();
```

Expected: `How can we help?` — confirms zero visual regression with the (still-empty) `copy` attribute. A real-override check happens in Task 10 once the block attribute is wired end-to-end (this task alone has no way to set the attribute yet).

- [ ] **Step 8: Commit**

```bash
git add src/portal/NewTicketView.jsx
git commit -m "NewTicketView: merged copy, exported SuccessState, previewMode (Phase 16)"
```

---

### Task 4: `CapReachedView.jsx` — merged copy + `previewMode`

**Files:**
- Modify: `src/portal/CapReachedView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js`
- Produces: `CapReachedView({ session, ticketId, previewMode })` (default export); `FreeCap`/`ProCap` gain `previewMode`, not separately exported (editor preview in Task 11 renders `CapReachedView` with a fixed `ticketId` to hit the `FreeCap` branch)

- [ ] **Step 1: Import `useCopy`**

Modify `src/portal/CapReachedView.jsx:1-4`:

```jsx
import { useState, useEffect }  from '@wordpress/element';
import apiFetch                 from './api.js';
import { navigate, VIEWS }      from './router.js';
import Icon                     from './Icon.jsx';
import { useCopy }              from './copy-defaults.js';
```

- [ ] **Step 2: `FreeCap` — merged copy, previewMode, fixed sample ticket**

Modify `src/portal/CapReachedView.jsx:8-98` (whole `FreeCap` function):

```jsx
function FreeCap( { session, ticketId, previewMode = false } ) {
	const copy = useCopy( 'capReachedFree' );
	const [ ticket,  setTicket  ] = useState( previewMode ? { subject: 'Sample ticket subject' } : null );
	const [ loading, setLoading ] = useState( false );

	useEffect( () => {
		if ( previewMode || ! session.authenticated || ! ticketId ) return;
		setLoading( true );
		apiFetch( { path: `/stcrm/v1/tickets/${ ticketId }` } )
			.then( ( data ) => setTicket( data.ticket ?? null ) )
			.catch( () => {} )
			.finally( () => setLoading( false ) );
	}, [ ticketId, session.authenticated, previewMode ] );

	function goToTicket() {
		if ( previewMode ) return;
		if ( session.authenticated && ticketId ) {
			navigate( VIEWS.THREAD, { ticket: ticketId } );
		} else {
			navigate( VIEWS.AUTH );
		}
	}

	return (
		<div className="pt-wrap" style={ { paddingTop: 32 } }>
			<div className="pt-crumb">
				<a onClick={ () => ! previewMode && navigate( VIEWS.NEW_TICKET ) }>{ copy.crumb }</a>
			</div>

			<h1 className="pt-h1">{ copy.heading }</h1>
			<p className="pt-sub">{ copy.subtitle }</p>

			{ /* Amber warning card */ }
			<div
				className="pt-card"
				style={ {
					overflow:     'hidden',
					marginBottom: 22,
					border:       '1.5px solid var(--pt-amber-line)',
				} }
			>
				{ /* Banner */ }
				<div style={ {
					background:   'var(--pt-amber-bg)',
					padding:      '18px 22px',
					borderBottom: '1px solid var(--pt-amber-line)',
				} }>
					<div className="row g12">
						<Icon n="warn" s={ 22 } style={ { color: 'var(--pt-amber)', marginTop: 1 } } />
						<div>
							<div style={ { fontWeight: 700, fontSize: 15, marginBottom: 3 } }>
								{ copy.bannerTitle }
							</div>
							<p style={ { fontSize: 13.5, color: 'var(--pt-g1)', margin: 0, lineHeight: 1.55 } }>
								{ copy.bannerBody }
							</p>
						</div>
					</div>
				</div>

				{ /* Ticket row */ }
				<div style={ { padding: '16px 22px' } } className="row ac g16">
					<div className="grow" style={ { minWidth: 0 } }>
						{ loading ? (
							<span className="muted" style={ { fontSize: 13 } }>{ copy.loadingLabel }</span>
						) : (
							<>
								<div className="row ac g8" style={ { marginBottom: 4 } }>
									<span className="kick">#{ ticketId }</span>
								</div>
								{ ticket && (
									<div style={ { fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
										{ ticket.subject }
									</div>
								) }
							</>
						) }
					</div>
					<button className="pt-btn pt-btn-primary" onClick={ goToTicket } style={ { flexShrink: 0 } }>
						{ session.authenticated ? copy.ctaAuthenticated : copy.ctaUnauthenticated }
						<Icon n="arrow" s={ 15 } />
					</button>
				</div>
			</div>

			<p className="tiny muted" style={ { lineHeight: 1.5 } }>
				{ copy.footerNote }
			</p>
		</div>
	);
}
```

- [ ] **Step 3: `ProCap` — merged copy, previewMode**

Modify `src/portal/CapReachedView.jsx` (whole `ProCap` function, immediately after `FreeCap`):

```jsx
function ProCap( { session, previewMode = false } ) {
	const copy = useCopy( 'capReachedPro' );

	function goToTickets() {
		if ( previewMode ) return;
		navigate( session.authenticated ? VIEWS.MY_TICKETS : VIEWS.AUTH );
	}

	return (
		<div className="pt-wrap" style={ { paddingTop: 32 } }>
			<div className="pt-crumb">
				<a onClick={ () => ! previewMode && navigate( VIEWS.NEW_TICKET ) }>{ copy.crumb }</a>
			</div>

			<h1 className="pt-h1">{ copy.heading }</h1>
			<p className="pt-sub">{ copy.subtitle }</p>

			<div
				className="pt-card"
				style={ {
					overflow:     'hidden',
					marginBottom: 22,
					border:       '1.5px solid var(--pt-amber-line)',
				} }
			>
				<div style={ {
					background:   'var(--pt-amber-bg)',
					padding:      '18px 22px',
					borderBottom: '1px solid var(--pt-amber-line)',
				} }>
					<div className="row g12">
						<Icon n="warn" s={ 22 } style={ { color: 'var(--pt-amber)', marginTop: 1 } } />
						<div>
							<div style={ { fontWeight: 700, fontSize: 15, marginBottom: 3 } }>
								{ copy.bannerTitle }
							</div>
							<p style={ { fontSize: 13.5, color: 'var(--pt-g1)', margin: 0, lineHeight: 1.55 } }>
								{ copy.bannerBody }
							</p>
						</div>
					</div>
				</div>
				<div style={ { padding: '16px 22px' } }>
					<button className="pt-btn pt-btn-primary" onClick={ goToTickets }>
						{ session.authenticated ? copy.ctaAuthenticated : copy.ctaUnauthenticated }
						<Icon n="arrow" s={ 15 } />
					</button>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Thread `previewMode` through the default export**

Modify `src/portal/CapReachedView.jsx` (final `export default function CapReachedView` block):

```jsx
export default function CapReachedView( { session, ticketId, previewMode = false } ) {
	if ( ticketId ) {
		return <FreeCap session={ session } ticketId={ ticketId } previewMode={ previewMode } />;
	}
	return <ProCap session={ session } previewMode={ previewMode } />;
}
```

- [ ] **Step 5: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

Expected: clean build.

- [ ] **Step 6: Verify defaults unchanged**

Direct component-level check isn't reachable without a real 409 (cap-reached only renders on that response) — defer full behavioral verification to Task 16's integration pass, which drives a real cap-reached scenario. For now, confirm via `grep` that no stray hardcoded string remains:

```bash
grep -n "You already have an open ticket\|You've reached your open ticket limit\|Free accounts keep one open ticket" src/portal/CapReachedView.jsx
```

Expected: no matches (all moved into `copy-defaults.js`).

- [ ] **Step 7: Commit**

```bash
git add src/portal/CapReachedView.jsx
git commit -m "CapReachedView: merged copy, previewMode (Phase 16)"
```

---

### Task 5: `AuthView.jsx` — merged copy + extracted `SentState` + `previewMode`

**Files:**
- Modify: `src/portal/AuthView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js`
- Produces: `AuthView({ previewMode })` (default export); `SentState()` (new **named export**, no props — needed by `ExpiredView.jsx`'s `CheckInboxState` conceptually shares its copy namespace, and by `editor.jsx` in Task 11 to preview "Check Your Inbox" directly)

- [ ] **Step 1: Import `useCopy`, extract `SentState`**

Modify `src/portal/AuthView.jsx:1-4`:

```jsx
import { useState } from '@wordpress/element';
import apiFetch                         from './api.js';
import { navigate, getTicketId, buildUrl, VIEWS } from './router.js';
import Icon                             from './Icon.jsx';
import { useCopy }                      from './copy-defaults.js';
```

Modify `src/portal/AuthView.jsx:127-164` (the `if ( sent ) { return (...) }` block inside `AuthView`) — extract into a new named export placed right after `PasswordLoginForm` (before `export default function AuthView`):

```jsx
export function SentState() {
	const copy = useCopy( 'checkInbox' );
	return (
		<div className="pt-card" style={ { padding: '40px 32px', textAlign: 'center' } }>
			<div style={ {
				width:           64,
				height:          64,
				borderRadius:    '50%',
				background:      '#f0f6fc',
				display:         'flex',
				alignItems:      'center',
				justifyContent:  'center',
				margin:          '0 auto 20px',
				color:           'var(--pt-blue)',
			} }>
				<Icon n="mail" s={ 28 } />
			</div>
			<h1 className="pt-h1" style={ { fontSize: 22, marginBottom: 10 } }>{ copy.heading }</h1>
			<p className="muted" style={ { fontSize: 13.5, lineHeight: 1.6, maxWidth: 340, margin: '0 auto 24px' } }>
				{ copy.body }
			</p>
			<a
				href="#"
				onClick={ ( e ) => { e.preventDefault(); navigate( VIEWS.AUTH ); } }
				style={ { fontSize: 13.5 } }
			>
				{ copy.useAnotherEmailLink }
			</a>
			<p className="muted tiny" style={ { marginTop: 24 } }>
				{ copy.privacyNote }
			</p>
			<p style={ { marginTop: 14 } }>
				<a href="#" onClick={ ( e ) => { e.preventDefault(); navigate( VIEWS.NEW_TICKET ); } } style={ { fontSize: 13.5 } }>
					{ copy.submitTicketInsteadLink }
				</a>
			</p>
		</div>
	);
}
```

> Note: the original "sent" block's "← Use a different email" link called local `setSent(false)` (staying inside `AuthView`'s own state). As a standalone export, `SentState` instead navigates back to `VIEWS.AUTH` — functionally equivalent (lands back on the same unsent form) and lets `SentState` be a fully self-contained, prop-free component previewable in isolation.

- [ ] **Step 2: Default export — `useCopy`, `previewMode`, render `<SentState />` when sent**

Modify `src/portal/AuthView.jsx` (`export default function AuthView`):

```jsx
export default function AuthView( { previewMode = false } ) {
	const copy = useCopy( 'signIn' );
	const [ email,    setEmail    ] = useState( '' );
	const [ honeypot, setHoneypot ] = useState( '' );
	const [ sent,     setSent     ] = useState( false );
	const [ sending,  setSending  ] = useState( false );
	const [ error,    setError    ] = useState( null );

	async function handleSubmit( e ) {
		e.preventDefault();
		if ( previewMode ) return;
		const trimmed = email.trim();
		if ( ! trimmed || sending ) return;

		if ( honeypot ) {
			setSent( true );
			return;
		}

		setSending( true );
		setError( null );
		try {
			const data = { email: trimmed, stcrm_hp: honeypot };
			const ticketId = getTicketId();
			if ( ticketId ) { data.ticket_id = ticketId; }
			await apiFetch( { path: '/stcrm/v1/auth/magic-link', method: 'POST', data } );
			setSent( true );
		} catch {
			setError( 'Something went wrong. Please try again.' );
		} finally {
			setSending( false );
		}
	}

	if ( sent ) {
		return <SentState />;
	}

	return (
		<div className="pt-card" style={ { padding: '40px 32px' } }>
			<h1 className="pt-h1" style={ { fontSize: 22, marginBottom: 6 } }>{ copy.heading }</h1>
			<p className="pt-sub" style={ { marginBottom: 24 } }>{ copy.subtitle }</p>

			<PasswordLoginForm previewMode={ previewMode } />

			<div className="row ac g10" style={ { margin: '22px 0' } }>
				<div style={ { flex: 1, height: 1, background: 'var(--line)' } } />
				<span className="muted tiny">{ copy.orDivider }</span>
				<div style={ { flex: 1, height: 1, background: 'var(--line)' } } />
			</div>

			{ error && (
				<div className="pt-form-error" style={ { marginBottom: 14 } }>{ error }</div>
			) }
			<form onSubmit={ handleSubmit }>
				<label className="pt-label">{ copy.emailLabel }</label>
				<input
					type="email"
					className="pt-input"
					placeholder="you@example.com"
					value={ email }
					onChange={ ( e ) => setEmail( e.target.value ) }
					required
					style={ { marginBottom: 16, display: 'block', width: '100%' } }
				/>
				<div aria-hidden style={ { display: 'none' } }>
					<input
						tabIndex={ -1 }
						autoComplete="off"
						name="stcrm_hp"
						value={ honeypot }
						onChange={ ( e ) => setHoneypot( e.target.value ) }
					/>
				</div>
				<button
					type="submit"
					className="pt-btn pt-btn-primary pt-btn-lg"
					style={ {
						width:          '100%',
						justifyContent: 'center',
						opacity:        ( ! email.trim() || sending ) ? 0.6 : 1,
					} }
					disabled={ ! email.trim() || sending }
				>
					{ sending ? copy.emailSubmitSendingLabel : copy.emailSubmitLabel }
				</button>
			</form>
			<p className="muted tiny" style={ { marginTop: 20, textAlign: 'center' } }>
				{ copy.privacyNote }
			</p>
			<p style={ { marginTop: 14, textAlign: 'center' } }>
				<a href="#" onClick={ ( e ) => { e.preventDefault(); navigate( VIEWS.NEW_TICKET ); } } style={ { fontSize: 13.5 } }>
					{ copy.submitTicketInsteadLink }
				</a>
			</p>
		</div>
	);
}
```

- [ ] **Step 3: `PasswordLoginForm` — merged copy, previewMode**

Modify `src/portal/AuthView.jsx:8-90` (whole `PasswordLoginForm` function):

```jsx
function PasswordLoginForm( { previewMode = false } ) {
	const copy = useCopy( 'signIn' );
	const [ identifier, setIdentifier ] = useState( '' );
	const [ password,   setPassword   ] = useState( '' );
	const [ loggingIn,  setLoggingIn  ] = useState( false );
	const [ loginError, setLoginError ] = useState( null );

	async function handleLogin( e ) {
		e.preventDefault();
		if ( previewMode ) return;
		if ( ! identifier.trim() || ! password || loggingIn ) return;

		setLoggingIn( true );
		setLoginError( null );
		try {
			const data = { identifier: identifier.trim(), password };
			const ticketId = getTicketId();
			if ( ticketId ) { data.ticket_id = ticketId; }

			const result = await apiFetch( { path: '/stcrm/v1/auth/wp-login', method: 'POST', data } );

			if ( result.authenticated ) {
				window.location.href = buildUrl( result.ticket_id ? VIEWS.THREAD : VIEWS.MY_TICKETS, result.ticket_id ? { ticket: result.ticket_id } : {} );
			} else {
				setLoginError( 'Signed in, but couldn’t start your session. Please try again.' );
			}
		} catch ( err ) {
			setLoginError(
				429 === err?.data?.status
					? 'Too many attempts. Please wait a few minutes and try again.'
					: 'Incorrect email/username or password.'
			);
		} finally {
			setLoggingIn( false );
		}
	}

	return (
		<form onSubmit={ handleLogin }>
			{ loginError && (
				<div className="pt-form-error" style={ { marginBottom: 14 } }>{ loginError }</div>
			) }
			<label className="pt-label">{ copy.passwordUsernameLabel }</label>
			<input
				type="text"
				className="pt-input"
				autoComplete="username"
				placeholder="you@example.com"
				value={ identifier }
				onChange={ ( e ) => setIdentifier( e.target.value ) }
				style={ { marginBottom: 12, display: 'block', width: '100%' } }
			/>
			<label className="pt-label">{ copy.passwordLabel }</label>
			<input
				type="password"
				className="pt-input"
				autoComplete="current-password"
				value={ password }
				onChange={ ( e ) => setPassword( e.target.value ) }
				style={ { marginBottom: 16, display: 'block', width: '100%' } }
			/>
			<button
				type="submit"
				className="pt-btn pt-btn-lg"
				style={ {
					width:          '100%',
					justifyContent: 'center',
					opacity:        ( ! identifier.trim() || ! password || loggingIn ) ? 0.6 : 1,
				} }
				disabled={ ! identifier.trim() || ! password || loggingIn }
			>
				{ loggingIn ? copy.passwordSubmitSendingLabel : copy.passwordSubmitLabel }
			</button>
		</form>
	);
}
```

> Note: `loginError`'s two fallback strings ("Signed in, but couldn't start your session...", "Too many attempts...", "Incorrect email/username or password.") are client-side error/fallback text — explicitly out of scope per Global Constraints, left hardcoded.

- [ ] **Step 4: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

- [ ] **Step 5: Verify defaults unchanged**

```bash
grep -n "Sign in to view your tickets\|Check your inbox\|Email me a sign-in link" src/portal/AuthView.jsx
```

Expected: no matches (moved to `copy-defaults.js`). Full live-page verification deferred to Task 16 (requires navigating to `?view=auth`).

- [ ] **Step 6: Commit**

```bash
git add src/portal/AuthView.jsx
git commit -m "AuthView: merged copy, exported SentState, previewMode (Phase 16)"
```

---

### Task 6: `ExpiredView.jsx` — merged copy (shares `checkInbox` namespace) + `previewMode`

**Files:**
- Modify: `src/portal/ExpiredView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js`
- Produces: `ExpiredView({ previewMode })` (default export)

- [ ] **Step 1: Import, `CheckInboxState` reads `checkInbox` copy**

Modify `src/portal/ExpiredView.jsx:1-4`:

```jsx
import { useState } from '@wordpress/element';
import apiFetch           from './api.js';
import { navigate, VIEWS } from './router.js';
import Icon                from './Icon.jsx';
import { useCopy }         from './copy-defaults.js';
```

Modify `src/portal/ExpiredView.jsx:6-31` (`CheckInboxState`):

```jsx
function CheckInboxState() {
	const copy = useCopy( 'checkInbox' );
	return (
		<div className="pt-card" style={ { padding: '40px 32px', textAlign: 'center' } }>
			<div style={ {
				width:           64,
				height:          64,
				borderRadius:    '50%',
				background:      '#f0f6fc',
				display:         'flex',
				alignItems:      'center',
				justifyContent:  'center',
				margin:          '0 auto 20px',
				color:           'var(--pt-blue)',
			} }>
				<Icon n="mail" s={ 28 } />
			</div>
			<h1 className="pt-h1" style={ { fontSize: 22, marginBottom: 10 } }>{ copy.heading }</h1>
			<p className="muted" style={ { fontSize: 13.5, lineHeight: 1.6, maxWidth: 340, margin: '0 auto 24px' } }>
				{ copy.body }
			</p>
			<p className="muted tiny" style={ { marginTop: 24 } }>
				{ copy.privacyNote }
			</p>
		</div>
	);
}
```

- [ ] **Step 2: `ExpiredView` — merged `expiredLink` copy, `previewMode`**

Modify `src/portal/ExpiredView.jsx:33-142` (whole `export default function ExpiredView`):

```jsx
export default function ExpiredView( { previewMode = false } ) {
	const copy = useCopy( 'expiredLink' );
	const [ email,    setEmail    ] = useState( '' );
	const [ honeypot, setHoneypot ] = useState( '' );
	const [ sent,     setSent     ] = useState( false );
	const [ sending,  setSending  ] = useState( false );
	const [ error,    setError    ] = useState( null );

	async function handleSubmit( e ) {
		e.preventDefault();
		if ( previewMode ) return;
		const trimmed = email.trim();
		if ( ! trimmed || sending ) return;

		if ( honeypot ) {
			setSent( true );
			return;
		}

		setSending( true );
		setError( null );
		try {
			await apiFetch( {
				path:   '/stcrm/v1/auth/magic-link',
				method: 'POST',
				data:   { email: trimmed, stcrm_hp: honeypot },
			} );
			setSent( true );
		} catch {
			setError( 'Something went wrong. Please try again.' );
		} finally {
			setSending( false );
		}
	}

	if ( sent ) {
		return <CheckInboxState />;
	}

	return (
		<div className="pt-card" style={ { padding: '40px 32px', textAlign: 'center' } }>
			<div style={ {
				width:           64,
				height:          64,
				borderRadius:    '50%',
				background:      '#fff3cd',
				display:         'flex',
				alignItems:      'center',
				justifyContent:  'center',
				margin:          '0 auto 20px',
				color:           '#856404',
			} }>
				<Icon n="hourglass" s={ 28 } />
			</div>
			<h1 className="pt-h1" style={ { fontSize: 22, marginBottom: 10 } }>{ copy.heading }</h1>
			<p className="muted" style={ { fontSize: 13.5, lineHeight: 1.6, maxWidth: 340, margin: '0 auto 28px' } }>
				{ copy.body }
			</p>
			{ error && (
				<div className="pt-form-error" style={ { marginBottom: 14 } }>{ error }</div>
			) }
			<form onSubmit={ handleSubmit } style={ { textAlign: 'left', maxWidth: 320, margin: '0 auto' } }>
				<label className="pt-label">{ copy.emailLabel }</label>
				<input
					type="email"
					className="pt-input"
					placeholder="you@example.com"
					value={ email }
					onChange={ ( e ) => setEmail( e.target.value ) }
					required
					style={ { marginBottom: 14, display: 'block', width: '100%' } }
				/>
				<div aria-hidden style={ { display: 'none' } }>
					<input
						tabIndex={ -1 }
						autoComplete="off"
						name="stcrm_hp"
						value={ honeypot }
						onChange={ ( e ) => setHoneypot( e.target.value ) }
					/>
				</div>
				<button
					type="submit"
					className="pt-btn pt-btn-primary pt-btn-lg"
					style={ {
						width:          '100%',
						justifyContent: 'center',
						opacity:        ( ! email.trim() || sending ) ? 0.6 : 1,
					} }
					disabled={ ! email.trim() || sending }
				>
					{ sending ? copy.submitSendingLabel : copy.submitLabel }
				</button>
			</form>
			<p style={ { textAlign: 'center', marginTop: 18 } }>
				<a href="#" onClick={ ( e ) => { e.preventDefault(); navigate( VIEWS.AUTH ); } } style={ { fontSize: 13.5 } }>
					{ copy.passwordInsteadLink }
				</a>
			</p>
			<p style={ { textAlign: 'center', marginTop: 10 } }>
				<a href="#" onClick={ ( e ) => { e.preventDefault(); navigate( VIEWS.NEW_TICKET ); } } style={ { fontSize: 13.5 } }>
					{ copy.submitTicketInsteadLink }
				</a>
			</p>
		</div>
	);
}
```

- [ ] **Step 3: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

- [ ] **Step 4: Verify defaults unchanged**

```bash
grep -n "This link has expired\|Sign-in links are single-use" src/portal/ExpiredView.jsx
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add src/portal/ExpiredView.jsx
git commit -m "ExpiredView: merged copy (shares checkInbox namespace), previewMode (Phase 16)"
```

---

### Task 7: `MyTicketsView.jsx` — merged copy + `previewMode`

**Files:**
- Modify: `src/portal/MyTicketsView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js`
- Produces: `MyTicketsView({ session, previewMode })` (default export)

- [ ] **Step 1: Import, add `previewMode`, merged copy, template-substitute the unread pill**

Modify `src/portal/MyTicketsView.jsx:1-6`:

```jsx
import { useState } from '@wordpress/element';
import apiFetch       from './api.js';
import { navigate, buildUrl, VIEWS } from './router.js';
import { StatusBadge } from './Badges.jsx';
import Icon from './Icon.jsx';
import SetPasswordPrompt from './SetPasswordPrompt.jsx';
import { useCopy } from './copy-defaults.js';
```

Modify `src/portal/MyTicketsView.jsx:18-102` (whole `export default function MyTicketsView`):

```jsx
export default function MyTicketsView( { session, previewMode = false } ) {
	const copy = useCopy( 'myTickets' );
	const [ signingOut, setSigningOut ] = useState( false );
	const { tickets = [], contact = {} } = session;

	async function handleSignOut() {
		if ( previewMode ) return;
		setSigningOut( true );
		try {
			await apiFetch( { path: '/stcrm/v1/auth/signout', method: 'POST' } );
		} catch ( _ ) {
			// Cookie may already be gone; treat as success.
		}
		window.location.href = buildUrl( VIEWS.NEW_TICKET );
	}

	return (
		<div>
			<div className="row ac jb" style={ { marginBottom: 22 } }>
				<div>
					<h1 className="pt-h1" style={ { marginBottom: 4 } }>{ copy.heading }</h1>
					<p className="muted" style={ { margin: 0, fontSize: 13.5 } }>
						{ contact.email ? `${ copy.signedInAsPrefix } ${ contact.email } · ` : '' }
						<a
							href="#"
							onClick={ ( e ) => { e.preventDefault(); if ( ! signingOut ) handleSignOut(); } }
							style={ { color: 'inherit', textDecoration: 'underline', cursor: signingOut ? 'wait' : 'pointer' } }
						>
							{ signingOut ? copy.signingOutLabel : copy.signOutLink }
						</a>
					</p>
				</div>
				<button
					className="pt-btn pt-btn-primary"
					onClick={ () => ! previewMode && navigate( VIEWS.NEW_TICKET ) }
				>
					{ copy.newTicketButton }
				</button>
			</div>

			<SetPasswordPrompt hasWpAccount={ !! contact.has_wp_account } signedInViaWpLogin={ !! contact.signed_in_via_wp_login } />

			<div className="pt-card" style={ { overflow: 'hidden' } }>
				{ tickets.map( ( ticket, i ) => (
					<div
						key={ ticket.id }
						className="row ac g16"
						onClick={ () => ! previewMode && navigate( VIEWS.THREAD, { ticket: ticket.id } ) }
						style={ {
							padding:      '18px 22px',
							borderBottom: i < tickets.length - 1 ? '1px solid var(--line)' : '0',
							cursor:       'pointer',
						} }
					>
						<div className="grow" style={ { minWidth: 0 } }>
							<div className="row ac g10" style={ { marginBottom: 5 } }>
								<span className="kick">#{ ticket.id }</span>
								{ ticket.unread_count > 0 && (
									<span className="badge b-blue b-pill">
										{ copy.unreadPillTemplate
											.replace( '{count}', ticket.unread_count )
											.replace( '{word}', 1 === ticket.unread_count ? 'reply' : 'replies' ) }
									</span>
								) }
							</div>
							<div style={ { fontSize: 15.5, fontWeight: 700, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
								{ ticket.subject }
							</div>
							<div className="row ac g8 wrap">
								<StatusBadge status={ ticket.status } />
								{ ticket.category && <span className="badge b-grey">{ ticket.category }</span> }
								{ ticket.product_label && <span className="badge b-grey">{ ticket.product_label }</span> }
								<span className="muted tiny">{ copy.updatedPrefix } { timeAgo( ticket.last_activity_at ) }</span>
							</div>
						</div>
						<Icon n="chev" s={ 20 } style={ { color: 'var(--g3)', flexShrink: 0 } } />
					</div>
				) ) }
			</div>
		</div>
	);
}
```

`timeAgo()` (the existing top-of-file helper) is untouched — it's dynamic relative-time formatting, not copy.

- [ ] **Step 2: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

- [ ] **Step 3: Verify defaults unchanged, live**

Playwright, using a real authenticated session (mint via `wp_generate_auth_cookie()`-style session token, matching this project's established pattern) with at least one real ticket:

```js
// after navigating to the My Tickets view with a real session cookie set
const heading = await page.locator('h1.pt-h1').first().innerText();
console.log('Default heading (expect "My tickets"):', heading);
```

Expected: `My tickets`.

- [ ] **Step 4: Commit**

```bash
git add src/portal/MyTicketsView.jsx
git commit -m "MyTicketsView: merged copy, previewMode (Phase 16)"
```

---

### Task 8: `EmptyView.jsx` — merged copy + `previewMode`

**Files:**
- Modify: `src/portal/EmptyView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js`
- Produces: `EmptyView({ session, previewMode })` (default export)

- [ ] **Step 1: Full rewrite**

Modify `src/portal/EmptyView.jsx` (entire file):

```jsx
import { useState } from '@wordpress/element';
import apiFetch from './api.js';
import { navigate, buildUrl, VIEWS } from './router.js';
import Icon from './Icon.jsx';
import SetPasswordPrompt from './SetPasswordPrompt.jsx';
import { useCopy } from './copy-defaults.js';

export default function EmptyView( { session, previewMode = false } ) {
	const copy = useCopy( 'emptyState' );
	const [ signingOut, setSigningOut ] = useState( false );
	const contact = session?.contact ?? {};

	async function handleSignOut() {
		if ( previewMode ) return;
		setSigningOut( true );
		try {
			await apiFetch( { path: '/stcrm/v1/auth/signout', method: 'POST' } );
		} catch ( _ ) {
			// Cookie may already be gone; treat as success.
		}
		window.location.href = buildUrl( VIEWS.NEW_TICKET );
	}

	return (
		<div>
			<div className="row ac jb" style={ { marginBottom: 22 } }>
				<h1 className="pt-h1" style={ { marginBottom: 0 } }>{ copy.heading }</h1>
				{ contact.email && (
					<p className="muted" style={ { margin: 0, fontSize: 13.5 } }>
						{ `Signed in as ${ contact.email } · ` }
						<a
							href="#"
							onClick={ ( e ) => { e.preventDefault(); if ( ! signingOut ) handleSignOut(); } }
							style={ { color: 'inherit', textDecoration: 'underline', cursor: signingOut ? 'wait' : 'pointer' } }
						>
							{ signingOut ? 'Signing out…' : 'Sign out' }
						</a>
					</p>
				) }
			</div>

			<SetPasswordPrompt hasWpAccount={ !! session?.contact?.has_wp_account } signedInViaWpLogin={ !! session?.contact?.signed_in_via_wp_login } />

			<div className="pt-card" style={ { padding: '60px 28px', textAlign: 'center' } }>
				<div style={ {
					width:           72,
					height:          72,
					borderRadius:    '50%',
					background:      '#f0f6fc',
					display:         'flex',
					alignItems:      'center',
					justifyContent:  'center',
					margin:          '0 auto 18px',
					color:           'var(--wp-blue)',
				} }>
					<Icon n="inbox" s={ 34 } />
				</div>
				<div style={ { fontWeight: 700, fontSize: 18, marginBottom: 8 } }>{ copy.iconAltHeading }</div>
				<p className="muted" style={ { fontSize: 14, maxWidth: 380, margin: '0 auto 22px', lineHeight: 1.6 } }>
					{ copy.body }
				</p>
				<button
					className="pt-btn pt-btn-primary"
					onClick={ () => ! previewMode && navigate( VIEWS.NEW_TICKET ) }
				>
					{ copy.ctaLabel }
				</button>
			</div>
		</div>
	);
}
```

> Note: the "Signed in as ... Sign out" row's own two strings ("Signed in as", "Sign out"/"Signing out…") are left as-is here, matching `MyTicketsView`'s pre-Phase-16 duplication — `EmptyView` doesn't have its own `myTickets`-style copy group in the schema; this is a pre-existing minor duplication between the two files (both showed near-identical sign-out rows before this phase too), out of scope to unify further here.

- [ ] **Step 2: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

- [ ] **Step 3: Verify defaults unchanged**

```bash
grep -n "No tickets yet\|Open your first ticket" src/portal/EmptyView.jsx
```

Expected: no matches (moved to `copy-defaults.js`).

- [ ] **Step 4: Commit**

```bash
git add src/portal/EmptyView.jsx
git commit -m "EmptyView: merged copy, previewMode (Phase 16)"
```

---

### Task 9: `ThreadView.jsx` — merged copy + `previewMode`

**Files:**
- Modify: `src/portal/ThreadView.jsx`

**Interfaces:**
- Consumes: `useCopy` from `./copy-defaults.js`
- Produces: `ThreadView({ ticketId, session, previewMode })` (default export); `LockedComposer`/`ActiveComposer` gain merged copy internally (not separately exported)

- [ ] **Step 1: Import, sample data, previewMode gating on `loadThread`**

Modify `src/portal/ThreadView.jsx:1-6`:

```jsx
import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import apiFetch            from './api.js';
import { navigate, VIEWS } from './router.js';
import { StatusBadge } from './Badges.jsx';
import Icon                from './Icon.jsx';
import { createPoller }    from './polling.js';
import { useCopy }         from './copy-defaults.js';
```

Modify `src/portal/ThreadView.jsx:35-65` (state + `loadThread` + mount effect):

```jsx
const PREVIEW_SAMPLE_DATA = {
	ticket: {
		id: 101,
		subject: 'Sample ticket subject',
		status: 'awaiting_customer',
		category: 'Technical Support',
		product_label: 'Sample Product',
		license_key: null,
		env: null,
	},
	messages: [
		{ id: 1, sender_type: 'customer', body: 'Hi, I ran into an issue with the plugin.', created_at: '2026-07-14 09:00:00' },
		{ id: 2, sender_type: 'agent', body: 'Thanks for reaching out — could you share more detail?', created_at: '2026-07-14 09:15:00' },
	],
	composer: { locked: false, reason: null, remaining: 2, turn_limit: 3 },
};

export default function ThreadView( { ticketId, session, previewMode = false } ) {
	const copy = useCopy( 'thread' );
	const [ data,      setData      ] = useState( previewMode ? PREVIEW_SAMPLE_DATA : null );
	const [ error,     setError     ] = useState( null );
	const [ body,      setBody      ] = useState( '' );
	const [ sending,   setSending   ] = useState( false );
	const [ sendError, setSendError ] = useState( null );
	const [ resolving, setResolving ] = useState( false );
	const [ reopening, setReopening ] = useState( false );
	const scrollRef    = useRef( null );
	const prevCountRef = useRef( 0 );

	const loadThread = useCallback( async () => {
		if ( previewMode ) return;
		try {
			const result = await apiFetch( { path: `/stcrm/v1/tickets/${ ticketId }` } );
			setData( result );
			setError( null );
		} catch ( err ) {
			const status = err?.data?.status ?? err?.status;
			if ( 401 === status || 403 === status ) { navigate( VIEWS.AUTH ); return; }
			if ( 404 === status ) { navigate( VIEWS.MY_TICKETS ); return; }
			setError( 'Unable to load ticket. Please refresh.' );
		}
	}, [ ticketId, previewMode ] );

	// Load on mount, poll every 15s, stop on unmount — skipped entirely in preview mode.
	useEffect( () => {
		if ( previewMode ) return;
		loadThread();
		const poller = createPoller( loadThread, 15000 );
		poller.start();
		return () => poller.stop();
	}, [ loadThread, previewMode ] );
```

- [ ] **Step 2: No-op the three mutating handlers in preview mode**

Modify `src/portal/ThreadView.jsx` (`handleSend`, `handleResolve`, `handleReopen` — add a guard as the first line of each body):

```jsx
	async function handleSend( e ) {
		e.preventDefault();
		if ( previewMode ) return;
		const trimmed = body.trim();
		// ... rest unchanged
```

```jsx
	async function handleResolve() {
		if ( previewMode ) return;
		if ( resolving || ! window.confirm( 'Mark this ticket as resolved?' ) ) return;
		// ... rest unchanged
```

```jsx
	async function handleReopen() {
		if ( previewMode ) return;
		if ( reopening ) return;
		// ... rest unchanged
```

- [ ] **Step 3: Replace hardcoded strings in the main render**

Modify `src/portal/ThreadView.jsx:149-209` (header block through the details/summary):

```jsx
	return (
		<div>
			<div style={ { marginBottom: 14 } }>
				<a
					href="#"
					onClick={ ( e ) => { e.preventDefault(); ! previewMode && navigate( VIEWS.MY_TICKETS ); } }
					style={ { fontSize: 13.5, color: 'var(--pt-blue)', textDecoration: 'none' } }
				>
					{ copy.backLink }
				</a>
			</div>

			<div className="row ac jb" style={ { marginBottom: 6 } }>
				<h1 className="pt-h1" style={ { fontSize: 24, marginBottom: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
					{ ticket.subject }
				</h1>
				<span className="kick" style={ { flexShrink: 0, marginLeft: 12 } }>#{ ticket.id }</span>
			</div>
			<div className="row ac jb g8" style={ { marginBottom: 18 } }>
				<div className="row ac g8 wrap">
					<StatusBadge status={ ticket.status } />
					{ ticket.category && <span className="badge b-grey">{ ticket.category }</span> }
					{ ticket.product_label && <span className="badge b-grey">{ ticket.product_label }</span> }
				</div>
				{ [ 'awaiting_agent', 'awaiting_customer' ].includes( ticket.status ) && (
					<button
						type="button"
						className="pt-btn"
						style={ { fontSize: 13, padding: '6px 12px' } }
						onClick={ handleResolve }
						disabled={ resolving }
					>
						{ resolving ? copy.resolvingLabel : copy.resolveButton }
					</button>
				) }
			</div>

			{ ( ticket.license_key || ticket.env ) && (
				<details style={ { marginBottom: 18 } }>
					<summary style={ { fontSize: 13.5, color: 'var(--pt-blue)', fontWeight: 600, cursor: 'pointer' } }>
						{ copy.detailsToggleLabel }
					</summary>
					<div className="row g12 wrap" style={ { marginTop: 10, fontSize: 13 } }>
						{ ticket.license_key && (
							<div><span className="muted">License key:</span> { ticket.license_key }</div>
						) }
						{ ticket.env?.site_url && (
							<div><span className="muted">Site URL:</span> { ticket.env.site_url }</div>
						) }
						{ ticket.env?.wp_version && (
							<div><span className="muted">WP:</span> { ticket.env.wp_version }</div>
						) }
						{ ticket.env?.php_version && (
							<div><span className="muted">PHP:</span> { ticket.env.php_version }</div>
						) }
						{ ticket.env?.plugin_version && (
							<div><span className="muted">Plugin:</span> { ticket.env.plugin_version }</div>
						) }
					</div>
				</details>
			) }
```

Modify `src/portal/ThreadView.jsx:237-239` (the "updates automatically" note):

```jsx
					<div className="sysmsg" style={ { margin: '10px 0 0' } }>
						<span>{ copy.updatesNote }</span>
					</div>
```

- [ ] **Step 4: `LockedComposer` — merged copy**

Modify `src/portal/ThreadView.jsx:259-315` (whole `LockedComposer` function):

```jsx
function LockedComposer( { reason, onReopen, reopening } ) {
	const copy = useCopy( 'thread' );
	return (
		<div style={ { padding: 22, borderTop: '1px solid var(--pt-line)', background: '#fafbfc' } }>
			<div style={ {
				border:       '1.5px dashed var(--pt-line)',
				borderRadius: 12,
				padding:      '22px 20px',
				textAlign:    'center',
				background:   '#fff',
			} }>
				<div style={ {
					width:           46,
					height:          46,
					borderRadius:    '50%',
					background:      '#f0f6fc',
					display:         'flex',
					alignItems:      'center',
					justifyContent:  'center',
					margin:          '0 auto 12px',
					color:           'var(--pt-blue)',
				} }>
					<Icon n="lock" s={ 22 } />
				</div>
				{ 'closed' === reason ? (
					<>
						<div style={ { fontWeight: 700, fontSize: 15.5, marginBottom: 6 } }>{ copy.lockedClosedTitle }</div>
						<p className="muted" style={ { fontSize: 13.5, maxWidth: 400, margin: '0 auto', lineHeight: 1.55 } }>
							{ copy.lockedClosedBody }
						</p>
					</>
				) : 'resolved' === reason ? (
					<>
						<div style={ { fontWeight: 700, fontSize: 15.5, marginBottom: 6 } }>{ copy.lockedResolvedTitle }</div>
						<p className="muted" style={ { fontSize: 13.5, maxWidth: 400, margin: '0 auto 14px', lineHeight: 1.55 } }>
							{ copy.lockedResolvedBody }
						</p>
						<button
							type="button"
							className="pt-btn"
							onClick={ onReopen }
							disabled={ reopening }
						>
							{ reopening ? copy.reopeningLabel : copy.reopenButton }
						</button>
					</>
				) : (
					<>
						<div style={ { fontWeight: 700, fontSize: 15.5, marginBottom: 6 } }>{ copy.lockedTurnLimitTitle }</div>
						<p className="muted" style={ { fontSize: 13.5, maxWidth: 400, margin: '0 auto', lineHeight: 1.55 } }>
							{ copy.lockedTurnLimitBody }
						</p>
					</>
				) }
			</div>
		</div>
	);
}
```

- [ ] **Step 5: `ActiveComposer` — merged copy, template-substitute the counter**

Modify `src/portal/ThreadView.jsx:317-349` (whole `ActiveComposer` function):

```jsx
function ActiveComposer( { body, setBody, onSend, sending, sendError, remaining, turnLimit } ) {
	const copy = useCopy( 'thread' );
	const showCounter = remaining !== null && remaining !== undefined && turnLimit && remaining < turnLimit;
	return (
		<div style={ { padding: 18, borderTop: '1px solid var(--pt-line)', background: '#fff' } }>
			{ sendError && (
				<div className="pt-form-error" style={ { marginBottom: 10 } }>{ sendError }</div>
			) }
			<textarea
				className="pt-textarea"
				style={ { minHeight: 80, marginBottom: 10 } }
				placeholder={ copy.replyPlaceholder }
				value={ body }
				onChange={ ( e ) => setBody( e.target.value ) }
				onKeyDown={ ( e ) => { if ( 'Enter' === e.key && e.ctrlKey ) { onSend( e ); } } }
			/>
			<div className="row ac jb">
				<span className="muted tiny">
					{ showCounter
						? copy.repliesLeftTemplate
							.replace( '{remaining}', remaining )
							.replace( '{turnLimit}', turnLimit )
							.replace( '{word}', 1 === remaining ? 'reply' : 'replies' )
						: '' }
				</span>
				<button
					className="pt-btn pt-btn-primary"
					onClick={ onSend }
					disabled={ ! body.trim() || sending }
					style={ { opacity: ( ! body.trim() || sending ) ? 0.6 : 1 } }
				>
					<Icon n="send" s={ 15 } /> { sending ? copy.sendingLabel : copy.sendButton }
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 6: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

- [ ] **Step 7: Verify defaults unchanged**

```bash
grep -n "My tickets\"\|Mark as resolved\|Write a reply\|Send reply" src/portal/ThreadView.jsx
```

Expected: no matches for the removed literals (`← My tickets` link text, `Mark as resolved`, `Write a reply…`, `Send reply` — all now `copy.*`).

- [ ] **Step 8: Commit**

```bash
git add src/portal/ThreadView.jsx
git commit -m "ThreadView: merged copy, previewMode (Phase 16)"
```

---

### Task 10: Block attribute + `render.php` localization

**Files:**
- Modify: `blocks/support-portal/block.json`
- Modify: `blocks/support-portal/render.php`

**Interfaces:**
- Produces: block attribute `copy` (object, default `{}`), available in `render.php`'s `$attributes` and passed to the frontend as `window.stcrmPortal.copy`

- [ ] **Step 1: Add the attribute**

Modify `blocks/support-portal/block.json:1-15` (whole file):

```json
{
	"$schema": "https://schemas.wp.org/trunk/block.json",
	"apiVersion": 3,
	"name": "sublime-crm/support-portal",
	"version": "1.0.0",
	"title": "Support Portal",
	"category": "widgets",
	"icon": "format-chat",
	"description": "Customer support portal with ticket management and magic-link authentication.",
	"textdomain": "sublime-crm",
	"attributes": {
		"copy": {
			"type": "object",
			"default": {}
		}
	},
	"editorScript": "file:../../admin/js/stcrm-portal-editor.js",
	"viewScript": "stcrm-portal",
	"style": "file:../../admin/css/stcrm-portal.css",
	"render": "file:./render.php"
}
```

- [ ] **Step 2: Localize it**

Modify `blocks/support-portal/render.php:23-39` (the `wp_localize_script` call):

```php
wp_localize_script(
	'stcrm-portal',
	'stcrmPortal',
	array(
		'apiBase'     => rest_url( 'stcrm/v1/' ),
		'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
		'nonce'       => $nonce,
		'categories'  => $categories,
		'docsUrl'     => esc_url_raw( $settings['docs_url'] ?? '' ),
		'wpUserEmail' => is_user_logged_in() ? wp_get_current_user()->user_email : '',
		'wpUserName'  => is_user_logged_in() ? wp_get_current_user()->display_name : '',
		// Sparse copy overrides from the block attribute — merged with
		// DEFAULT_COPY client-side in copy-defaults.js. Never trust the
		// shape blindly: only pass it through if it's actually an array
		// (WP decodes a JSON object attribute to a PHP array).
		'copy'        => is_array( $attributes['copy'] ?? null ) ? $attributes['copy'] : array(),
	)
);
```

- [ ] **Step 3: `php -l`**

```bash
cd wp-content/plugins/sublime-crm
php -l blocks/support-portal/render.php
```

Expected: `No syntax errors detected`.

- [ ] **Step 4: Verify end-to-end — set a real override on the real page, confirm it renders**

```bash
php -r '
require "wp-load.php";
$page_id = 2371; // new-support page, per this project'"'"'s established portal page ID
$post = get_post( $page_id );
$content = $post->post_content;
// Insert a copy override into the existing block comment (find/replace the
// opening block delimiter to add attributes JSON).
$new_content = preg_replace(
	"/<!-- wp:sublime-crm\/support-portal(\s*\/?)-->/",
	"<!-- wp:sublime-crm/support-portal {\"copy\":{\"newTicket\":{\"heading\":\"PHASE16 TEST HEADING\"}}} /-->",
	$content,
	1
);
wp_update_post( [ "ID" => $page_id, "post_content" => $new_content ] );
echo "Updated.\n";
'
```

Then Playwright:

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://sublimetheme.test/new-support/', { waitUntil: 'load', timeout: 20000 });
  const heading = await page.locator('h1.pt-h1').first().innerText();
  console.log('Overridden heading (expect "PHASE16 TEST HEADING"):', heading);
  await browser.close();
})();
```

Expected: `PHASE16 TEST HEADING` — confirms the full round trip (block attribute → `render.php` → `wp_localize_script` → `copy-defaults.js` merge → `NewTicketView` render) works.

- [ ] **Step 5: Restore the real page's content, confirm defaults return**

```bash
php -r '
require "wp-load.php";
$page_id = 2371;
$post = get_post( $page_id );
$content = $post->post_content;
$restored = preg_replace(
	"/<!-- wp:sublime-crm\/support-portal \{.*?\} \/-->/",
	"<!-- wp:sublime-crm/support-portal /-->",
	$content,
	1
);
wp_update_post( [ "ID" => $page_id, "post_content" => $restored ] );
echo "Restored.\n";
'
```

Re-run the Playwright check from Step 4 — expect `How can we help?` again.

- [ ] **Step 6: Commit**

```bash
git add blocks/support-portal/block.json blocks/support-portal/render.php
git commit -m "Add copy block attribute, localize into stcrmPortal.copy (Phase 16)"
```

---

### Task 11: `editor.jsx` — state switcher + Inspector Controls + inert preview

**Files:**
- Modify: `src/portal/editor.jsx`

**Interfaces:**
- Consumes: `DEFAULT_COPY` from `./copy-defaults.js`; `CopyProvider` from `./copy-defaults.js`; `NewTicketView` (default export) + `SuccessState` (named export) from `./NewTicketView.jsx`; `CapReachedView` (default) from `./CapReachedView.jsx`; `AuthView` (default) + `SentState` (named) from `./AuthView.jsx`; `ExpiredView` (default) from `./ExpiredView.jsx`; `MyTicketsView` (default) from `./MyTicketsView.jsx`; `EmptyView` (default) from `./EmptyView.jsx`; `ThreadView` (default) from `./ThreadView.jsx`

- [ ] **Step 1: Full rewrite**

Modify `src/portal/editor.jsx` (entire file):

```jsx
/**
 * SublimeCRM Support Portal — block editor component.
 *
 * Dynamic block: the frontend is rendered by PHP (render.php). The editor
 * canvas renders the *real* view components in an inert `previewMode`
 * (API calls replaced with sample data, handlers become no-ops) — not a
 * separately-maintained mockup, and never the genuinely live app, since the
 * portal makes real mutating REST calls (create tickets, send real customer
 * emails) that must never fire just from an editor previewing the block.
 * Phase 16, 2026-07-14.
 */
import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl, TextareaControl, SelectControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { DEFAULT_COPY, CopyProvider } from './copy-defaults.js';
import NewTicketView, { SuccessState } from './NewTicketView.jsx';
import CapReachedView from './CapReachedView.jsx';
import AuthView, { SentState } from './AuthView.jsx';
import ExpiredView from './ExpiredView.jsx';
import MyTicketsView from './MyTicketsView.jsx';
import EmptyView from './EmptyView.jsx';
import ThreadView from './ThreadView.jsx';

const PREVIEW_SESSION_ANON = { authenticated: false, contact: {}, tickets: [] };
const PREVIEW_SESSION_AUTH = {
	authenticated: true,
	contact: { email: 'jane@example.com', has_wp_account: false, signed_in_via_wp_login: false },
	tickets: [
		{
			id: 101,
			subject: 'Sample ticket subject',
			status: 'awaiting_agent',
			unread_count: 1,
			category: 'Technical Support',
			product_label: 'Sample Product',
			last_activity_at: '2026-07-14 09:00:00',
		},
	],
};
const PREVIEW_SESSION_AUTH_EMPTY = {
	authenticated: true,
	contact: { email: 'jane@example.com', has_wp_account: false, signed_in_via_wp_login: false },
	tickets: [],
};

const SCREENS = [
	{ key: 'newTicket',       label: 'New Ticket',       Component: () => <NewTicketView session={ PREVIEW_SESSION_ANON } previewMode /> },
	{ key: 'ticketSubmitted', label: 'Ticket Submitted', Component: () => <SuccessState session={ PREVIEW_SESSION_ANON } /> },
	{ key: 'capReachedFree',  label: 'Cap Reached',      Component: () => <CapReachedView session={ PREVIEW_SESSION_ANON } ticketId={ 42 } previewMode /> },
	{ key: 'signIn',          label: 'Sign In',          Component: () => <AuthView previewMode /> },
	{ key: 'checkInbox',      label: 'Check Your Inbox', Component: () => <SentState /> },
	{ key: 'expiredLink',     label: 'Expired Link',     Component: () => <ExpiredView previewMode /> },
	{ key: 'myTickets',       label: 'My Tickets',       Component: () => <MyTicketsView session={ PREVIEW_SESSION_AUTH } previewMode /> },
	{ key: 'emptyState',      label: 'Empty State',      Component: () => <EmptyView session={ PREVIEW_SESSION_AUTH_EMPTY } previewMode /> },
	{ key: 'thread',          label: 'Thread',           Component: () => <ThreadView ticketId={ 101 } session={ PREVIEW_SESSION_AUTH } previewMode /> },
];

/**
 * Every DEFAULT_COPY[screen] key becomes one TextControl (or TextareaControl
 * for the handful of longer body strings). No manual per-screen field list —
 * this reflects copy-defaults.js automatically, so a future key added there
 * never needs a matching manual field added here too.
 */
const TEXTAREA_KEYS = new Set( [
	'subtitle', 'body', 'bannerBody', 'footerNote', 'docsCardBody', 'proCardBody',
	'privacyNote', 'formUnavailableBody', 'lockedClosedBody', 'lockedResolvedBody',
	'lockedTurnLimitBody', 'messagePlaceholder',
] );

function CopyPanel( { screenKey, copy, onChange } ) {
	return (
		<PanelBody title={ SCREENS.find( ( s ) => s.key === screenKey )?.label ?? screenKey } initialOpen={ false }>
			{ Object.keys( DEFAULT_COPY[ screenKey ] ).map( ( fieldKey ) => {
				const Control = TEXTAREA_KEYS.has( fieldKey ) ? TextareaControl : TextControl;
				return (
					<Control
						key={ fieldKey }
						label={ fieldKey }
						placeholder={ DEFAULT_COPY[ screenKey ][ fieldKey ] }
						value={ copy?.[ screenKey ]?.[ fieldKey ] ?? '' }
						onChange={ ( value ) => onChange( screenKey, fieldKey, value ) }
					/>
				);
			} ) }
		</PanelBody>
	);
}

registerBlockType( 'sublime-crm/support-portal', {
	edit( { attributes, setAttributes } ) {
		const blockProps = useBlockProps();
		const copy = attributes.copy ?? {};
		const [ activeScreen, setActiveScreen ] = useState( SCREENS[ 0 ].key );

		function handleChange( screenKey, fieldKey, value ) {
			const nextScreen = { ...( copy[ screenKey ] ?? {} ) };
			if ( '' === value ) {
				delete nextScreen[ fieldKey ]; // empty = fall back to default, keep the override sparse
			} else {
				nextScreen[ fieldKey ] = value;
			}
			const nextCopy = { ...copy };
			if ( Object.keys( nextScreen ).length > 0 ) {
				nextCopy[ screenKey ] = nextScreen;
			} else {
				delete nextCopy[ screenKey ];
			}
			setAttributes( { copy: nextCopy } );
		}

		const ActiveComponent = SCREENS.find( ( s ) => s.key === activeScreen )?.Component ?? SCREENS[ 0 ].Component;

		return (
			<div { ...blockProps }>
				<InspectorControls>
					{ /* Iterate every DEFAULT_COPY key here, NOT the 9-entry SCREENS
					    list — SCREENS only drives the preview switcher, and
					    'capReachedPro' has its own copy fields (used at runtime
					    whenever a pro-tier customer with multiple open tickets hits
					    the cap) but isn't independently previewable in the canvas
					    (the switcher's single "Cap Reached" entry always previews
					    the Free variant, matching the approved 9-screen design).
					    Looping SCREENS here would silently give capReachedPro zero
					    Inspector Controls UI even though its strings are fully
					    customizable in the underlying data model. */ }
					{ Object.keys( DEFAULT_COPY ).map( ( screenKey ) => (
						<CopyPanel
							key={ screenKey }
							screenKey={ screenKey }
							copy={ copy }
							onChange={ handleChange }
						/>
					) ) }
				</InspectorControls>
				<div style={ { padding: 12, background: '#f6f7f7', borderBottom: '1px solid #dcdcde' } }>
					<SelectControl
						label="Preview screen"
						value={ activeScreen }
						options={ SCREENS.map( ( s ) => ( { label: s.label, value: s.key } ) ) }
						onChange={ setActiveScreen }
					/>
				</div>
				<div style={ { pointerEvents: 'none' } }>
					<CopyProvider overrides={ copy }>
						<ActiveComponent />
					</CopyProvider>
				</div>
			</div>
		);
	},
	save: () => null,
} );
```

> `pointerEvents: 'none'` on the preview wrapper is defense-in-depth on top of every component's own `previewMode` no-ops — belt-and-suspenders against any interactive element that might slip through a future edit to a view component without its author remembering to check `previewMode`.

- [ ] **Step 2: Build**

```bash
cd wp-content/plugins/sublime-crm
npm run build
```

Expected: clean build, `stcrm-portal-editor.js` recompiled (webpack entry already registered per `webpack.config.js`'s existing `stcrm-portal-editor` entry — no config change needed since `editor.jsx` was already the entry file).

- [ ] **Step 3: Verify live in the block editor**

Playwright, using a minted admin session (`wp_generate_auth_cookie()`, per this project's established no-password-needed pattern):

```js
// navigate to /wp-admin/post.php?post=2371&action=edit
// locate the Support Portal block in the canvas
// confirm default canvas shows "How can we help?" (New Ticket screen, default switcher value)
// open the block's Inspector panel, expand "New Ticket", type into the "heading" field
// confirm the canvas preview updates live to the typed text
// switch the "Preview screen" SelectControl to "Cap Reached"
// confirm canvas now shows "You already have an open ticket" (FreeCap's default bannerTitle)
// click inside the canvas preview (e.g. the Submit ticket button, if visible on New Ticket screen)
// confirm no network request fires (page.on('request') listener asserting no POST to /stcrm/v1/tickets)
```

Expected: all pass. Take a screenshot for visual confirmation of the switcher + live-updating panel + inert canvas.

- [ ] **Step 4: Confirm the saved page (Task 10's real page) is unaffected**

The block's `save: () => null` means nothing from the editor canvas is ever serialized into `post_content` beyond the attributes comment (dynamic block, unchanged from before this phase) — re-run Task 10 Step 4's Playwright check once more to confirm the frontend still renders correctly after this editor change.

- [ ] **Step 5: Commit**

```bash
git add src/portal/editor.jsx
git commit -m "Rewrite editor.jsx: state-switchable inert preview + per-screen Inspector Controls (Phase 16)"
```

---

### Task 12: Launcher `copy-defaults.js` + merged copy in `Launcher.jsx`

**Files:**
- Create: `src/launcher/copy-defaults.js`
- Modify: `src/launcher/Launcher.jsx`

**Interfaces:**
- Produces: `DEFAULT_COPY` (launcher shape, per schema above), `CopyProvider`, `useCopy( screen )` — same pattern as Task 1, separate module (launcher and portal never share a copy namespace)

- [ ] **Step 1: Create the file**

```js
/**
 * Single source of default English copy for the floating launcher, plus the
 * React Context used to read merged (defaults + admin overrides) copy.
 * Phase 16, 2026-07-14. Mirrored in PHP by
 * includes/class-stcrm-launcher-copy.php (Settings-tab placeholder text only
 * — that file is never imported here, the two are kept in sync by hand).
 */
import { createContext, useContext } from '@wordpress/element';

export const DEFAULT_COPY = {
	// ... (paste the full launcher DEFAULT_COPY object from the "Copy Key Schema" section above)
};

const CopyContext = createContext( {} );

export function CopyProvider( { overrides = {}, children } ) {
	return (
		<CopyContext.Provider value={ overrides }>
			{ children }
		</CopyContext.Provider>
	);
}

export function useCopy( screen ) {
	const overrides = useContext( CopyContext );
	return { ...DEFAULT_COPY[ screen ], ...( overrides?.[ screen ] ?? {} ) };
}
```

- [ ] **Step 2: Wrap `Launcher.jsx`'s root in `CopyProvider`, replace hardcoded text**

Modify `Launcher.jsx:1-2` (imports):

```jsx
import { useState, useEffect, useRef } from '@wordpress/element';
import apiFetch from './api.js';
import { useCopy, CopyProvider } from './copy-defaults.js';
```

Modify `PanelHeader` (currently `function PanelHeader( { onClose } )`):

```jsx
function PanelHeader( { onClose } ) {
	const copy = useCopy( 'panelHeader' );
	return (
		<div style={ {
			background:      'linear-gradient(135deg, #2271b1, #135e96)',
			color:           '#fff',
			padding:         18,
			display:         'flex',
			alignItems:      'center',
			justifyContent:  'space-between',
			flexShrink:      0,
		} }>
			<div>
				<div style={ { fontWeight: 700, fontSize: 16 } }>{ copy.title }</div>
				<div style={ { fontSize: 12.5, opacity: 0.9, marginTop: 2 } }>{ copy.subtitle }</div>
			</div>
			<button
				onClick={ onClose }
				style={ { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.9, padding: 4 } }
				aria-label="Close"
			>
				<Icon n="x" s={ 18 } />
			</button>
		</div>
	);
}
```

Modify `NoSessionView` — add `const copy = useCopy( 'compose' );` at the top of the function body and replace every hardcoded string:
- `docsUrl && (...)` link text `Check our docs first` → `{ copy.docsLink }`
- `<label style={ LABEL_S }>Email</label>` → `{ copy.emailLabel }`
- `<label style={ LABEL_S }>Name <span className="opt">(optional)</span></label>`-equivalent → `{ copy.nameLabel } <span style={ { fontWeight: 400 } }>{ copy.nameOptionalTag }</span>` (match existing inline styling, not `className="opt"` — this file is self-contained/inline-styled per its own established convention, confirm exact existing markup before replacing)
- `<label style={ LABEL_S }>Subject</label>` → `{ copy.subjectLabel }`
- `<label style={ LABEL_S }>Which product is this about?</label>` → `{ copy.categoryLabel }`
- `<option value="">{ null === products ? 'Loading…' : '— Select —' }</option>` → `<option value="">{ null === products ? copy.productLoadingPlaceholder : copy.selectPlaceholder }</option>`
- `<label style={ LABEL_S }>Message</label>` → `{ copy.messageLabel }`, its `placeholder="How can we help?"` → `placeholder={ copy.messagePlaceholder }`
- license key input's placeholder → `placeholder={ copy.licenseKeyPlaceholder }`
- `{ sending ? 'Sending…' : 'Send message' }` → `{ sending ? copy.submitSendingLabel : copy.submitLabel }`
- `Already signed in` / `Back to my tickets →` / `Already have a ticket?` / `Sign in →` → `copy.alreadySignedIn` / `copy.backToTicketsLink` / `copy.alreadyHaveTicket` / `copy.signInLink`
- `Support form unavailable` / its body paragraph → `copy.formUnavailableTitle` / `copy.formUnavailableBody`

Modify `SentView` — add `const copy = useCopy( 'sent' );`, replace its heading/body/CTA text with `copy.heading`/`copy.body`/`copy.ctaLabel`.

Modify `MyTicketsView` (launcher-local, distinct from the portal's file of the same name) — add `const copy = useCopy( 'myTickets' );`, replace `My tickets` kicker, `+ New`, `Signed in as`/`Sign out`/`Signing out…`, and the `No tickets yet.` empty-state line with `copy.kicker`/`copy.newButton`/`copy.signedInAsPrefix`/`copy.signOutLink`/`copy.signingOutLabel`/`copy.emptyLabel`.

Modify `ThreadView` (launcher-local) — add `const copy = useCopy( 'thread' );`, replace the reply input's `placeholder="Reply…"` with `placeholder={ copy.replyPlaceholder }`, the three locked-composer messages (`'This ticket is closed.'`, `'This ticket has been marked resolved.'`, `'Reply limit reached — wait for an agent response.'`) with `copy.lockedClosed`/`copy.lockedResolved`/`copy.lockedTurnLimit`, and `{ reopening ? 'Reopening…' : 'Reopen' }` with `{ reopening ? copy.reopeningLabel : copy.reopenButton }`.

- [ ] **Step 3: Wrap the root `Launcher` component's return in `CopyProvider`**

Modify `Launcher.jsx`'s final `export default function Launcher()` — wrap the existing return statement:

```jsx
	return (
		<CopyProvider overrides={ window.stcrmLauncher?.copy ?? {} }>
			<div style={ { fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } }>
				{ /* ... existing content unchanged ... */ }
			</div>
		</CopyProvider>
	);
```

- [ ] **Step 4: Build**

```bash
cd wp-content/plugins/sublime-crm && npm run build
```

- [ ] **Step 5: Verify defaults unchanged, live**

```js
// Playwright: navigate to the homepage, open the launcher, confirm
// document.querySelector('#crm-launcher-wrap').innerText includes 'Support'
// and 'We usually reply within a few hours' (PanelHeader defaults).
```

- [ ] **Step 6: Commit**

```bash
git add src/launcher/copy-defaults.js src/launcher/Launcher.jsx
git commit -m "Launcher: copy-defaults.js + merged copy across all views (Phase 16)"
```

---

### Task 13: `includes/class-stcrm-launcher.php` — localize `launcher_copy`

**Files:**
- Modify: `includes/class-stcrm-launcher.php`

**Interfaces:**
- Consumes: `STCRM_Settings::get_setting( 'launcher_copy', [] )` (available once Task 14 adds the default)
- Produces: `window.stcrmLauncher.copy` (sparse override array/object, read by `src/launcher/copy-defaults.js`'s `CopyProvider`)

- [ ] **Step 1: Add to the localized array**

Modify `includes/class-stcrm-launcher.php:47-62` (the `wp_localize_script` call inside `enqueue()`):

```php
		wp_localize_script(
			'stcrm-launcher',
			'stcrmLauncher',
			array(
				'apiBase'     => esc_url_raw( rest_url( 'stcrm/v1' ) ),
				'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
				'nonce'       => wp_create_nonce( 'wp_rest' ),
				'portalUrl'   => esc_url_raw( $this->get_portal_url() ),
				'docsUrl'     => esc_url_raw( STCRM_Settings::get_setting( 'docs_url', '' ) ),
				'wpUserEmail' => is_user_logged_in() ? wp_get_current_user()->user_email : '',
				// Sparse copy overrides from Settings → Launcher — merged with
				// DEFAULT_COPY client-side in src/launcher/copy-defaults.js.
				'copy'        => STCRM_Settings::get_setting( 'launcher_copy', array() ),
			)
		);
```

- [ ] **Step 2: `php -l`**

```bash
cd wp-content/plugins/sublime-crm
php -l includes/class-stcrm-launcher.php
```

Expected: `No syntax errors detected`.

- [ ] **Step 3: Commit**

```bash
git add includes/class-stcrm-launcher.php
git commit -m "Localize launcher_copy setting into window.stcrmLauncher.copy (Phase 16)"
```

---

### Task 14: `STCRM_Settings::$defaults` + `STCRM_Launcher_Copy` PHP defaults mirror

**Files:**
- Modify: `admin/class-stcrm-settings.php`
- Create: `includes/class-stcrm-launcher-copy.php`

**Interfaces:**
- Produces: `STCRM_Settings::get_setting( 'launcher_copy', [] )` returns `[]` on an untouched install; `STCRM_Launcher_Copy::DEFAULTS` (const array, PHP mirror of `src/launcher/copy-defaults.js`'s `DEFAULT_COPY`, keyed identically) — consumed by Task 15's Settings-tab placeholders

- [ ] **Step 1: Add the setting default**

Modify `admin/class-stcrm-settings.php` (the `private static array $defaults` block, right after `launcher_enabled`):

```php
		// Advanced tab, Bugfix (2026-07-14) — global on/off switch for the floating
		// launcher bubble (STCRM_Launcher). Defaults to 1 (enabled) so every existing
		// install's current behavior is unchanged until an admin explicitly turns it off.
		'launcher_enabled'     => 1,
		// Launcher tab, Phase 16 (2026-07-14) — sparse copy overrides for the
		// floating launcher's UI text. Empty array = every string falls back to
		// src/launcher/copy-defaults.js's DEFAULT_COPY, so an untouched install
		// renders byte-identical to pre-Phase-16.
		'launcher_copy'        => array(),
```

- [ ] **Step 2: Create the PHP defaults mirror**

```php
<?php
/**
 * PHP mirror of src/launcher/copy-defaults.js's DEFAULT_COPY.
 *
 * Used ONLY to render "current default" placeholder text on the Settings →
 * Launcher tab's plain PHP form (which can't `import` a JS module the way
 * the portal's React Inspector Controls can). Kept in sync with the JS file
 * by hand — both are static English strings written together in this one
 * phase; a drift here is cosmetic (a wrong placeholder), never functional,
 * since STCRM_Settings::get_setting('launcher_copy') always returns the raw
 * sparse override array regardless of what this class says.
 *
 * @package    SublimeCRM
 * @subpackage SublimeCRM/includes
 * @since      1.9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class STCRM_Launcher_Copy {

	public const DEFAULTS = array(
		'panelHeader' => array(
			'title'    => 'Support',
			'subtitle' => 'We usually reply within a few hours',
		),
		'compose' => array(
			'docsLink'                  => 'Check our docs first',
			'emailLabel'                => 'Email',
			'nameLabel'                 => 'Name',
			'nameOptionalTag'           => '(optional)',
			'subjectLabel'              => 'Subject',
			'categoryLabel'             => 'Which product is this about?',
			'selectPlaceholder'         => '— Select —',
			'productLoadingPlaceholder' => 'Loading…',
			'messageLabel'              => 'Message',
			'messagePlaceholder'        => 'How can we help?',
			'licenseKeyPlaceholder'     => 'sk_••••••••••••',
			'submitLabel'               => 'Send message',
			'submitSendingLabel'        => 'Sending…',
			'alreadySignedIn'           => 'Already signed in',
			'backToTicketsLink'         => 'Back to my tickets →',
			'alreadyHaveTicket'         => 'Already have a ticket?',
			'signInLink'                => 'Sign in →',
			'formUnavailableTitle'      => 'Support form unavailable',
			'formUnavailableBody'       => 'No products are configured for support yet. Please contact the site administrator.',
		),
		'sent' => array(
			'heading' => 'We’ve received your message',
			'body'    => 'Check your email for a sign-in link to view and track your ticket.',
			'ctaLabel' => 'Sign in to view →',
		),
		'myTickets' => array(
			'kicker'           => 'My tickets',
			'newButton'        => '+ New',
			'signedInAsPrefix' => 'Signed in as',
			'signOutLink'      => 'Sign out',
			'signingOutLabel'  => 'Signing out…',
			'emptyLabel'       => 'No tickets yet.',
		),
		'thread' => array(
			'replyPlaceholder' => 'Reply…',
			'lockedClosed'     => 'This ticket is closed.',
			'lockedResolved'   => 'This ticket has been marked resolved.',
			'lockedTurnLimit'  => 'Reply limit reached — wait for an agent response.',
			'reopenButton'     => 'Reopen',
			'reopeningLabel'   => 'Reopening…',
		),
	);
}
```

- [ ] **Step 3: Require the new file**

Modify `includes/class-sublime-crm.php`'s `load_dependencies()` — find where sibling `includes/class-stcrm-*.php` files are required and add:

```php
require_once STCRM_PLUGIN_DIR . 'includes/class-stcrm-launcher-copy.php';
```

Place it immediately after the existing `require_once ... class-stcrm-launcher.php` line, so it loads alongside its counterpart.

- [ ] **Step 4: `php -l` both files**

```bash
cd wp-content/plugins/sublime-crm
php -l admin/class-stcrm-settings.php
php -l includes/class-stcrm-launcher-copy.php
php -l includes/class-sublime-crm.php
```

Expected: `No syntax errors detected` for all three.

- [ ] **Step 5: Verify the default resolves correctly**

```bash
php -r '
require "wp-load.php";
$val = STCRM_Settings::get_setting( "launcher_copy", array() );
echo "launcher_copy default: " . var_export( $val, true ) . "\n";
echo "STCRM_Launcher_Copy::DEFAULTS[panelHeader][title]: " . STCRM_Launcher_Copy::DEFAULTS["panelHeader"]["title"] . "\n";
' 2>&1 | grep -v "^Warning:"
```

Expected: `launcher_copy default: array (\n)` (empty array), `STCRM_Launcher_Copy::DEFAULTS[panelHeader][title]: Support`.

- [ ] **Step 6: Commit**

```bash
git add admin/class-stcrm-settings.php includes/class-stcrm-launcher-copy.php includes/class-sublime-crm.php
git commit -m "Add launcher_copy setting default + STCRM_Launcher_Copy PHP defaults mirror (Phase 16)"
```

---

### Task 15: New "Launcher" Settings tab

**Files:**
- Modify: `admin/class-stcrm-settings.php`

**Interfaces:**
- Consumes: `STCRM_Launcher_Copy::DEFAULTS` (Task 14), `STCRM_Settings::get_setting( 'launcher_copy', [] )`
- Produces: a 5th Settings tab (`freemius`/`email`/`tickets`/`advanced`/`launcher`); moves the existing `launcher_enabled` checkbox here from Advanced; `handle_save()` gains a `'launcher'` case

- [ ] **Step 1: Add `'launcher'` to the valid-tabs list and the nav**

Modify `admin/class-stcrm-settings.php:402` (`render_page()`'s valid-tab check):

```php
		if ( ! in_array( $active_tab, array( 'freemius', 'email', 'tickets', 'advanced', 'launcher' ), true ) ) {
			$active_tab = 'freemius';
		}
```

Modify `admin/class-stcrm-settings.php:440-444` (nav tabs, right after the Advanced `<a>`):

```php
				<a href="<?php echo esc_url( add_query_arg( array( 'page' => 'stcrm-settings', 'tab' => 'launcher' ), admin_url( 'admin.php' ) ) ); ?>"
				   class="nav-tab <?php echo 'launcher' === $active_tab ? 'nav-tab-active' : ''; ?>">
					<?php esc_html_e( 'Launcher', 'sublime-crm' ); ?>
				</a>
			</nav>
```

(The closing `</nav>` moves to after the new tab — replace the existing standalone `</nav>` line with the two lines above.)

- [ ] **Step 2: Remove the `launcher_enabled` checkbox from the Advanced tab**

Modify `admin/class-stcrm-settings.php` (the `<tr>` block added for `launcher_enabled` in the Advanced-tab table, added in the earlier launcher-visibility bugfix) — delete it entirely:

```php
						<tr>
							<th scope="row"><?php esc_html_e( 'Floating Launcher', 'sublime-crm' ); ?></th>
							<td>
								<label for="stcrm-launcher-enabled">
									<input type="checkbox"
									       id="stcrm-launcher-enabled"
									       name="stcrm_settings[launcher_enabled]"
									       value="1"
									       <?php checked( 1, $settings['launcher_enabled'] ); ?>>
									<?php esc_html_e( 'Show the floating support bubble on the frontend', 'sublime-crm' ); ?>
								</label>
								<p class="description"><?php esc_html_e( 'The floating support button that appears in the corner of every frontend page. It never shows on the Support Portal page itself, regardless of this setting, since that page already has the full support UI embedded.', 'sublime-crm' ); ?></p>
							</td>
						</tr>
```

(Delete this whole `<tr>` — it moves to the new Launcher tab in Step 3.)

- [ ] **Step 3: Add the new Launcher tab's render branch**

Modify `admin/class-stcrm-settings.php` (the tab-rendering `if/elseif` chain in `render_page()`, right after the `advanced` branch's closing `<?php endif; ?>` for its table but before the outer `</div><!-- .stcrm-tab-panel -->`) — add:

```php
				<?php elseif ( 'launcher' === $active_tab ) : ?>

					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><?php esc_html_e( 'Floating Launcher', 'sublime-crm' ); ?></th>
							<td>
								<label for="stcrm-launcher-enabled">
									<input type="checkbox"
									       id="stcrm-launcher-enabled"
									       name="stcrm_settings[launcher_enabled]"
									       value="1"
									       <?php checked( 1, $settings['launcher_enabled'] ); ?>>
									<?php esc_html_e( 'Show the floating support bubble on the frontend', 'sublime-crm' ); ?>
								</label>
								<p class="description"><?php esc_html_e( 'The floating support button that appears in the corner of every frontend page. It never shows on the Support Portal page itself, regardless of this setting, since that page already has the full support UI embedded.', 'sublime-crm' ); ?></p>
							</td>
						</tr>
					</table>

					<?php
					$launcher_copy = $settings['launcher_copy'] ?? array();
					foreach ( STCRM_Launcher_Copy::DEFAULTS as $screen_key => $fields ) :
						?>
						<h2 style="margin-top:24px;"><?php echo esc_html( ucfirst( preg_replace( '/(?<!^)[A-Z]/', ' $0', $screen_key ) ) ); ?></h2>
						<table class="form-table" role="presentation">
							<?php foreach ( $fields as $field_key => $default_text ) : ?>
								<tr>
									<th scope="row"><?php echo esc_html( $field_key ); ?></th>
									<td>
										<input type="text"
										       name="stcrm_settings[launcher_copy][<?php echo esc_attr( $screen_key ); ?>][<?php echo esc_attr( $field_key ); ?>]"
										       value="<?php echo esc_attr( $launcher_copy[ $screen_key ][ $field_key ] ?? '' ); ?>"
										       placeholder="<?php echo esc_attr( $default_text ); ?>"
										       class="large-text">
									</td>
								</tr>
							<?php endforeach; ?>
						</table>
					<?php endforeach; ?>
```

- [ ] **Step 4: `handle_save()` — new `'launcher'` case**

Modify `admin/class-stcrm-settings.php`'s `handle_save()` `switch ( $tab )` — add, after the existing `'advanced':` case's closing `break;`:

```php
			case 'launcher':
				$current['launcher_enabled'] = ! empty( $posted['launcher_enabled'] ) ? 1 : 0;

				// Sparse-save: only keep non-empty overridden fields, dropping any
				// screen/field left blank so it falls back to the JS-side default —
				// matches the block attribute's sparse-storage design exactly.
				$posted_copy   = is_array( $posted['launcher_copy'] ?? null ) ? $posted['launcher_copy'] : array();
				$sparse_copy   = array();
				foreach ( STCRM_Launcher_Copy::DEFAULTS as $screen_key => $fields ) {
					foreach ( $fields as $field_key => $default_text ) {
						$value = trim( (string) ( $posted_copy[ $screen_key ][ $field_key ] ?? '' ) );
						if ( '' !== $value ) {
							$sparse_copy[ $screen_key ][ $field_key ] = sanitize_text_field( $value );
						}
					}
				}
				$current['launcher_copy'] = $sparse_copy;
				break;
```

- [ ] **Step 5: `php -l`**

```bash
cd wp-content/plugins/sublime-crm
php -l admin/class-stcrm-settings.php
```

Expected: `No syntax errors detected`.

- [ ] **Step 6: Verify — real save round trip, sparse storage confirmed**

```bash
php -r '
require "wp-load.php";
$users = get_users( [ "role" => "administrator", "number" => 1 ] );
$admin = $users[0];
wp_set_current_user( $admin->ID );
$nonce = wp_create_nonce( "stcrm_save_settings" );

$posted = [
	"stcrm_nonce" => $nonce,
	"stcrm_tab"   => "launcher",
	"stcrm_settings" => [
		"launcher_enabled" => 1,
		"launcher_copy" => [
			"panelHeader" => [ "title" => "PHASE16 TEST TITLE" ],
			// subtitle left blank on purpose — must NOT appear in the saved sparse array
		],
	],
];
$_POST = $posted;
$_REQUEST = $posted;
$_SERVER["REQUEST_METHOD"] = "POST";
try {
	( new STCRM_Settings( "sublime-crm", STCRM_VERSION ) )->handle_save();
} catch ( \Throwable $e ) {}
'
```

Then, fresh process (per the documented `exit()`-after-redirect quirk):

```bash
php -r '
require "wp-load.php";
$val = STCRM_Settings::get_setting( "launcher_copy", array() );
echo "launcher_copy: " . var_export( $val, true ) . "\n";
echo "subtitle key present (expect false): " . var_export( isset( $val["panelHeader"]["subtitle"] ), true ) . "\n";
' 2>&1 | grep -v "^Warning:"
```

Expected: `launcher_copy` contains `['panelHeader' => ['title' => 'PHASE16 TEST TITLE']]` only — `subtitle` absent (sparse storage confirmed, blank field didn't write an empty string).

- [ ] **Step 7: Verify live — the override actually renders on the frontend**

```js
// Playwright: navigate to homepage, open the launcher, confirm the panel
// header shows "PHASE16 TEST TITLE" instead of "Support".
```

- [ ] **Step 8: Restore defaults, confirm restored**

```bash
php -r '
require "wp-load.php";
$users = get_users( [ "role" => "administrator", "number" => 1 ] );
$admin = $users[0];
wp_set_current_user( $admin->ID );
$nonce = wp_create_nonce( "stcrm_save_settings" );
$posted = [
	"stcrm_nonce" => $nonce,
	"stcrm_tab"   => "launcher",
	"stcrm_settings" => [
		"launcher_enabled" => 1,
		"launcher_copy" => [],
	],
];
$_POST = $posted;
$_REQUEST = $posted;
$_SERVER["REQUEST_METHOD"] = "POST";
try {
	( new STCRM_Settings( "sublime-crm", STCRM_VERSION ) )->handle_save();
} catch ( \Throwable $e ) {}
'
php -r '
require "wp-load.php";
echo "launcher_copy restored: " . var_export( STCRM_Settings::get_setting( "launcher_copy", array() ), true ) . "\n";
' 2>&1 | grep -v "^Warning:"
```

Expected: `launcher_copy restored: array (\n)`.

- [ ] **Step 9: Commit**

```bash
git add admin/class-stcrm-settings.php
git commit -m "Add Launcher Settings tab: moves launcher_enabled here, adds launcher_copy fields (Phase 16)"
```

---

### Task 16: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Full defaults-unchanged regression pass**

Playwright against `sublimetheme.test` with both `copy` block attribute and `launcher_copy` setting confirmed empty (per Tasks 10/15's restore steps):
- Homepage: launcher panel header reads "Support" / "We usually reply within a few hours"
- `/new-support/`: New Ticket heading reads "How can we help?", submit button reads "Submit ticket"
- Navigate to `?view=auth`: heading reads "Sign in to view your tickets"

- [ ] **Step 2: One combined real-override pass across both surfaces simultaneously**

Set a real block attribute override (`newTicket.heading`) AND a real `launcher_copy` override (`panelHeader.title`) at the same time via the same round trips used in Tasks 10/15, then confirm via Playwright that both surfaces show their respective overridden text on the same page load — proves the two systems don't interfere with each other (separate localized globals, separate Context instances).

- [ ] **Step 3: Editor preview full pass**

Playwright against the block editor (`/wp-admin/post.php?post=2371&action=edit`): cycle the "Preview screen" switcher through all 9 options, confirming each renders without a JS console error (`page.on('pageerror')` listener) and without any network request to `/stcrm/v1/*` firing (`page.on('request')` listener asserting zero REST calls throughout the entire pass, across all 9 states) — the core safety guarantee this phase's biggest design decision was built around.

- [ ] **Step 4: Clean up all test data**

Restore both the real page's block content and `launcher_copy`/any other touched settings to their pre-verification state (already done incrementally in Tasks 10/15/16, but do one final confirming pass). Confirm no disposable test tickets/contacts were left behind by any of the above (none should have been created — this phase makes zero real API calls in its own verification, by design).

- [ ] **Step 5: Update `phase-plan-clickup.md`'s Phase 16 checklist**

Check off all 13 items in the Phase 16 section (currently `- [ ]`), matching how every prior phase's checklist was updated once built. Add a `**Verified (2026-07-14):** ...` paragraph summarizing the checks above, and a `**Commit(s), pushed to origin/master:**` line once the code is actually committed and pushed (per this project's standing rule — only when explicitly instructed).

- [ ] **Step 6: Update the plugin's own `CLAUDE.md`**

Add a "Phase 16 COMPLETE" changelog entry (header + §-equivalent Phase Completion table row, matching the plugin repo's own established convention, distinct from the docs-repo `CLAUDE.md` already updated at design time).

---

## Process Recommendation

Tasks 3–9 (the 7 view-component refactors) and Tasks 12–15 (launcher + its Settings tab) are almost entirely independent of each other — each touches exactly one file (or a tightly-scoped pair), with no task depending on another task's *output* beyond the shared `copy-defaults.js` module built in Task 1/12. This makes the plan a strong candidate for `superpowers:subagent-driven-development`: dispatch Tasks 3–9 as parallel/sequential fresh-subagent tasks once Tasks 1–2 land, and Tasks 12–15 similarly once Task 12 lands, with Tasks 10–11 and 16 as the sequencing/integration points. Final execution-strategy choice belongs to whoever runs this plan.

---
name: web-interface-review
description: Review Vue/Vuetify UI code in this repo against the Web Interface Guidelines (Vercel's accessibility, focus, forms, animation, typography, content, navigation, touch and copy rules, adapted to Vue 3 + Vuetify 4). Use when the user asks for a web interface guidelines review, a UI/UX or accessibility (a11y) review of specific .vue files, components or views, or invokes /web-interface-review. Produces terse file:line findings grouped by file, including real bugs spotted in the reviewed code.
argument-hint: <file-or-pattern>
---

# Web Interface Guidelines review (Vue + Vuetify)

Review the files named in the arguments (a path, glob or directory). If none are given, review the `.vue` files changed in `git diff HEAD` (plus untracked ones from `git status`); if there are none, ask which files to review.

Read each file fully, check it against the rules below, and output findings in the format at the end. Concise but comprehensive — sacrifice grammar for brevity. High signal-to-noise.

## Stack context — read before judging

The source guidelines were written for React/Next. Camp Log is **Vue 3 SFCs + Vuetify 4, client-rendered (no SSR)**, an installable PWA that works offline (unsynced logs/locations queue in `src/scripts/outbox.ts`). It's used mostly **on phones, outdoors at a campsite** — one-handed, in sun glare, often with poor or no signal — and also on desktop. Translate every rule to Vue terms (`@click`, `@keydown`, `:for`, `router-link`/`:to`, `spellcheck="false"`) and don't flag React-only concerns.

Vuetify already satisfies many rules, so flagging its components for them is noise. Verified against Vuetify 4.x source:

| Component | What Vuetify already does | What still needs checking |
|---|---|---|
| `v-btn` | Renders `<button>` (or `<a>` with `:to`/`href`), focus-visible ring, hover/active states | Icon-only `v-btn` (`icon`/`:icon` prop, or only a `v-icon` child) has no accessible name — needs `aria-label`. A `v-tooltip` only adds `aria-describedby`, **not** a name, so a tooltip alone doesn't fix it |
| `v-icon` | Sets `aria-hidden="true"` when not clickable — decorative icons are fine | `v-icon @click` gets `role="button"` + `tabindex="0"` but **no Enter/Space handler** → keyboard users can't activate it. Should be an icon `v-btn` with `aria-label` |
| `v-list-item`, `v-chip` with `@click` | tabindex, Enter/Space handling, `<a>` with `:to` | Nothing — don't flag as "div with click handler" |
| `v-card @click` (no `:to`/`href`) | Nothing — renders a `div` with no tabindex or key handling | Flag: not keyboard-reachable. Use `:to` for navigation, or put a `v-btn` inside |
| `v-text-field`, `v-select`, `v-autocomplete`, `v-combobox`, `v-textarea`, `v-file-input`, `v-checkbox`, `v-switch`, etc. | `label` prop renders a clickable, associated label; checkbox label + control share one hit target | Missing `label` (and no `aria-label`) is a finding. Errors via `:rules`/`error-messages` render inline — fine |
| `v-dialog`, `v-menu`, `v-navigation-drawer` | Focus trap, Esc to close, scroll lock | — |
| `v-data-table` | Pagination (default 10 rows/page) | A `v-for` over an unbounded collection outside a table/`v-pagination`/`v-virtual-scroll` |
| `v-btn :loading` | `pointer-events: none`, `tabindex="-1"`, `aria-busy` while loading — blocks a second tap | A submit with `:loading` bound to the in-flight flag is already double-submit-safe; one without `:loading` (or `:disabled`) isn't |
| `v-alert`, `v-snackbar` | `v-alert` has `role="alert"`; `v-snackbar` has `role="status"` + `aria-live="polite"` | Don't ask for `aria-live` on these |
| `v-card-title`, `v-card-subtitle` | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` | Long user content (log/location names, descriptions) in them is clipped to one line; a title that's also a `d-flex` row with actions can push the actions out |

**Sizes** (for the 44 px touch-target rule), from Vuetify 4 CSS:

- `v-btn` height: default 36, `density="comfortable"` 28, `density="compact"` 24 px. Default 36 is the app-wide norm — flag `comfortable`/`compact`, `size="small"`/`"x-small"`, and small custom `size` icons used as tap targets, not every default button.
- Inputs (`v-text-field` etc.): default 56, comfortable 48, compact 40 px.
- `v-table` rows: default 52, comfortable 44, compact 36 px.

These facts are already verified — rely on them rather than re-reading `node_modules/vuetify`. Open Vuetify's source only for a behaviour not covered here that a finding hinges on.

Raw HTML elements (`<div @click>`, `<img>`, `<input>`, `<a>`) in a template get the full rules.

### Project conventions (flag deviations from these, not from the generic rule)

- **Registration**: `vite-plugin-vuetify` auto-imports every `<v-*>` component and directive. Don't check or flag registration. Vuetify is configured in `src/plugins/vuetify.ts`.
- **Dates**: there's no shared date helper; display dates use `toLocaleDateString()` (the device's locale). Don't suggest `Intl.DateTimeFormat` or a date library. Flag dates shown via `toISOString()`/`.slice(...)`, built by hand in a template literal, given a hard-coded locale, or shown with time when only the date matters. Date ranges on one screen should use one format (e.g. not `–` in one place and `to` in another). Numbers: `toFixed` for coordinates (5 dp) and `Intl.NumberFormat` are fine; flag hand-rolled thousands separators.
- **Destructive actions** (delete, discard, remove): go through `askConfirm(message, { confirmText })` from `src/scripts/confirm.ts`. `color` defaults to `'error'`, so don't ask for it. The message says what's lost (e.g. "Its activities and photos will be deleted too."), and `confirmText` is the verb (`'Delete'`, `'Discard'`, `'Remove'`), never the default `'Confirm'`. An immediate destructive `@click` with no confirm is a finding.
- **Danger colour**: the control that triggers a dangerous or destructive action (delete, remove, clear, discard, reset, overwrite) is coloured `error` or `warning` so it reads as dangerous before it's pressed — `color="error"`/`"warning"` on the `v-btn` (icon-only ones included), or on the `v-icon` in it. A default/`primary`/uncoloured destructive control is a finding, even when a confirm follows. This includes removing a row from an unsaved list (e.g. an activity row while adding a log). Exempt: the confirm dialog's own button (`ConfirmDialog.vue`), which `askConfirm`'s `color` already sets.
- **Navigation**: use `:to` on `v-btn`/`v-list-item`/`router-link` so it renders `<a>` (Ctrl/middle-click work). `@click="router.push(...)"` for plain navigation is a finding; `router.push` after a save/delete/async step is fine.
- **Offline**: saves of logs/locations may land in the outbox instead of the server. Anything that only works online (geocoding, photo upload, Terrain import) needs a visible offline state or error, not a silent failure or endless spinner. `OnlineStatusBanner.vue` shows connectivity app-wide — don't ask each screen for its own banner.
- **Theme**: dark mode is the app's own toggle (`darkTheme` in `src/scripts/theme.ts`, bound on `v-app`), not the OS preference. Anything hard-coded to light colours is a finding.
- **Button label casing**: don't flag each label's casing. Flag only inconsistency on the same screen, as one finding per file.

## Rules

### Accessibility
- Icon-only buttons need `aria-label` (see the `v-btn`/`v-icon` notes above)
- Form controls need a `label` prop, `<label :for>`, or `aria-label`
- `<button>`/`v-btn` for actions, `<a>`/`:to` for navigation — not `<div @click>`/`<span @click>`/`v-card @click`
- Raw interactive elements need keyboard handling (`@keydown.enter`/`.space`) and `tabindex`
- `<img>`/`v-img` need `alt` (`alt=""` if decorative); photos with a caption/location name should use it
- Decorative raw `<svg>`/icon fonts need `aria-hidden="true"`
- Async updates (validation, "saved"/"queued offline" messages rendered outside Vuetify inputs) need `aria-live="polite"` (`v-snackbar` already has a live region)
- Semantic HTML before ARIA
- Heading levels hierarchical and not skipped for styling — use Vuetify `text-h*` classes to style instead of picking a smaller `<h*>`
- Map-only information (Leaflet markers in `MapView.vue`) needs a non-map route to the same data (list, search, link to the location)
- Meaningful media needs captions, transcripts, or descriptions; media controls keyboard-operable

### Focus states
- Never `outline: none`/`outline: 0` in `<style>` without a `:focus-visible` replacement
- `:focus-visible` over `:focus`
- `:focus-within` for compound controls
- Sticky headers/footers (`v-app-bar`, `BottomBar.vue`, `v-fab`, sticky action bars) must not cover the focused element or the last list item — `scroll-margin`/`scroll-padding` or bottom padding where content scrolls under them

### Forms
- Raw `<input>`: meaningful `name`, correct `type` (`email`, `tel`, `url`, `number`), `inputmode`, `autocomplete`. For Vuetify inputs, pass `type`/`inputmode`/`autocomplete`/`name` through as attrs (`inputmode="decimal"` for latitude/longitude and numeric activity values)
- Auth forms (`LoginView.vue`, `RegisterView.vue`): `autocomplete="email"`, `"current-password"`/`"new-password"`
- `autocomplete="off"` on non-auth fields that password managers would otherwise hijack
- `spellcheck="false"` on emails, codes, usernames, coordinates
- Never block paste (`@paste.prevent`)
- Submit stays enabled until the request starts; shows `loading` during it (`v-btn :loading`); prevent double submit
- Errors inline next to fields; focus the first invalid field on submit (`VForm.validate()` result → focus)
- Placeholders end with `…` and show an example pattern
- Warn before leaving with unsaved changes (`onBeforeRouteLeave` / dialog close guard) for long forms (adding a log or location, imports)

### Animation
- Honor `prefers-reduced-motion` for custom CSS animations/transitions
- Animate `transform`/`opacity` only
- Never `transition: all` — list properties
- Correct `transform-origin`; SVG transforms on a `<g>` with `transform-box: fill-box`
- Animations interruptible
- Autoplaying motion >5 s needs pause/stop/hide

### Typography
- `…` not `...` in user-visible strings
- Curly quotes `“ ” ‘ ’` in user-visible copy, not straight quotes (ignore attribute/JS string delimiters)
- Non-breaking spaces between number and unit (`12&nbsp;km`, `10&nbsp;MB`, `3&nbsp;nights`), shortcuts, brand names
- Loading text ends with `…`: `Loading…`, `Saving…`, `Syncing…`
- `font-variant-numeric: tabular-nums` for numeric columns/comparisons (stats, counts, coordinates)
- `text-wrap: balance`/`pretty` on headings where widows are likely

### Content handling
- Text containers handle long content: `text-truncate`, line clamp, or `text-break`
- Flex children that truncate need `min-width: 0` (`min-w-0`-equivalent)
- Empty states handled (`v-empty-state`, `no-data-text`) — no broken UI for empty strings/arrays or `null` relations (a log with no location, no photos, no `dateEnd`)
- User-generated content (log/location names, descriptions, weather notes, activity names, imported Terrain entries): anticipate short, average, very long, and empty

### Images
- Raw `<img>`: explicit `width`/`height`; `loading="lazy"` below the fold. `v-img` with `aspect-ratio` or fixed size is fine
- Photo grids load thumbnails, not full-size uploads, on mobile data

### Performance
- Large lists (>50 items) rendered with `v-for`: paginate, `v-virtual-scroll`, or `content-visibility: auto` — users accumulate years of logs and photos
- No layout reads in render/computed (`getBoundingClientRect`, `offsetHeight`, `scrollTop`); batch DOM reads/writes
- `v-model` on inputs driving expensive `watch`/computed work or requests per keystroke (search, geocoding) — debounce
- Live queries, watchers, map instances or object URLs (`URL.createObjectURL` for photo previews) not cleaned up on unmount

### Navigation & state
- URL reflects state: tabs, filters, search query, pagination, selected record, expanded panels → route query/params where a user would want to share or reload it
- Links are real links (`:to` / `<a>`), see conventions
- Destructive actions confirmed and coloured `error`/`warning`, see conventions

### Touch & interaction (phones matter here)
- Touch targets ≥ 44 px — watch `density="compact"`, `size="x-small"`, tight icon buttons, small delete icons overlaid on photos
- `touch-action: manipulation` on custom interactive elements; `-webkit-tap-highlight-color` set intentionally
- `overscroll-behavior: contain` on custom scroll containers in dialogs/drawers
- Embedded maps must not trap page scroll on phones (one-finger page scroll vs. two-finger map pan, or a fixed-height map)
- Drag/swipe/reorder needs a tap/keyboard alternative; disable text selection during drag
- `autofocus` sparingly — single primary input, never on a page opened from a phone tap (pops the keyboard over the content)
- Hover-only affordances (actions revealed only on `:hover`) are invisible on touch

### Layout
- Full-bleed layouts, bottom bars and FABs need `env(safe-area-inset-*)` (standalone PWA on notched phones)
- No unwanted horizontal scroll at 360 px wide; fix overflow rather than hiding it
- Flex/grid (`v-row`/`v-col`, `d-flex`) over JS measurement

### Theming
- Hard-coded colours (`#fff`, `color: black`) in `<style>` or inline styles break the dark theme — use theme colours (`rgb(var(--v-theme-…))`, `color=` props). Leaflet popups/controls styled by hand need dark variants too
- Contrast holds up outdoors: no light-grey body text or `opacity`-faded content carrying meaning
- Native `<select>`: explicit `background-color` and `color`

### Locale & i18n
- Dates: see conventions
- Brand names, codes, identifiers (Camp Log, Terrain, coordinates): `translate="no"`

### Hover & interactive states
- Custom interactive elements need hover/active/focus states, each more prominent than rest

### Content & copy
- Active voice; second person; no first person
- Numerals for counts ("8 logs", "3 photos")
- Specific labels: "Save Log" not "OK"/"Continue"/"Submit"
- Error messages say how to fix, not just what failed ("You're offline — this log will sync when you reconnect" over "Network error")
- `&` over "and" only where space-constrained

### Anti-patterns (always flag)
- `user-scalable=no` / `maximum-scale=1`
- `@paste.prevent` or paste handler calling `preventDefault`
- `transition: all`
- `outline: none` without focus-visible replacement
- `@click="router.push(...)"` for plain navigation
- `<div>`/`<span>`/`v-card`/`v-icon` with `@click` (see table)
- Raw `<img>` without dimensions
- Unbounded `v-for` without pagination/virtualization
- Inputs without labels; icon buttons without `aria-label`
- Dates displayed via `toISOString()`/hand-built strings instead of `toLocaleDateString()`
- `autofocus` without clear justification
- Animated GIF where video fits
- Gesture-only action
- Destructive/dangerous control without `color="error"` or `"warning"`
- `askConfirm` left on the default `'Confirm'` button text for a destructive action

## Before reporting

For each candidate finding, check the surrounding code once: is the label passed via `v-bind`/a slot? is the confirm in the called method rather than the template? is the danger colour set via `v-bind`, a computed `:color`, or on the button's icon? is the list already bounded by the query (`limit`/`page`)? Drop findings the code already handles. A short list of real issues beats a long list with false positives.

## Bugs found along the way

You'll be reading the whole file, including `<script setup>`. When you notice a real bug that affects what the user sees, report it too, even though it isn't a guideline rule. Look for:

- `load()`/fetch without `try/catch` → `loading` never clears, the page is stuck on a spinner (or skeleton) with no error shown — especially likely offline
- validation that lets `null` through (a cleared `v-number-input` or `v-text-field type="number"` emits `null`/`''`; `null < 0` and `null > 100` are both false)
- a dialog that isn't `persistent` throwing away a half-filled form on a scrim tap
- async race: a slow earlier response (search, geocode) overwriting a later one
- reopening a dialog/form for a different record while its state is set by a `watch` that doesn't fire (same object, or the value didn't change)
- an offline save that reports success but doesn't appear in the list, or an unsynced item that can't be told apart from a synced one
- optional relations read without a guard (`log.dateEnd.toLocaleDateString()`, a log whose location was deleted)

When a finding depends on what a helper or dialog returns or does (`askConfirm`, `showAlert`, `syncOutbox`), read it rather than guess. Confirm the bug actually reaches the screen: e.g. a stray double space in text collapses in HTML and isn't visible.

Only report what you can point to in the code. Prefix these lines with `bug:` so they stand out from guideline findings. When the same bug repeats across several functions (e.g. three loaders without `catch`), report it once and list the other lines, rather than one line each.

## Output format

Group by file. `file:line` (repo-relative, VS Code-clickable). Terse findings, ordered by line. Files with no findings get `✓ pass`. (Lines below are illustrative.)

```text
## src/views/LogsView.vue

src/views/LogsView.vue:40 - bug: load() has no try/catch → failed fetch offline leaves skeleton forever
src/views/LogsView.vue:205 - icon v-btn missing aria-label (tooltip isn't a name)
src/views/LogsView.vue:207 - delete icon uncoloured → color="error"
src/views/LogsView.vue:212 - range uses "to" here, "–" in SearchView → pick one

## src/components/PhotoGallery.vue

src/components/PhotoGallery.vue:168 - delete icon size="16" on photo → tap target <44 px

## src/components/NavBar.vue

✓ pass
```

State issue + location. Add a fix after `→` only when it isn't obvious. No preamble, no summary.

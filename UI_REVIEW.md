# UI review: prioritised findings

Web Interface Guidelines review of every `.vue` file in `src/` (Vue 3 + Vuetify 4), 2026-10-25. Items that repeat across files are grouped, with every location listed.

| Priority | Meaning |
|---|---|
| **P0** | Data is lost, duplicated or saved wrong |
| **P1** | The screen gets stuck, fails silently or shows wrong information, mostly offline |
| **P2** | Accessibility, touch and form usability |
| **P3** | Polish: copy, typography, layout details |

---

## P0: data loss and wrong data

- [x] **End Date is shown but never saved.** `defineModel({ default: new Date() })` displays a date whenever v-model is `undefined`, while `dateEnd` stays `undefined`. Unticking "One Day" without touching the picker saves a one-day log. The default is also created once at module load, so it goes stale in a long-open PWA. Fix: remove the default and have the parent set `dateEnd` when "One Day" is unticked.
  [DatePicker.vue:9](src/components/date-picker/DatePicker.vue#L9) · [AddLogView.vue:185](src/views/add/AddLogView.vue#L185) · [LogView.vue:255](src/views/LogView.vue#L255)
- [x] **Logout leaves unsynced items behind, and they sync into the next account.** `logOut()` clears the SW caches but not the outbox. The original user loses the items, and `syncOutbox()` later posts them under whoever signs in next. Fix: when `pendingItems` isn't empty, `askConfirm` (with `color="warning"` on the trigger), then clear the outbox.
  [BottomBar.vue:53](src/components/BottomBar.vue#L53) · [NavBar.vue:26](src/components/NavBar.vue#L26) · [SettingsView.vue:218](src/views/SettingsView.vue#L218) · `src/scripts/user.ts` `logOut`
- [x] **Terrain import: Retry creates a duplicate location.** If the log insert fails after the new location was created, `addNewLocation` stays `true`.
  [ImportLogsView.vue:324](src/views/add/ImportLogsView.vue#L324)
- [x] **Terrain import: location links fail silently.** `Promise.allSettled` swallows `LogLocation` insert failures, so the row is marked imported with no location linked.
  [ImportLogsView.vue:362](src/views/add/ImportLogsView.vue#L362)
- [x] **CSV import offline throws away the parsed rows.** Every insert fails, then rows and file are cleared, so the CSV has to be picked again. Fix: keep the failed rows and show an offline state.
  [ImportLocationsView.vue:65](src/views/add/ImportLocationsView.vue#L65) (clears at 88–90)
- [x] **Add Activity template can be inserted twice.** The form isn't cleared after adding and the button has no `:loading`.
  [SettingsView.vue:93](src/views/SettingsView.vue#L93) · [SettingsView.vue:265](src/views/SettingsView.vue#L265)
- [x] **Reverse-geocode race saves the wrong city/state.** Drag the pin twice and the earlier response can land last. Fix: ignore stale responses with a request id, as `SearchView` does.
  [AddLocationView.vue:109](src/views/add/AddLocationView.vue#L109)
- [x] **No end-date ≥ start-date check.** A trip of negative length can be saved (Stats clamps it to 0 nights).
  [AddLogView.vue:88](src/views/add/AddLogView.vue#L88) · [LogView.vue:119](src/views/LogView.vue#L119)
- [x] **A location can be saved with a blank name.** `save()` doesn't validate.
  [LocationView.vue:109](src/views/LocationView.vue#L109)

## P1: stuck screens, silent failures, wrong information

### Loaders without `try/catch`

On failure (usually offline) these leave a spinner or skeleton up forever, or show a misleading empty state.

- [x] [LogsView.vue:50](src/views/LogsView.vue#L50): no loading flag either, so "No logs yet." shows while fetching and stays after a failure
- [x] [LocationsView.vue:25](src/views/LocationsView.vue#L25): table shows "No data available"; add `:loading`
- [x] [LocationView.vue:59](src/views/LocationView.vue#L59): skeleton forever (LogView already has an error state to copy)
- [x] [SearchView.vue:98](src/views/SearchView.vue#L98): `loading` stays true, skeleton forever
- [x] [MapView.vue:38](src/views/MapView.vue#L38): empty map, no message
- [x] [StatsView.vue:52](src/views/StatsView.vue#L52): shows "Nights Camped 0"
- [x] [SettingsView.vue:23](src/views/SettingsView.vue#L23): activity templates silently empty
- [x] [AddLogView.vue:60](src/views/add/AddLogView.vue#L60): locations and templates silently empty
- [x] [ImportLogsView.vue:156](src/views/add/ImportLogsView.vue#L156): `loadingEntries` stays true, file input spins forever

### Mutations without `try/catch`

These fail silently, with unhandled rejections.

- [x] Deletes: [LogsView.vue:69](src/views/LogsView.vue#L69) · [LocationsView.vue:64](src/views/LocationsView.vue#L64) · [LocationView.vue:134](src/views/LocationView.vue#L134) (also needs `:loading` on Delete, line 218) · [PhotoGallery.vue:129](src/components/PhotoGallery.vue#L129) · [SettingsView.vue:83](src/views/SettingsView.vue#L83)
- [x] [SettingsView.vue:93](src/views/SettingsView.vue#L93): `addActivity`
- [x] [SettingsView.vue:122](src/views/SettingsView.vue#L122): `updateProfile`'s `fetch` rejects offline, so `savingProfile` never resets and the spinner runs forever. `deactivateAccount` ([133](src/views/SettingsView.vue#L133)) has the same problem. Fix in `src/scripts/user.ts`.

### Other P1 bugs

- [x] **Retry sync does nothing.** `retryPending(id); syncOutbox()` isn't awaited, so the sync reads `pendingItems` before the status flips. Fix: `await retryPending(...)`, then sync.
  [LogsView.vue:194](src/views/LogsView.vue#L194) · [LocationsView.vue:118](src/views/LocationsView.vue#L118)
- [x] **Location search race.** A slow earlier query overwrites newer results, and offline errors aren't caught.
  [LogView.vue:228](src/views/LogView.vue#L228) · [AddLogView.vue:46](src/views/add/AddLogView.vue#L46)
- [x] **Saving a log blanks the page.** `save()` → `load()` sets `loading=true`, so the form becomes a skeleton, scroll jumps to the top and photos reload.
  [LogView.vue:147](src/views/LogView.vue#L147)
- [x] **"Use My Current Location" can spin forever.** `getCurrentPosition` has no `timeout`, and the error doesn't tell "permission denied" apart from "no GPS fix". Fix: `{ timeout, enableHighAccuracy }` and branch on `err.code`.
  [AddLocationView.vue:139](src/views/add/AddLocationView.vue#L139)
- [x] **Export Data offline strands the PWA** on a browser error page with no way back. Check `offline` first.
  [SettingsView.vue:137](src/views/SettingsView.vue#L137)
- [x] **Dates are shown as `MM/dd/yyyy, HH:mm`.** That's vue-datepicker's default: US order for Australian users, with a time nobody needs. Fix: `:enable-time-picker="false"` and `:format="d => d.toLocaleDateString()"`.
  [DatePicker.vue:15](src/components/date-picker/DatePicker.vue#L15)
- [x] **Stats show float errors and no units.** Sums can display like `0.30000000000000004`, and values have no unit ("Hiking 42"). Fix: `Intl.NumberFormat`, plus `42&nbsp;km`.
  [StatsView.vue:29](src/views/StatsView.vue#L29) · [StatsView.vue:48](src/views/StatsView.vue#L48)
- [x] **Unsynced multi-day logs show only a start date.** The pending row doesn't copy `dateEnd`.
  [LogsView.vue:83](src/views/LogsView.vue#L83)
- [x] **A log saved offline doesn't appear on Home.** Recent Logs ignores `pendingItems`.
  [HomeView.vue:134](src/views/HomeView.vue#L134)
- [x] **Offline logs need an already-synced location.** Unsynced (pending) locations can't be picked when adding a log.
  [AddLogView.vue:152](src/views/add/AddLogView.vue#L152)
- [x] **Bottom bar covers content on notched phones.** The height is set by `style`, so the layout reserves only 56 px. Fix: add `env(safe-area-inset-bottom)` padding to `v-main`.
  [BottomBar.vue:9](src/components/BottomBar.vue#L9)
- [x] **Offline banner is cut to one line.** `lines="one"` → "You're offline — showing previously loa…", and the pending/failed counts never show at 360 px.
  [OnlineStatusBanner.vue:36](src/components/OnlineStatusBanner.vue#L36)
- [x] **Map hint is never visible.** It sits inside the 300 px `overflow: hidden` box that LMap fills.
  [LocationView.vue:204](src/views/LocationView.vue#L204) · [AddLocationView.vue:299](src/views/add/AddLocationView.vue#L299)
- [x] **Nicknames hint is never visible.** `hide-details` cancels `persistent-hint`.
  [LocationView.vue:172](src/views/LocationView.vue#L172) · [AddLocationView.vue:258](src/views/add/AddLocationView.vue#L258)

### Error messages that don't explain being offline

- [x] Photo upload "N photos failed to upload": say uploads need a connection, and disable Add Photos while offline. [PhotoGallery.vue:121](src/components/PhotoGallery.vue#L121)
- [x] Geocode "Failed to find address"; Find stays enabled offline. [LocationView.vue:102](src/views/LocationView.vue#L102) · [AddLocationView.vue:102](src/views/add/AddLocationView.vue#L102) · Terrain draft [ImportLogsView.vue:300](src/views/add/ImportLogsView.vue#L300)
- [x] "Failed to update location". [LocationView.vue:119](src/views/LocationView.vue#L119)
- [x] Log load error blames ad blockers. [LogView.vue:198](src/views/LogView.vue#L198)
- [x] Every import failure is reported as "Invalid export file". [SettingsView.vue:171](src/views/SettingsView.vue#L171)
- [x] Terrain row error is always "Failed to import", or "Failed to fetch" offline, because remult errors aren't `Error` instances. [ImportLogsView.vue:370](src/views/add/ImportLogsView.vue#L370)
- [x] Home load errors have no Retry button; copy PhotoGallery's pattern. [HomeView.vue:99](src/views/HomeView.vue#L99) · [HomeView.vue:131](src/views/HomeView.vue#L131)

## P2: accessibility, touch, forms

### Screen readers and keyboard

- [x] Icon-only buttons with no accessible name:
  - PhotoGallery delete [PhotoGallery.vue:164](src/components/PhotoGallery.vue#L164) and lightbox close [PhotoGallery.vue:181](src/components/PhotoGallery.vue#L181)
  - Locations View/Delete [LocationsView.vue:127](src/views/LocationsView.vue#L127), [130](src/views/LocationsView.vue#L130)
  - Back buttons [LogView.vue:219](src/views/LogView.vue#L219) · [LocationView.vue:162](src/views/LocationView.vue#L162)
- [x] The photo thumbnail is a `<div @click>`, so the keyboard can't open it. [PhotoGallery.vue:162](src/components/PhotoGallery.vue#L162)
- [x] Photos have no `alt`. [PhotoGallery.vue:163](src/components/PhotoGallery.vue#L163) · [PhotoGallery.vue:179](src/components/PhotoGallery.vue#L179)
- [x] Marker `<svg>` is missing `aria-hidden="true"`. [LocationView.vue:199](src/views/LocationView.vue#L199) · [MapView.vue:102](src/views/MapView.vue#L102) · [AddLocationView.vue:294](src/views/add/AddLocationView.vue#L294)
- [x] The offline/sync banner isn't a live region; add `role="status"`. [OnlineStatusBanner.vue:31](src/components/OnlineStatusBanner.vue#L31)
- [x] `required` is set on fields that aren't required, so screen readers announce them as required:
  - Notes/Type/Address: [LocationView.vue:174](src/views/LocationView.vue#L174), 176, 181 · [AddLocationView.vue:260](src/views/add/AddLocationView.vue#L260), 262, 275
  - Description/Weather: [AddLogView.vue:149](src/views/add/AddLogView.vue#L149), 172
- [x] Camp type is shown only by colour; the map popup doesn't name it. [MapView.vue:106](src/views/MapView.vue#L106) · [SearchView.vue:142](src/views/SearchView.vue#L142)
- [x] An activity value field is labelled by its unit, so it has no label when the unit is empty. Fix: label with the activity name and show the unit as a suffix. [LogView.vue:289](src/views/LogView.vue#L289) · [AddLogView.vue:224](src/views/add/AddLogView.vue#L224)

### Touch

- [x] Tap targets under 44 px:
  - `size="small"`/`"x-small"` buttons: [OnlineStatusBanner.vue:40](src/components/OnlineStatusBanner.vue#L40) · [PhotoGallery.vue:144](src/components/PhotoGallery.vue#L144), [164](src/components/PhotoGallery.vue#L164) · back buttons [LogView.vue:219](src/views/LogView.vue#L219), [LocationView.vue:162](src/views/LocationView.vue#L162) · [SettingsView.vue:194](src/views/SettingsView.vue#L194) · [ImportLogsView.vue:443](src/views/add/ImportLogsView.vue#L443)
  - `density="compact"` buttons (24 px): [LogsView.vue:193](src/views/LogsView.vue#L193)–206 · [LocationsView.vue:115](src/views/LocationsView.vue#L115)–130 · [SettingsView.vue:249](src/views/SettingsView.vue#L249)
  - `density="compact"` inputs, selects, checkboxes and switches (40 px): [DatePicker.vue:21](src/components/date-picker/DatePicker.vue#L21) · [LogsView.vue:149](src/views/LogsView.vue#L149), 159 · [LogView.vue:249](src/views/LogView.vue#L249), 264 · [AddLogView.vue:177](src/views/add/AddLogView.vue#L177), 193 · [AddLocationView.vue:285](src/views/add/AddLocationView.vue#L285) · [MapView.vue:116](src/views/MapView.vue#L116), 124 · [ImportLogsView.vue:553](src/views/add/ImportLogsView.vue#L553)
  - Compact table rows (36 px): [LocationsView.vue:84](src/views/LocationsView.vue#L84)
- [x] The sync-failure reason is only in a hover tooltip, which never shows on touch. [LogsView.vue:185](src/views/LogsView.vue#L185) · [LocationsView.vue:108](src/views/LocationsView.vue#L108)
- [x] The map legend is always expanded and covers much of the map on phones; make it collapsible. [MapView.vue:115](src/views/MapView.vue#L115)
- [x] Recent campsites and logs on Home aren't links, so tapping one does nothing. [HomeView.vue:103](src/views/HomeView.vue#L103) · [HomeView.vue:135](src/views/HomeView.vue#L135)
- [x] `router.back()` leaves the app when the page was opened directly; use `:to`. [LogView.vue:219](src/views/LogView.vue#L219) · [LocationView.vue:162](src/views/LocationView.vue#L162)

### Forms

- [x] Validation errors only appear in the snackbar, with no inline error and no focus on the first bad field:
  - Forms: [LogView.vue:122](src/views/LogView.vue#L122) · [AddLogView.vue:88](src/views/add/AddLogView.vue#L88) (also: the name isn't trimmed) · [SettingsView.vue:89](src/views/SettingsView.vue#L89)
  - Register: [RegisterView.vue:13](src/views/user/RegisterView.vue#L13). Also show `MIN_PASSWORD_LENGTH` as a hint up front.
- [x] Login and Register submits have no `:loading`, so a double tap sends twice. [LoginView.vue:45](src/views/user/LoginView.vue#L45) · [RegisterView.vue:58](src/views/user/RegisterView.vue#L58)
- [x] No guard for unsaved changes on long forms (`onBeforeRouteLeave`): [AddLogView.vue:137](src/views/add/AddLogView.vue#L137) · [AddLocationView.vue:312](src/views/add/AddLocationView.vue#L312) · [LogView.vue:309](src/views/LogView.vue#L309) · [LocationView.vue:214](src/views/LocationView.vue#L214) · [ImportLogsView.vue:595](src/views/add/ImportLogsView.vue#L595)
- [x] "Start Over" wipes review progress instantly; use `askConfirm` and `color="warning"`. [ImportLogsView.vue:443](src/views/add/ImportLogsView.vue#L443)
- [x] Find shows no progress: it has `:disabled` but no `:loading`. [LocationView.vue:184](src/views/LocationView.vue#L184)
- [x] Add Activity silently does nothing when no activity is selected, and there's no hint pointing to Settings when there are no templates. [LogView.vue:275](src/views/LogView.vue#L275) · [AddLogView.vue:204](src/views/add/AddLogView.vue#L204)

### State in the URL

Put this state in the route query so back and reload keep it:

- [x] Logs: page, search, sort. [LogsView.vue:107](src/views/LogsView.vue#L107)
- [x] Search: query and type filters. Without them, going back from a result clears the search. [SearchView.vue:114](src/views/SearchView.vue#L114)
- [x] Import: tab. [ImportView.vue:6](src/views/add/ImportView.vue#L6)
- [x] Map: filters. [MapView.vue:116](src/views/MapView.vue#L116)
- [x] Locations: page, sort. [LocationsView.vue:84](src/views/LocationsView.vue#L84)
- [x] Settings: open panel. [SettingsView.vue:188](src/views/SettingsView.vue#L188)

### Performance and visibility outdoors

- [x] Photo thumbnails load full-size files (up to 2000 px) on mobile data; add a thumbnail endpoint. [PhotoGallery.vue:163](src/components/PhotoGallery.vue#L163)
- [x] Unbounded `v-for` over CSV rows; paginate it. [ImportLocationsView.vue:128](src/views/add/ImportLocationsView.vue#L128)
- [x] Low-contrast text (small and faded): map hint, 12 px at opacity 0.7 ([LocationView.vue:204](src/views/LocationView.vue#L204), [AddLocationView.vue:299](src/views/add/AddLocationView.vue#L299)); search legend, 13 px at opacity 0.75 ([SearchView.vue:142](src/views/SearchView.vue#L142))

## P3: polish

### Long and empty content

- [ ] Long names are clipped mid-word in a `v-card-title` that doesn't wrap. Fix: a `text-truncate` span with `min-width: 0`.
  [HomeView.vue:63](src/views/HomeView.vue#L63) · [LogsView.vue:175](src/views/LogsView.vue#L175) · [LogView.vue:221](src/views/LogView.vue#L221) · [LocationView.vue:164](src/views/LocationView.vue#L164)
- [ ] The log card subtitle (dates plus location links) is cut to one line on phones. [LogsView.vue:211](src/views/LogsView.vue#L211)
- [ ] The Terrain error chip doesn't wrap and clips long messages. [ImportLogsView.vue:467](src/views/add/ImportLogsView.vue#L467)
- [ ] Empty parts are joined anyway, e.g. "City: , State: …" and ", , Australia". Use `filter(Boolean).join(', ')`. [AddLocationView.vue:308](src/views/add/AddLocationView.vue#L308) · [ImportLogsView.vue:587](src/views/add/ImportLogsView.vue#L587)
- [ ] The Locations Notes column shows the full text; clamp it. [LocationsView.vue:89](src/views/LocationsView.vue#L89)
- [ ] Missing empty states: Locations table, which needs `no-data-text` ([LocationsView.vue:84](src/views/LocationsView.vue#L84)); activity templates ([SettingsView.vue:241](src/views/SettingsView.vue#L241))
- [ ] City/State/Country are in one row that doesn't wrap, ~95 px each at 360 px. [LocationView.vue:208](src/views/LocationView.vue#L208)

### Typography and copy

- [ ] Straight apostrophes and quotes in copy, to replace with ’ “ ”:
  - [OnlineStatusBanner.vue:14](src/components/OnlineStatusBanner.vue#L14) · [PhotoGallery.vue:153](src/components/PhotoGallery.vue#L153)
  - [HomeView.vue:100](src/views/HomeView.vue#L100), 111, 132, 143 · [LogView.vue:198](src/views/LogView.vue#L198) · [SearchView.vue:174](src/views/SearchView.vue#L174)
  - [AddLogView.vue:124](src/views/add/AddLogView.vue#L124) · [AddLocationView.vue:240](src/views/add/AddLocationView.vue#L240) · [ImportLocationsView.vue:105](src/views/add/ImportLocationsView.vue#L105) · [ImportLogsView.vue:547](src/views/add/ImportLogsView.vue#L547)
  - [RegisterView.vue:14](src/views/user/RegisterView.vue#L14)
- [ ] The location list renders "Lake , River" (space before the comma). [LogsView.vue:221](src/views/LogsView.vue#L221)
- [ ] Date ranges use "to" here and "–" in SearchView; pick one. [LogsView.vue:213](src/views/LogsView.vue#L213) · [SearchView.vue:35](src/views/SearchView.vue#L35)
- [ ] `'Loading'` → `'Loading…'`. [SettingsView.vue:26](src/views/SettingsView.vue#L26)
- [ ] Placeholders don't end with `…`. [LogsView.vue:147](src/views/LogsView.vue#L147) · [SettingsView.vue:263](src/views/SettingsView.vue#L263)
- [ ] "12000m" has no space and should probably be km; use `&nbsp;`. [ImportLogsView.vue:123](src/views/add/ImportLogsView.vue#L123) · [ImportLogsView.vue:492](src/views/add/ImportLogsView.vue#L492)
- [ ] "location(s) … entrie(s)": use proper plurals (and "entrie" is a typo). [SettingsView.vue:163](src/views/SettingsView.vue#L163)
- [ ] "Login" and "Sign in with Google" on the same screen; use one term. [LoginView.vue:25](src/views/user/LoginView.vue#L25)
- [ ] "Click the map" → "Tap the map". [AddLocationView.vue:300](src/views/add/AddLocationView.vue#L300)

### Input attributes

- [ ] Add `autocomplete="off"` to "Name" fields, where browsers offer the user's personal name: [LogView.vue:226](src/views/LogView.vue#L226) · [LocationView.vue:169](src/views/LocationView.vue#L169) · [AddLogView.vue:138](src/views/add/AddLogView.vue#L138) · [AddLocationView.vue:255](src/views/add/AddLocationView.vue#L255) · [SettingsView.vue:256](src/views/SettingsView.vue#L256)
- [ ] Add `spellcheck="false"` to email and member number fields: [LoginView.vue:29](src/views/user/LoginView.vue#L29) · [RegisterView.vue:36](src/views/user/RegisterView.vue#L36) · [ImportLogsView.vue:410](src/views/add/ImportLogsView.vue#L410)
- [ ] Add `inputmode="decimal"` to activity values: [LogView.vue:289](src/views/LogView.vue#L289) · [AddLogView.vue:224](src/views/add/AddLogView.vue#L224)
  - Leave latitude/longitude as `type="number"`: the iOS decimal pad has no minus key, so negative coordinates couldn't be typed.

### Misc

- [ ] The Map re-centres on every visit, which discards the user's pan/zoom. [MapView.vue:58](src/views/MapView.vue#L58)
- [ ] Map popups stay white in dark mode while the controls are themed; an empty address leaves a blank line. [MapView.vue:106](src/views/MapView.vue#L106)
- [ ] The snackbar Close button uses CSS `red`, which reads as danger and has weak contrast. [App.vue:35](src/App.vue#L35)
- [ ] Stats: 5 rows per page hides most stats, and the value column has no `tabular-nums`. [StatsView.vue:69](src/views/StatsView.vue#L69)
- [ ] CSV preview shows raw latitude/longitude; use `toFixed(5)` and `tabular-nums`. [ImportLocationsView.vue:130](src/views/add/ImportLocationsView.vue#L130)
- [ ] Imported Terrain rows still have editable date pickers, and the edits are ignored. [ImportLogsView.vue:497](src/views/add/ImportLogsView.vue#L497)

No findings: `ConfirmDialog.vue`.

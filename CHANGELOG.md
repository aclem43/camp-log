# Changelog

## 1.4.0 (2026-10-25)

### Features

* Leaving a page with unsaved changes now asks you to confirm first, and Start Over asks before clearing what you've entered.
* Your searches, filters and current page on Logs, Search, Import, Map, Locations and Settings are now kept when you go back or refresh, and can be bookmarked.
* Logs saved offline can now use a location you also added offline.
* Logs that haven't synced yet now show on the Home page, along with their end date.
* The map legend can now be collapsed.
* Find now shows its progress.

### Bug Fixes

* Fixed the map showing no map tiles on the live site.
* Fixed the map not centring on your locations when they loaded before the map did.
* Fixed the date field showing a date that wasn't actually saved with the log.
* Logs can no longer be saved with an end date before the start date, including from Terrain imports.
* Signing out with unsynced changes now warns you first, and those changes can no longer sync into the next account that signs in on the same device.
* Retrying a Terrain import no longer creates duplicate locations or logs. Rows that fail stay on screen so you can retry or skip them, and failed campsite links are now reported.
* Fixed CSV imports losing the rows they hadn't imported yet when the connection drops. CSV import is now unavailable while offline.
* Fixed forms, including Add Activity, Login and Register, being submitted twice on a double tap. Add Activity now clears after adding.
* Fixed a location's address sometimes being looked up for where the pin used to be after you moved it.
* Locations can no longer be saved without a name.
* Pages that fail to load now show an error with a Retry button, instead of loading forever or wrongly appearing empty.
* Failed saves and deletes now say why they failed, and sync failures show the reason on the page.
* Fixed the page occasionally going blank when saving a log or searching for a location.
* Form errors now show next to the field and jump you to the first problem.
* Dates now show in your local format, and stats are rounded and show their units.
* Export Data, Find and Add Photos now explain why they're unavailable when you're offline.
* Finding your current location now gives up instead of waiting forever, and tells you if location access is blocked.
* The bottom bar no longer sits under the phone's home indicator, and the offline banner no longer gets cut off on narrow screens.
* Hints on the map and nickname fields are now visible, and hint text is easier to read.

### Accessibility

* Buttons and links are easier to tap on phones.
* Screen readers now announce button names, photo descriptions, camp types, activity values with their units, and changes to the sync status.
* Photos can now be opened with the keyboard, and Home page items and Back work as normal links.

### Performance

* Photos uploaded from now on load faster in galleries.
* Previews of large CSV files are now split into pages, so they open faster.

## 1.3.0 (2026-10-25)

### Features

* Camp Log now opens with no signal — you stay signed in and can browse the logs, locations and photos you'd already viewed, instead of getting a blank page.
* Logs saved while offline now keep their activities when they sync.
* Terrain logbook entries can now be linked to more than one campsite when importing.

### Bug Fixes

* Fixed logs occasionally being saved with some of their locations or activities missing if the connection dropped mid-save.
* Importing a data file is now all-or-nothing: if anything in it can't be imported, nothing is, so you can fix the file and try again without ending up with duplicates.
* Exports now include location nicknames and which logs came from Terrain, so they're kept when you import the file again.
* Deleting a log or location now also deletes its photos and activities instead of leaving them behind. Removing an activity type now deletes the values logged for it.
* Fixed changing a multi-day log to a single day not removing its end date.
* Fixed the Confirm Password field on the registration page not being checked.
* The registration page now asks for at least 8 characters up front, instead of accepting shorter passwords that were then rejected.
* Pressing Enter now submits the login and registration forms.
* Fixed a message disappearing early when it appeared right after another one.
* Fixed photos loading forever when they couldn't be loaded — you now get an error and a Retry button.
* When a log fails to save or sync, the message now says why.
* Fixed the site going down entirely after certain bad requests, and pages hanging indefinitely when the database stops responding.

### Security

* Looking up an address now requires being signed in.
* Error messages no longer reveal internal server details.

## 1.2.2 (2026-08-26)

### Bug Fixes

* Fixed the site still forcing HTTPS and failing to load on this deployment even after the previous fix, caused by another security setting that shouldn't have been enabled here.

## 1.2.1 (2026-08-26)

### Bug Fixes

* Fixed the site becoming unreachable with SSL errors on every page after your first visit, caused by a security header that shouldn't have been sent on this deployment.

## 1.2.0 (2026-08-26)

### Features

* Logs can now be edited after creation — update the name, description, weather, dates, locations, and activities instead of having to delete and recreate the whole log.
* A log can now cover more than one location, for trips that span multiple campsites.
* Location editing now lets you drag a pin on the map to set its position, instead of only entering latitude/longitude by hand.
* Added new map base layers — Topographic, Satellite, and Dark — selectable from the map's layer control.
* The Statistics page now shows total nights camped alongside activity totals.
* The "Bush Camp" location type has been merged into "Remote", now labeled "Remote / Bush Camp".
* Photo uploads are now compressed on your device before uploading, making uploads faster on slow connections.
* The Home page's campsite list is now sorted with the most recently added first.
* Deleting a photo or location now uses the app's own confirmation dialog instead of the browser's built-in popup.

### Bug Fixes

* Fixed a crash on the map view for accounts with no located campsites.
* Fixed the map's legend and layer controls not adapting to dark mode.

### Security

* Restored security headers and response compression that had been temporarily disabled.

## 1.1.2 (2026-08-25)

### Bug Fixes

* Fixed the app failing to start after deploying this version with photo uploads enabled.

## 1.1.1 (2026-08-25)

### Bug Fixes

* The mobile menu now includes History, Statistics, Settings, and Logout, matching what's available on desktop.

## 1.1.0 (2026-08-25)

### Features

* Added the ability to import your Scouts Australia Terrain logbook: connect your Terrain account directly (or upload an exported file), review and match each entry to a location one at a time, and pick up where you left off if you stop partway through.
* Added the ability to upload photos to your logs and locations, with a full-size view when you click one.
* Locations can now have nicknames (alternate names), which are used everywhere you search for or link to a location.
* Added a "Non-Campground" location type for places like day activities, plus a map filter to show only campgrounds.
* Added a changelog viewer to Settings so you can see what's changed in each version.
* Clicking a location in search results now opens the map centered on it, instead of going straight to the edit page.
* The log list now has a filter box and sort order (newest, oldest, or name), and shows full descriptions instead of truncating them.
* Simplified the mobile bottom navigation (History and Stats are still available from Home).

### Performance

* The map no longer reloads from scratch every time you navigate back to it.

### Bug Fixes

* Fixed the log detail page crashing if an activity's type had been deleted.
* Fixed the log detail page loading forever if the request failed (e.g. due to an ad blocker) — it now shows an error with a retry option.

## 1.0.5 (2026-08-25)

### Bug Fixes

* Fixed the app version not showing on the Settings page.

## 1.0.4 (2026-08-25)

## 1.0.3 (2026-08-25)

## 1.0.2 (2026-08-25)

## 1.0.1 (2026-08-25)

## 1.0.0 (2026-08-25)

### Features

* Camp Log can now be installed as an app on your phone or computer, and previously viewed logs, locations, and map tiles keep working even without a signal.
* You can now add logs and locations while offline — they'll sync automatically once you're back online, with options to retry or discard anything that fails.
* Added a shortcut button on the Home page to jump straight to adding a log.
* Improved the mobile experience with nicer confirmation dialogs, better fit on notched phones, and smarter keyboard/autofill support on forms.

### Bug Fixes

* Fixed a bug that could cause requests to fail after logging in or registering in production.
* Fixed the offline indicator sometimes showing you as offline when your connection was actually fine (e.g. on VPNs or certain Wi-Fi networks).
* Fixed an error that could prevent locations added while offline from syncing.
* Fixed the Add Log form allowing duplicate submissions, silently failing to save activities, and leaving old data in the form after saving.

## 0.3.0 (2026-08-19)

### Features

* Added account management to Settings: edit your name, choose metric or imperial units, deactivate your account, and log out.
* Added the ability to export and import your data from Settings.
* Made adding a new location easier with GPS detection, a map picker, and reverse geocoding to fill in the address automatically.
* Added an import tool for bringing in locations from a Google My Maps CSV export.
* Added a detail page for each location where you can view and edit it directly from the map.
* Added filtering on the Map view, along with a color legend for camp types.
* Improved the Search page with type filters, broader text matching, and a color legend.
* Added the ability to sign in with Google.
* New accounts now start with a default activity already set up.

### Bug Fixes

* Fixed a typo in the "History" navigation label.
* Fixed the date picker misbehaving when adding a log.
* Fixed location search not filtering properly while typing when adding a log.
* Fixed the confirmation message shown when removing an activity.
* Fixed the app version on the Settings page not loading if the request failed.
* Improved error handling on the Home page so a failed load shows a message instead of failing silently.

### Security

* Restricted access to your campsite, log, and activity data so it can only be viewed or edited by you.

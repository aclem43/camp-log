# Changelog

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

# Changelog

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

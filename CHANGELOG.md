# Changelog

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

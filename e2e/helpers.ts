import type { Page } from '@playwright/test'

// Offline behaviour depends on the service worker: it serves the precached
// app shell and route chunks, and only requests made while it controls the
// page land in its runtime cache. On a fresh browser it's still installing
// for a moment after the first load, so wait until it has taken control
// (it claims open pages as soon as it activates).
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}

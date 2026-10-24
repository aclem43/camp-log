import { expect, test } from '@playwright/test'
import { waitForServiceWorker } from './helpers'

test('the app opens with no connection, signed in and showing previously loaded data', async ({ page, context }) => {
  const email = `e2e-${Date.now()}@example.com`
  const password = 'test1234'
  const locationName = `Cold Start Camp ${Date.now()}`

  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Test User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })

  await page.goto('/add/location')
  await page.getByLabel('Name', { exact: true }).fill(locationName)
  await page.getByRole('button', { name: 'Add Location' }).click()
  await expect(page).toHaveURL(/\/locations$/)
  await expect(page.locator('tr', { hasText: locationName })).toBeVisible()

  // Load the list once more through the service worker, so it's in its cache.
  await waitForServiceWorker(page)
  await page.reload()
  await expect(page.locator('tr', { hasText: locationName })).toBeVisible()

  // The "opening the app at camp" case: a fresh load with no connection at all.
  await context.setOffline(true)
  await page.reload()

  // Still signed in (not bounced to /login), with the list served from the
  // service worker's cache. (No assertion on the offline banner: Chromium
  // reports navigator.onLine as true for a page loaded under Playwright's
  // offline emulation, so the banner's trigger never fires here.)
  await expect(page).toHaveURL(/\/locations$/)
  await expect(page.locator('tr', { hasText: locationName })).toBeVisible()

  await context.setOffline(false)
  // clean up the throwaway account created for this test
  await page.request.post('/api/deactivate-account')
})

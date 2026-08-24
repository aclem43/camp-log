import { expect, test } from '@playwright/test'

test('creating a location while offline queues it and syncs once back online', async ({ page, context }) => {
  const email = `e2e-${Date.now()}@example.com`
  const password = 'test1234'
  const locationName = `Offline Camp ${Date.now()}`

  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Test User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })

  // Open the form while still online, then lose signal before submitting —
  // the realistic "spotty campsite connection" case, not a cold offline load.
  // page.goto() resolving on 'load' doesn't mean the app's async auth check
  // and router guard have finished, so wait for the form to actually be
  // interactive before cutting the network — otherwise going offline can
  // race the in-flight session check and strand the page mid-navigation.
  await page.goto('/add/location')
  const nameField = page.getByLabel('Name')
  await expect(nameField).toBeVisible()

  await context.setOffline(true)

  await nameField.fill(locationName)
  await page.getByRole('button', { name: 'Add Location' }).click()

  await expect(page).toHaveURL(/\/locations$/)
  const row = page.locator('tr', { hasText: locationName })
  await expect(row.getByText('Pending sync')).toBeVisible()

  await context.setOffline(false)
  await expect(row.getByText('Pending sync')).toBeHidden({ timeout: 15_000 })
  await expect(page.locator('tr', { hasText: locationName })).toBeVisible()

  // clean up the throwaway account created for this test
  await page.request.post('/api/deactivate-account')
})

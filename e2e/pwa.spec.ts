import { expect, test } from '@playwright/test'

test('PWA manifest is served with the generated icon set', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()

  const manifest = await response.json()
  expect(manifest.name).toBe('Camp Log')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.length).toBeGreaterThan(0)
})

test('service worker registers and activates', async ({ page }) => {
  await page.goto('/login')

  const active = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator))
      return false
    const registration = await navigator.serviceWorker.ready
    return !!registration.active
  })

  expect(active).toBe(true)
})

test('offline banner appears when connectivity is lost', async ({ page, context }) => {
  await page.goto('/login')
  await expect(page.getByText(/You're offline/)).toBeHidden()

  await context.setOffline(true)
  await expect(page.getByText(/You're offline/)).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText(/You're offline/)).toBeHidden()
})

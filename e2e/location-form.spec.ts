import type { BrowserContext } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { api, createLocation, goOffline, signUp, snackbar, visit } from './helpers'

// The location page's form (shared with Add Location): Find, typed
// coordinates, the map picker and saving offline.

test.use({ serviceWorkers: 'block' })

test.afterEach(async ({ page, context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' })
  await page.request.post('/api/deactivate-account').catch(() => {})
})

// Answers every geocode request with `body`; returns how many were made.
async function mockGeocode(context: BrowserContext, body: Record<string, unknown>) {
  let calls = 0
  await context.route('**/api/geocode', async (route) => {
    calls++
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  return () => calls
}

test('Find keeps place details the geocoder left out, and asks before moving a saved pin', async ({ page, context }) => {
  await signUp(page)
  const location = await createLocation(page, { name: 'Pinned Camp', address: '1 Old Rd', city: 'Canberra', state: 'ACT', country: 'Australia' })
  await mockGeocode(context, { latitude: -33.87, longitude: 151.21, info: { state: 'NSW' } })
  await visit(page, `/location/${location.id}`)

  await page.getByRole('button', { name: 'Find' }).click()
  await page.getByRole('button', { name: 'Keep Pin' }).click()
  await expect(page.getByLabel('Latitude')).toHaveValue('-35.3')
  await expect(page.getByLabel('State')).toHaveValue('ACT')

  await page.getByRole('button', { name: 'Find' }).click()
  await page.getByRole('button', { name: 'Move Pin' }).click()
  await expect(page.getByLabel('Latitude')).toHaveValue('-33.87')
  await expect(page.getByLabel('City')).toHaveValue('Canberra')
  await expect(page.getByLabel('State')).toHaveValue('NSW')

  // The pin is Find's own now, so finding again doesn't ask.
  await page.getByLabel('Address').fill('2 New Rd')
  await page.getByRole('button', { name: 'Find' }).click()
  await expect(page.getByRole('button', { name: 'Find' })).not.toHaveClass(/v-btn--loading/)
  await expect(page.getByRole('button', { name: 'Move Pin' })).toHaveCount(0)
})

test('Enter in the address field runs Find, not Save', async ({ page, context }) => {
  await signUp(page)
  const location = await createLocation(page, { name: 'Enter Camp', latitude: 0, longitude: 0 })
  const calls = await mockGeocode(context, { latitude: -35.28, longitude: 149.13, info: { city: 'Canberra' } })
  await visit(page, `/location/${location.id}`)

  await page.getByLabel('Address').fill('Somewhere')
  await page.getByLabel('Address').press('Enter')
  await expect(page.getByLabel('Latitude')).toHaveValue('-35.28')
  expect(calls()).toBe(1)
  const saved = await api(page, 'GET', `/api/location/${location.id}`)
  expect(saved.address).toBe('')
})

test('a location without a pin can get one from the map', async ({ page, context }) => {
  await signUp(page)
  const location = await createLocation(page, { name: 'No Pin Camp', latitude: 0, longitude: 0 })
  await mockGeocode(context, { address: 'Tapped St', info: { city: 'Tapton' } })
  await visit(page, `/location/${location.id}`)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0)

  await page.getByText('Edit location on map').click()
  await page.locator('.location-map .leaflet-container').click({ position: { x: 100, y: 100 } })
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
  await expect(page.getByLabel('City')).toHaveValue('Tapton')
  await expect(page.getByLabel('Latitude')).not.toHaveValue('0')
})

test('typed coordinates are checked, and clearing both removes the pin', async ({ page }) => {
  await signUp(page)
  const location = await createLocation(page, { name: 'Coord Camp' })
  await visit(page, `/location/${location.id}`)

  await page.getByLabel('Latitude').fill('95')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Enter a latitude between −90 and 90')).toBeVisible()

  await page.getByLabel('Latitude').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Enter a latitude too, or clear both')).toBeVisible()
  expect((await api(page, 'GET', `/api/location/${location.id}`)).latitude).toBe(-35.3)

  await page.getByLabel('Longitude').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(snackbar(page)).toContainText('Location updated')
  const saved = await api(page, 'GET', `/api/location/${location.id}`)
  expect([saved.latitude, saved.longitude]).toEqual([0, 0])
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0)
})

test('Save is disabled offline, with a reason', async ({ page, context }) => {
  await signUp(page)
  const location = await createLocation(page, { name: 'Offline Save Camp' })
  await page.goto(`/location/${location.id}`)
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
  await goOffline(page, context)
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  await expect(page.getByText('Saving changes needs a connection.')).toBeVisible()
})

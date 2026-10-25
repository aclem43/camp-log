import { Buffer } from 'node:buffer'
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { waitForServiceWorker } from './helpers'

// Covers the P0/P1 fixes from UI_REVIEW.md. Failures are simulated with
// context.route() (which also sees service worker requests) or by taking the
// browser offline.

const PASSWORD = 'test1234'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function signUp(page: Page) {
  const baseURL = test.info().project.use.baseURL!
  const email = `e2e-${uid()}@example.com`
  const resp = await page.request.post('/api/auth/sign-up/email', {
    data: { email, password: PASSWORD, name: 'E2E Test User' },
    headers: { Origin: baseURL },
  })
  expect(resp.ok()).toBeTruthy()
  return email
}

// A freshly loaded page sees the pointer at (0, 0) - over the desktop rail
// drawer, which then expands on hover and covers the left of the page.
async function visit(page: Page, path: string) {
  await page.goto(path)
  await page.mouse.move(600, 300)
}

async function api<T = any>(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown): Promise<T> {
  const resp = await page.request.fetch(path, { method, data })
  expect(resp.ok(), `${method} ${path} -> ${resp.status()} ${await resp.text()}`).toBeTruthy()
  return resp.json()
}

function createLocation(page: Page, data: Record<string, unknown>) {
  return api(page, 'POST', '/api/location', { latitude: -35.3, longitude: 149.1, type: 'remote', ...data })
}

async function createLog(page: Page, input: Record<string, unknown>) {
  const result = await api(page, 'POST', '/api/createLog', {
    args: [{ description: '', weather: '', dateStart: new Date().toISOString(), activities: [], ...input }],
  })
  return result.data as number
}

function snackbar(page: Page) {
  return page.locator('.v-snackbar')
}

async function outboxCount(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('camp-log-outbox')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const count = open.result.transaction('pending').objectStore('pending').count()
      count.onsuccess = () => resolve(count.result)
    }
  }))
}

// Network failure as fetch sees it (TypeError: Failed to fetch).
async function failRequests(context: BrowserContext, pattern: string, method?: string) {
  await context.route(pattern, route =>
    !method || route.request().method() === method ? route.abort('internetdisconnected') : route.fallback())
}

async function goOffline(page: Page, context: BrowserContext) {
  await context.setOffline(true)
  await expect(page.getByText('You\'re offline')).toBeVisible({ timeout: 20_000 })
}

test.afterEach(async ({ page, context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' })
  await context.setOffline(false)
  await page.request.post('/api/deactivate-account').catch(() => {})
})

test.describe('online', () => {
  // The SW's runtime cache would answer some failed requests from cache.
  test.use({ serviceWorkers: 'block' })

  test('P0: End Date shown on a new log is the one saved, and dates show without a time', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Date Camp' })
    const name = `Two Day Trip ${uid()}`

    await page.goto('/add/log')
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('Locations').click()
    await page.getByRole('option', { name: 'Date Camp' }).click()
    await page.keyboard.press('Escape')

    const endDate = page.getByLabel('End Date')
    await expect(endDate).toHaveValue(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
    await expect(page.getByLabel('Start Date')).toHaveValue(/^\d{1,2}\/\d{1,2}\/\d{4}$/)

    await page.getByRole('button', { name: 'Add Log' }).click()
    await expect(page).toHaveURL(/\/logs$/)

    const logs = await api(page, 'GET', '/api/log')
    const saved = logs.find((l: any) => l.name === name)
    expect(saved.dateEnd).toBeTruthy()
    expect(new Date(saved.dateStart).getHours()).toBe(0)
  })

  test('P0: ticking then unticking One Day restores an end date', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Toggle Camp' })
    const name = `Toggle Trip ${uid()}`

    await page.goto('/add/log')
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('Locations').click()
    await page.getByRole('option', { name: 'Toggle Camp' }).click()
    await page.keyboard.press('Escape')
    await page.getByLabel('One Day').check()
    await expect(page.getByLabel('End Date')).toBeHidden()
    await page.getByLabel('One Day').uncheck()
    await expect(page.getByLabel('End Date')).toHaveValue(/\d{4}$/)
    await page.getByRole('button', { name: 'Add Log' }).click()
    await expect(page).toHaveURL(/\/logs$/)

    const logs = await api(page, 'GET', '/api/log')
    expect(logs.find((l: any) => l.name === name).dateEnd).toBeTruthy()
  })

  test('P0: an end date before the start date is rejected, in the form and by the server', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Backwards Camp' })

    // Server-side check
    const resp = await page.request.post('/api/createLog', {
      data: { args: [{ name: 'Backwards', description: '', weather: '', dateStart: '2026-05-10T00:00:00.000Z', dateEnd: '2026-05-01T00:00:00.000Z', locationIds: [location.id], activities: [] }] },
    })
    expect(resp.ok()).toBeFalsy()
    expect(await resp.text()).toContain('End date can’t be before the start date')

    // Form check: pick an End Date in the previous month
    await page.goto('/add/log')
    await page.getByLabel('Name', { exact: true }).fill('Backwards Trip')
    await page.getByLabel('Locations').click()
    await page.getByRole('option', { name: 'Backwards Camp' }).click()
    await page.keyboard.press('Escape')
    await page.getByLabel('End Date').click()
    await page.getByRole('button', { name: /previous month/i }).click()
    await page.locator('.dp__calendar_item:not(:has(.dp__cell_offset))').first().click()
    await page.getByRole('button', { name: 'Select' }).click()
    await page.getByRole('button', { name: 'Add Log' }).click()
    await expect(snackbar(page)).toContainText('End Date can’t be before the Start Date')
    await expect(page).toHaveURL(/\/add\/log$/)
  })

  test('P0: Terrain import Retry after a failed location link creates no duplicates', async ({ page, context }) => {
    await signUp(page)
    const terrainId = `t-${uid()}`
    const spot = `Brand New Spot ${uid()}`

    // A dropped connection, not a 500 - remult retries POSTs that 500.
    let failLink = true
    await context.route('**/api/log-location*', (route) => {
      if (failLink && route.request().method() === 'POST') {
        failLink = false
        return route.abort('internetdisconnected')
      }
      return route.fallback()
    })

    await page.goto('/add/import')
    await page.getByRole('tab', { name: 'Logs (Terrain)' }).click()
    await page.locator('input[type=file][accept=".json"]').setInputFiles({
      name: 'terrain.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: [{ id: terrainId, title: 'Terrain Hike', start_date: '2026-01-10T00:00:00Z', end_date: '2026-01-12T00:00:00Z', details: { location: spot } }] })),
    })
    await expect(page.getByText('Entry 1 of 1')).toBeVisible()

    await page.getByRole('button', { name: 'Import & Next' }).click()
    await expect(page.getByText('Log created, but a location couldn’t be linked. Retry to link it.')).toBeVisible()

    await page.getByRole('button', { name: 'Import & Next' }).click()
    await expect(page.getByText(/All entries reviewed/)).toBeVisible()

    const locations = await api(page, 'GET', '/api/location')
    expect(locations.filter((l: any) => l.name === spot)).toHaveLength(1)
    const logs = await api(page, 'GET', '/api/log')
    expect(logs.filter((l: any) => l.terrainId === terrainId)).toHaveLength(1)
    const links = await api(page, 'GET', '/api/log-location')
    expect(links).toHaveLength(1)
  })

  test('P0/P1: Terrain row errors explain being offline', async ({ page, context }) => {
    await signUp(page)
    await failRequests(context, '**/api/log', 'POST')

    await page.goto('/add/import')
    await page.getByRole('tab', { name: 'Logs (Terrain)' }).click()
    await page.locator('input[type=file][accept=".json"]').setInputFiles({
      name: 'terrain.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: [{ id: `t-${uid()}`, title: 'Offline Hike', start_date: '2026-01-10T00:00:00Z' }] })),
    })
    await page.getByRole('button', { name: 'Import & Next' }).click()
    await expect(page.getByText('You’re offline. Retry when you have a connection.')).toBeVisible()
  })

  test('P1: Terrain file import doesn\'t spin forever when loading fails', async ({ page, context }) => {
    await signUp(page)
    await page.goto('/add/import')
    await page.getByRole('tab', { name: 'Logs (Terrain)' }).click()
    await failRequests(context, '**/api/location*')
    await page.locator('input[type=file][accept=".json"]').setInputFiles({
      name: 'terrain.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: [{ id: 'x', title: 'X', start_date: '2026-01-10' }] })),
    })
    await expect(snackbar(page)).toContainText('Failed to load your locations and past imports')
    await expect(page.locator('.v-file-input .v-progress-linear--active')).toHaveCount(0)
  })

  test('P0: CSV import keeps rows when the connection drops, and is disabled offline', async ({ page, context }) => {
    await signUp(page)
    const a = `CSV One ${uid()}`
    const b = `CSV Two ${uid()}`
    await page.goto('/add/import')
    await page.locator('input[type=file][accept=".csv"]').setInputFiles({
      name: 'places.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`WKT,name,description\n"POINT (149.1 -35.3)",${a},\n"POINT (149.2 -35.4)",${b},\n`),
    })
    const importButton = page.getByRole('button', { name: 'Import 2 Locations' })
    await expect(importButton).toBeEnabled()

    await failRequests(context, '**/api/location', 'POST')
    await importButton.click()
    await expect(snackbar(page)).toContainText('Lost connection')
    await expect(page.getByRole('cell', { name: a })).toBeVisible()
    await expect(page.getByRole('cell', { name: b })).toBeVisible()

    await context.unrouteAll()
    await goOffline(page, context)
    await expect(importButton).toBeDisabled()
    await expect(page.getByText('You’re offline. Importing needs a connection')).toBeVisible()

    await context.setOffline(false)
    await expect(importButton).toBeEnabled({ timeout: 20_000 })
    await importButton.click()
    await expect(snackbar(page)).toContainText('Imported 2 locations')
    await expect(page.getByRole('cell', { name: a })).toBeHidden()
    const locations = await api(page, 'GET', '/api/location')
    expect(locations.filter((l: any) => l.name === a || l.name === b)).toHaveLength(2)
  })

  test('P0: Add Activity can\'t insert a template twice, and clears the form', async ({ page }) => {
    await signUp(page)
    await page.goto('/settings')
    await page.getByText('Manage Activities').click()
    const panel = page.locator('.v-expansion-panel', { hasText: 'Manage Activities' })
    await panel.getByLabel('Name', { exact: true }).fill('Hiking')
    await panel.getByLabel('Description', { exact: true }).fill('Distance walked')
    await panel.getByLabel('Units', { exact: true }).fill('km')
    await panel.getByRole('button', { name: 'Add Activity' }).dblclick()
    await expect(snackbar(page)).toContainText('Activity added successfully')
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('')

    const templates = await api(page, 'GET', '/api/activityTemplate')
    expect(templates.filter((t: any) => t.name === 'Hiking')).toHaveLength(1)
  })

  test('P0: a slow reverse-geocode reply for an old pin position is ignored', async ({ page, context }) => {
    await signUp(page)
    let calls = 0
    await context.route('**/api/geocode', async (route) => {
      const call = ++calls
      if (call === 1)
        await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ address: call === 1 ? 'Old St' : 'New St', info: { city: call === 1 ? 'Oldtown' : 'Newtown', state: 'ACT', country: 'Australia' } }),
      })
    })

    await page.goto('/add/location')
    await page.getByText('Edit location on map').click()
    const map = page.locator('.location-map .leaflet-container')
    await map.click({ position: { x: 100, y: 100 } })
    await map.click({ position: { x: 200, y: 150 } })
    await expect(page.getByText(/City: Newtown/)).toBeVisible()
    await page.waitForTimeout(2500) // let the slow first reply land
    await expect(page.getByText(/City: Newtown/)).toBeVisible()
    await expect(page.getByLabel('Address')).toHaveValue('New St')
  })

  test('P0: a location can\'t be saved with a blank name', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Named Camp' })
    await visit(page, `/location/${location.id}`)
    await page.getByLabel('Name', { exact: true }).fill('   ')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(snackbar(page)).toContainText('Please enter a name for the location')
    const saved = await api(page, 'GET', `/api/location/${location.id}`)
    expect(saved.name).toBe('Named Camp')
  })

  // P1 loaders: each screen shows an error with Retry instead of hanging.
  const loaders: { name: string, path: (ids: { log: number, location: number }) => string, block: string, what: string, open?: string }[] = [
    { name: 'Home', path: () => '/', block: '**/api/log*', what: 'your logs' },
    { name: 'Logs', path: () => '/logs', block: '**/api/log*', what: 'your logs' },
    { name: 'Locations', path: () => '/locations', block: '**/api/location*', what: 'your locations' },
    { name: 'Location', path: ids => `/location/${ids.location}`, block: '**/api/location*', what: 'this location' },
    { name: 'Log', path: ids => `/log/${ids.log}`, block: '**/api/log*', what: 'this log' },
    { name: 'Search', path: () => '/search', block: '**/api/log*', what: 'search results' },
    { name: 'Map', path: () => '/map', block: '**/api/location*', what: 'your locations' },
    { name: 'Stats', path: () => '/stats', block: '**/api/activity*', what: 'your statistics' },
    { name: 'Settings', path: () => '/settings', block: '**/api/activityTemplate*', what: 'your activity templates', open: 'Manage Activities' },
    { name: 'Add Log', path: () => '/add/log', block: '**/api/location*', what: 'your locations and activities' },
  ]
  for (const loader of loaders) {
    test(`P1: ${loader.name} shows a retryable error when loading fails`, async ({ page, context }) => {
      await signUp(page)
      const location = await createLocation(page, { name: 'Loader Camp' })
      const log = await createLog(page, { name: 'Loader Log', locationIds: [location.id] })

      await failRequests(context, loader.block, 'GET')
      await page.goto(loader.path({ log, location: location.id }))
      if (loader.open)
        await page.getByText(loader.open).click()
      const error = page.getByText(`Couldn’t load ${loader.what}.`)
      await expect(error).toBeVisible()
      await expect(page.locator('.v-skeleton-loader')).toHaveCount(0)

      await context.unrouteAll()
      await page.getByRole('button', { name: 'Retry' }).click()
      await expect(error).toBeHidden()
    })
  }

  test('P1: Logs shows a loading state, not "No logs yet.", while fetching', async ({ page, context }) => {
    await signUp(page)
    let release!: () => void
    const gate = new Promise<void>(resolve => (release = resolve))
    await context.route('**/api/log*', async (route) => {
      await gate
      await route.fallback()
    })
    await page.goto('/logs')
    await expect(page.locator('.v-skeleton-loader').first()).toBeVisible()
    await expect(page.getByText('No logs yet.')).toBeHidden()
    release()
    await expect(page.getByText('No logs yet.')).toBeVisible()
  })

  test('P1: failed deletes say why instead of failing silently', async ({ page, context }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Delete Camp' })
    await createLog(page, { name: 'Delete Log', locationIds: [location.id] })

    await failRequests(context, '**/api/log/*', 'DELETE')
    await page.goto('/logs')
    await page.getByTitle('Delete').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(snackbar(page)).toContainText('Failed to delete log: you’re offline')
    await expect(page.locator('.v-card-title', { hasText: 'Delete Log' })).toBeVisible()

    await failRequests(context, '**/api/location/*', 'DELETE')
    await page.goto(`/location/${location.id}`)
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(snackbar(page)).toContainText('Failed to delete location: you’re offline')
    await expect(page).toHaveURL(new RegExp(`/location/${location.id}$`))
  })

  test('P1: saving a log keeps the form on screen and doesn\'t reload photos', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Save Camp' })
    const log = await createLog(page, { name: 'Save Log', locationIds: [location.id] })

    let photoLoads = 0
    page.on('request', (req) => {
      if (req.method() === 'GET' && /\/api\/photo\b/.test(req.url()))
        photoLoads++
    })
    await visit(page, `/log/${log}`)
    await expect(page.getByText('No photos yet.')).toBeVisible()
    const before = photoLoads

    await page.getByLabel('Name', { exact: true }).fill('Save Log Renamed')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(snackbar(page)).toContainText('Log updated')
    await expect(page.locator('.v-skeleton-loader')).toHaveCount(0)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Save Log Renamed')
    expect(photoLoads).toBe(before)
  })

  test('P1: a slow location search doesn\'t overwrite newer results', async ({ page, context }) => {
    await signUp(page)
    await createLocation(page, { name: 'Alpha Camp' })
    await createLocation(page, { name: 'Beta Camp' })

    await page.goto('/add/log')
    await expect(page.getByLabel('Locations')).toBeVisible()
    await context.route('**/api/location*', async (route) => {
      if (route.request().url().includes('Alpha'))
        await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fallback()
    })
    const field = page.locator('.v-autocomplete input')
    await field.click()
    await field.pressSequentially('Alpha')
    await page.waitForTimeout(400) // past the debounce
    await field.fill('Beta')
    await expect(page.getByRole('option', { name: 'Beta Camp' })).toBeVisible()
    await page.waitForTimeout(2500) // let the slow "Alpha" reply land
    await expect(page.getByRole('option', { name: 'Beta Camp' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Alpha Camp' })).toBeHidden()
  })

  test('P1: "Use My Current Location" explains a blocked permission', async ({ page }) => {
    await signUp(page)
    await page.goto('/add/location')
    await page.getByRole('button', { name: 'Use My Current Location' }).click()
    await expect(snackbar(page)).toContainText('Location access is blocked')
    await expect(page.getByRole('button', { name: 'Use My Current Location' })).not.toHaveClass(/v-btn--loading/)
  })

  test('P1: "Use My Current Location" places the pin when allowed', async ({ page, context }) => {
    await signUp(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: -35.28, longitude: 149.13 })
    await context.route('**/api/geocode', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ address: 'Here', info: { city: 'Canberra' } }) }))
    await page.goto('/add/location')
    await page.getByRole('button', { name: 'Use My Current Location' }).click()
    await expect(page.getByText('Latitude: -35.28000')).toBeVisible()
    await expect(page.getByText(/City: Canberra/)).toBeVisible()
  })

  test('P1: Export Data downloads online and explains itself offline', async ({ page, context }) => {
    await signUp(page)
    await page.goto('/settings')
    await page.getByText('Data', { exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export Data' }).click()
    expect((await download).suggestedFilename()).toMatch(/^camp-log-export-\d{4}-\d{2}-\d{2}\.json$/)

    await goOffline(page, context)
    await page.getByRole('button', { name: 'Export Data' }).click()
    await expect(snackbar(page)).toContainText('Exporting needs a connection')
    await expect(page).toHaveURL(/\/settings$/)
  })

  test('P1: importing a non-JSON file says so', async ({ page }) => {
    await signUp(page)
    await page.goto('/settings')
    await page.getByText('Data', { exact: true }).click()
    await page.locator('.v-expansion-panel', { hasText: 'Data' }).locator('input[type=file]').setInputFiles({
      name: 'nope.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not json'),
    })
    await page.locator('.v-expansion-panel', { hasText: 'Data' }).getByRole('button', { name: /^Import/ }).click()
    await expect(snackbar(page)).toContainText('isn’t valid JSON')
  })

  test('P1: profile save offline doesn\'t spin forever', async ({ page, context }) => {
    await signUp(page)
    await page.goto('/settings')
    await page.getByText('Account').click()
    await failRequests(context, '**/api/profile')
    const save = page.getByRole('button', { name: 'Save Profile' })
    await save.click()
    await expect(snackbar(page)).toContainText('Failed to update profile: you’re offline')
    await expect(save).not.toHaveClass(/v-btn--loading/)
  })

  test('P1: stats are rounded and show units', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Stats Camp' })
    const template = await api(page, 'POST', '/api/activityTemplate', { name: 'Hiking', description: 'Walked', unit: 'km' })
    await createLog(page, { name: 'Leg 1', locationIds: [location.id], dateStart: '2026-03-01T00:00:00.000Z', dateEnd: '2026-03-03T00:00:00.000Z', activities: [{ templateId: template.id, value: 0.1 }] })
    await createLog(page, { name: 'Leg 2', locationIds: [location.id], activities: [{ templateId: template.id, value: 0.2 }] })

    await page.goto('/stats')
    const hiking = page.getByRole('row', { name: /Hiking/ })
    await expect(hiking).toContainText(/0\.3\s?km/)
    await expect(page.getByText('0.30000000000000004')).toHaveCount(0)
    await expect(page.getByRole('row', { name: /Nights Camped/ })).toContainText('2')
  })

  test('P1: map and nickname hints are visible', async ({ page }) => {
    await signUp(page)
    await page.goto('/add/location')
    await expect(page.getByText('Alternate names to help you find this place later')).toBeVisible()
    const map = await page.locator('.location-map').boundingBox()
    const hint = await page.locator('.map-hint').boundingBox()
    expect(hint!.y).toBeGreaterThanOrEqual(map!.y + map!.height)
  })

  test('P1: Find and Add Photos are disabled offline, with a reason', async ({ page, context }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Offline Find Camp', address: '1 Somewhere Rd' })
    await page.goto(`/location/${location.id}`)
    await expect(page.getByRole('button', { name: 'Find' })).toBeEnabled()
    await goOffline(page, context)
    await expect(page.getByRole('button', { name: 'Find' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Add Photos' })).toBeDisabled()
    await expect(page.getByText('Adding photos needs a connection.')).toBeVisible()
  })

  test('P1: photo upload failures explain needing a connection', async ({ page, context }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Photo Camp' })
    await page.goto(`/location/${location.id}`)
    await expect(page.getByText('No photos yet.')).toBeVisible()
    await failRequests(context, '**/api/photos', 'POST')
    await page.locator('input[type=file][accept="image/*"]').setInputFiles({
      name: 'pic.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    })
    await expect(snackbar(page)).toContainText('uploading needs a connection')
  })
})

test.describe('offline with the service worker', () => {
  test('P0: logging out with unsynced items warns, then clears the outbox', async ({ page, context }) => {
    await signUp(page)
    await page.goto('/add/location')
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await waitForServiceWorker(page)
    await goOffline(page, context)

    await page.getByLabel('Name', { exact: true }).fill(`Unsynced Camp ${uid()}`)
    await page.getByRole('button', { name: 'Add Location' }).click()
    await expect(page).toHaveURL(/\/locations$/)
    expect(await outboxCount(page)).toBe(1)

    // The rail drawer only expands on hover, so click its items directly.
    const logout = page.locator('.v-navigation-drawer .v-list-item', { hasText: 'Logout' })
    await expect(logout).toHaveClass(/text-warning/)
    await logout.dispatchEvent('click')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('1 unsynced item')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/locations$/)
    expect(await outboxCount(page)).toBe(1)

    await logout.dispatchEvent('click')
    await dialog.getByRole('button', { name: 'Log Out Anyway' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await outboxCount(page)).toBe(0)
  })

  test('P1: an offline log can use an unsynced location; both sync, linked', async ({ page, context }) => {
    await signUp(page)
    const camp = `Pending Camp ${uid()}`
    const trip = `Offline Trip ${uid()}`

    await page.goto('/add/location')
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await waitForServiceWorker(page)
    // Visit the log form online once so its route chunk and data are cached.
    await page.goto('/add/log')
    await expect(page.getByLabel('Locations')).toBeVisible()
    await page.goto('/add/location')
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await goOffline(page, context)

    await page.getByLabel('Name', { exact: true }).fill(camp)
    await page.getByRole('button', { name: 'Add Location' }).click()
    await expect(page).toHaveURL(/\/locations$/)

    await page.locator('.v-navigation-drawer a[href="/add/log"]').dispatchEvent('click')
    await expect(page).toHaveURL(/\/add\/log$/)
    await page.getByLabel('Name', { exact: true }).fill(trip)
    await page.getByLabel('Locations').click()
    await page.getByRole('option', { name: `${camp} (not synced yet)` }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add Log' }).click()
    await expect(page).toHaveURL(/\/logs$/)

    // Pending multi-day log shows its end date
    const card = page.locator('.v-card', { hasText: trip })
    await expect(card.getByText('Pending sync')).toBeVisible()
    await expect(card.locator('.v-card-subtitle')).toContainText(' to ')

    // ... and appears on Home
    await page.locator('.v-navigation-drawer a[href="/"]').dispatchEvent('click')
    await expect(page.getByText(trip)).toBeVisible()
    await expect(page.getByText(/Waiting to sync/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/Waiting to sync/)).toBeHidden({ timeout: 20_000 })
    await expect.poll(() => outboxCount(page), { timeout: 20_000 }).toBe(0)

    const locations = await api(page, 'GET', '/api/location')
    const location = locations.find((l: any) => l.name === camp)
    expect(location).toBeTruthy()
    const logs = await api(page, 'GET', '/api/log')
    const log = logs.find((l: any) => l.name === trip)
    expect(log).toBeTruthy()
    const links = await api(page, 'GET', `/api/log-location?log=${log.id}`)
    expect(links.map((l: any) => l.location)).toContain(location.id)
  })

  test('P1: Retry sync re-sends a failed item', async ({ page, context }) => {
    await signUp(page)
    const camp = `Retry Camp ${uid()}`
    await page.goto('/add/location')
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await waitForServiceWorker(page)
    await goOffline(page, context)
    await page.getByLabel('Name', { exact: true }).fill(camp)
    await page.getByRole('button', { name: 'Add Location' }).click()
    await expect(page).toHaveURL(/\/locations$/)

    await context.route('**/api/location', route => route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'nope' }) })
      : route.fallback())
    await context.setOffline(false)
    const row = page.locator('tr', { hasText: camp })
    await expect(row.getByText('Sync failed')).toBeVisible({ timeout: 20_000 })

    await context.unrouteAll()
    await row.getByTitle('Retry sync').click()
    await expect(page.locator('tr', { hasText: camp }).getByText(/Sync failed|Pending sync/)).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('tr', { hasText: camp })).toBeVisible()
  })
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' })

  test('P1: the offline banner wraps instead of cutting off, and v-main clears the bottom bar', async ({ page, context }) => {
    await signUp(page)
    await page.goto('/')
    await expect(page.locator('.v-bottom-navigation')).toBeVisible()
    await expect(page.locator('.v-main')).toHaveClass(/main--bottom-bar/)
    expect(await page.locator('.v-main').evaluate(el => getComputedStyle(el).paddingBottom)).toBe('56px')

    await goOffline(page, context)
    const text = page.locator('.v-banner-text')
    const clamped = await text.evaluate(el => el.scrollHeight > el.clientHeight + 1 || getComputedStyle(el).webkitLineClamp === '1')
    expect(clamped).toBe(false)
  })
})

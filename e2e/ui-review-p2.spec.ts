import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { api, createLocation, createLog, signUp, snackbar, uid, visit } from './helpers'

// Covers the P2 fixes from UI_REVIEW.md: accessibility, touch, forms and
// state kept in the URL.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.use({ serviceWorkers: 'block' })

test.afterEach(async ({ page, context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' })
  await page.request.post('/api/deactivate-account').catch(() => {})
})

test.describe('screen readers and keyboard', () => {
  test('icon-only buttons have names, and Back is a real link', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Named Camp' })
    const log = await createLog(page, { name: 'Named Log', locationIds: [location.id] })

    await visit(page, '/locations')
    await expect(page.getByRole('link', { name: 'View Named Camp' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Named Camp' })).toBeVisible()

    await visit(page, '/logs')
    await expect(page.getByRole('link', { name: 'View Named Log' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Named Log' })).toBeVisible()

    // Opened directly: Back goes to the list rather than out of the app.
    await visit(page, `/log/${log}`)
    await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/logs')
    await visit(page, `/location/${location.id}`)
    await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/locations')

    // Opened from a search: Back returns to that search.
    await visit(page, '/search?q=Named')
    await page.getByRole('link', { name: /Named Log/ }).click()
    await expect(page).toHaveURL(new RegExp(`/log/${log}$`))
    await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/search?q=Named')
  })

  test('photos open from the keyboard, have alt text, and use a thumbnail', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Photo Camp' })
    await visit(page, `/location/${location.id}`)
    await expect(page.getByText('No photos yet.')).toBeVisible()

    const upload = page.waitForResponse(r => r.url().endsWith('/api/photos') && r.request().method() === 'POST')
    const thumbRequest = page.waitForRequest(r => /\/api\/photos\/\d+\/thumb$/.test(r.url()))
    await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'pic.png', mimeType: 'image/png', buffer: PNG })
    const photo = await (await upload).json()
    await page.locator('.photo-grid').scrollIntoViewIfNeeded() // v-img loads lazily
    expect(photo.thumbnailFilename).toMatch(/\.jpg$/)

    const thumb = await page.request.get(`/api/photos/${photo.id}/thumb`)
    expect(thumb.headers()['content-type']).toContain('image/jpeg')
    expect((await thumbRequest).url()).toContain(`/api/photos/${photo.id}/thumb`) // the grid loads the thumbnail

    const open = page.getByRole('button', { name: 'Open pic.png' })
    await open.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByAltText('pic.png')).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('button', { name: 'Delete pic.png' })).toBeVisible()
  })

  test('decorative marker icons are hidden, and the offline banner is a live region', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/location')
    await page.getByText('Edit location on map').click()
    await page.locator('.location-map .leaflet-container').click({ position: { x: 100, y: 100 } })
    // LIcon copies its slot into the real marker, so check every copy.
    await expect(page.locator('.leaflet-marker-icon .location-pin svg')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('.location-pin svg:not([aria-hidden="true"])')).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveCount(1)
  })

  test('optional fields aren\'t announced as required', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/location')
    for (const label of ['Notes', 'Address'])
      await expect(page.getByLabel(label, { exact: true })).not.toHaveAttribute('required')
    await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute('required')

    await visit(page, '/add/log')
    for (const label of ['Description', 'Weather'])
      await expect(page.getByLabel(label, { exact: true })).not.toHaveAttribute('required')
  })

  test('camp type is named in words, not only shown by colour', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Bush Spot', type: 'remote', address: '' })
    await visit(page, '/search?q=Bush')
    await expect(page.getByText('Remote / Bush Camp')).toHaveCount(2) // legend + the result
    await visit(page, '/map')
    // The map centres on the user's locations, even when they load before Leaflet does.
    await expect(page.locator('.leaflet-marker-icon').first()).toBeInViewport()
    await page.locator('.leaflet-marker-icon').first().click()
    const popup = page.locator('.leaflet-popup')
    await expect(popup).toContainText('Remote / Bush Camp')
  })

  test('activity values are labelled by activity, with the unit as a suffix', async ({ page }) => {
    await signUp(page)
    await api(page, 'POST', '/api/activityTemplate', { name: 'Hiking', description: 'Walked', unit: 'km' })
    await visit(page, '/add/log')
    await page.locator('.v-select', { hasText: 'Activity' }).locator('.v-field').click()
    await page.getByRole('option', { name: 'Hiking' }).click()
    await page.getByRole('button', { name: 'Add Activity' }).click()
    const value = page.getByRole('spinbutton', { name: 'Hiking' })
    await expect(value).toBeVisible()
    await expect(page.locator('.v-text-field__suffix', { hasText: 'km' })).toBeVisible()
  })
})

test.describe('touch', () => {
  test('list actions and table rows are at least 44px', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Tap Camp' })
    await createLog(page, { name: 'Tap Log', locationIds: [location.id] })

    await visit(page, '/logs')
    for (const name of ['View Tap Log', 'Delete Tap Log']) {
      const box = await page.getByRole(name.startsWith('View') ? 'link' : 'button', { name }).boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
    const filter = await page.getByRole('textbox', { name: 'Filter' }).boundingBox()
    expect(filter!.height).toBeGreaterThanOrEqual(44)

    await visit(page, '/locations')
    const row = await page.getByRole('row', { name: /Tap Camp/ }).boundingBox()
    expect(row!.height).toBeGreaterThanOrEqual(44)
  })

  test('the map legend collapses on phones', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await signUp(page)
    await visit(page, '/map')
    const toggle = page.getByRole('button', { name: 'Filters & legend' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Only show campgrounds')).toBeHidden()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Only show campgrounds')).toBeVisible()
  })

  test('Home recent campsites and logs are links', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Linked Camp' })
    const log = await createLog(page, { name: 'Linked Log', locationIds: [location.id] })
    await visit(page, '/')
    await page.getByRole('link', { name: /Linked Log/ }).click()
    await expect(page).toHaveURL(new RegExp(`/log/${log}$`))
    await visit(page, '/')
    await page.getByRole('link', { name: /Linked Camp/ }).click()
    await expect(page).toHaveURL(new RegExp(`/location/${location.id}$`))
  })
})

test.describe('forms', () => {
  test('validation errors show inline and focus the first bad field', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/log')
    await page.getByRole('button', { name: 'Add Log' }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Pick at least one location')).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toBeFocused()

    await page.getByLabel('Name', { exact: true }).fill('   ')
    await page.getByRole('button', { name: 'Add Log' }).click()
    await expect(page.getByText('Name is required')).toBeVisible() // whitespace-only doesn't count

    await visit(page, '/settings?panel=activities')
    await page.getByRole('button', { name: 'Add Activity' }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Units are required')).toBeVisible()
  })

  test('Register shows the password rule up front and checks it inline', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText('At least 8 characters')).toBeVisible()
    await page.getByLabel('Name').fill('Someone')
    await page.getByLabel('Email').fill(`e2e-${uid()}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm Password', { exact: true }).fill('different')
    await page.getByRole('button', { name: 'Register' }).click()
    await expect(page.getByText('Use at least 8 characters')).toBeVisible()
    await expect(page.getByText('Passwords don’t match')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('Login shows progress while signing in', async ({ page, context }) => {
    let release!: () => void
    const gate = new Promise<void>(resolve => (release = resolve))
    await context.route('**/api/auth/sign-in/email', async (route) => {
      await gate
      await route.fallback()
    })
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrong-password')
    const button = page.getByRole('button', { name: 'Sign In', exact: true })
    await button.click()
    await expect(button).toHaveClass(/v-btn--loading/)
    release()
    await expect(button).not.toHaveClass(/v-btn--loading/)
  })

  test('leaving a form with unsaved changes asks first', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/log')
    await page.getByLabel('Name', { exact: true }).fill('Half-written trip')
    await page.locator('.v-navigation-drawer a[href="/"]').dispatchEvent('click')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('unsaved changes')
    await dialog.getByRole('button', { name: 'Keep Editing' }).click()
    await expect(page).toHaveURL(/\/add\/log$/)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Half-written trip')

    await page.locator('.v-navigation-drawer a[href="/"]').dispatchEvent('click')
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('an edited log only asks when there are real changes', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Guard Camp' })
    const log = await createLog(page, { name: 'Guard Log', locationIds: [location.id] })
    await visit(page, `/log/${log}`)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Guard Log')

    // Untouched: leaves without asking
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/logs$/)

    // Edited and saved: leaves without asking
    await visit(page, `/log/${log}`)
    await page.getByLabel('Name', { exact: true }).fill('Guard Log 2')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(snackbar(page)).toContainText('Log updated')
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/logs$/)

    // Edited, not saved: asks
    await visit(page, `/log/${log}`)
    await page.getByLabel('Name', { exact: true }).fill('Guard Log 3')
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page.getByRole('dialog')).toContainText('unsaved changes')
  })

  test('Start Over asks before throwing away review progress', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/import?tab=logs')
    await page.locator('input[type=file][accept=".json"]').setInputFiles({
      name: 'terrain.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: [{ id: `t-${uid()}`, title: 'Hike', start_date: '2026-01-10T00:00:00Z' }] })),
    })
    await expect(page.getByText('Entry 1 of 1')).toBeVisible()
    const startOver = page.getByRole('main').getByRole('button', { name: 'Start Over' })
    await startOver.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('1 remaining entry')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Entry 1 of 1')).toBeVisible()
    await startOver.click()
    await dialog.getByRole('button', { name: 'Start Over' }).click()
    await expect(page.getByText('Entry 1 of 1')).toBeHidden()
  })

  test('Find shows progress', async ({ page, context }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Find Camp', address: '1 Main St' })
    let release!: () => void
    const gate = new Promise<void>(resolve => (release = resolve))
    await context.route('**/api/geocode', async (route) => {
      await gate
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ latitude: -35, longitude: 149, info: {} }) })
    })
    await visit(page, `/location/${location.id}`)
    const find = page.getByRole('button', { name: 'Find' })
    await find.click()
    await expect(find).toHaveClass(/v-btn--loading/)
    release()
    await expect(find).not.toHaveClass(/v-btn--loading/)
  })

  test('Add Activity needs a selection, and points to Settings when there are no activity types', async ({ page }) => {
    await signUp(page)
    // New accounts start with default activity types - remove them.
    for (const template of await api(page, 'GET', '/api/activityTemplate'))
      await api(page, 'DELETE', `/api/activityTemplate/${template.id}`)
    await visit(page, '/add/log')
    await expect(page.getByRole('button', { name: 'Add Activity' })).toBeDisabled()
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings\?panel=activities$/)
    await expect(page.getByText('Current Activity Templates')).toBeVisible()
  })
})

test.describe('state in the URL', () => {
  test('Logs keeps its filter, sort and page across reloads', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'URL Camp' })
    for (let i = 1; i <= 7; i++)
      await createLog(page, { name: `Trip ${i}`, locationIds: [location.id] })

    await visit(page, '/logs')
    await page.locator('.v-select', { hasText: 'Sort by' }).locator('.v-field').click()
    await page.getByRole('option', { name: 'Name (A-Z)' }).click()
    await page.getByRole('button', { name: 'Page 2' }).click()
    await expect(page).toHaveURL(/sort=name/)
    await expect(page).toHaveURL(/page=2/)
    await page.reload()
    await expect(page.getByText('Trip 6')).toBeVisible()
    await expect(page.getByText('Trip 1', { exact: true })).toBeHidden()

    await page.getByRole('textbox', { name: 'Filter' }).fill('Trip 3')
    await expect(page).toHaveURL(/q=Trip(\+|%20)3/)
    await expect(page).not.toHaveURL(/page=2/) // a new filter starts from page 1
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Filter' })).toHaveValue('Trip 3')
  })

  test('going back from a search result keeps the search', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Searchable Camp' })
    await visit(page, '/search')
    await page.getByRole('textbox', { name: 'Search' }).fill('Searchable')
    await expect(page.getByRole('link', { name: /Searchable Camp/ })).toBeVisible()
    await page.getByRole('link', { name: /Searchable Camp/ }).click()
    await expect(page).toHaveURL(/\/map/)
    await page.goBack()
    await expect(page.getByRole('textbox', { name: 'Search' })).toHaveValue('Searchable')
    await expect(page.getByRole('link', { name: /Searchable Camp/ })).toBeVisible()
  })

  test('Import tab, Map filters, Locations sort and Settings panel survive a reload', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Alpha' })
    await createLocation(page, { name: 'Zulu' })

    await visit(page, '/add/import')
    await page.getByRole('tab', { name: 'Logs (Terrain)' }).click()
    await expect(page).toHaveURL(/tab=logs/)
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Logs (Terrain)' })).toHaveAttribute('aria-selected', 'true')

    await visit(page, '/map')
    await page.getByLabel('Only show campgrounds').check()
    await expect(page).toHaveURL(/campgrounds=1/)
    await page.reload()
    await expect(page.getByLabel('Only show campgrounds')).toBeChecked()

    await visit(page, '/locations')
    await page.getByRole('columnheader', { name: 'Name', exact: true }).click()
    await expect(page).toHaveURL(/sort=name(%3A|:)desc/)
    await page.reload()
    await expect(page.getByRole('row').nth(1)).toContainText('Zulu')

    await visit(page, '/settings')
    await page.getByText('Data', { exact: true }).click()
    await expect(page).toHaveURL(/panel=data/)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Export Data' })).toBeVisible()
  })
})

test.describe('performance and visibility', () => {
  test('a long CSV preview is paginated', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/import')
    const lines = Array.from({ length: 25 }, (_, i) => `"POINT (149.${i} -35.3)",Row ${i},`)
    await page.locator('input[type=file][accept=".csv"]').setInputFiles({
      name: 'big.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`WKT,name,description\n${lines.join('\n')}\n`),
    })
    await expect(page.getByText('25 of 25 rows ready to import.')).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(10)
  })

  test('map hint and search legend text is 14px and near full strength', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/location')
    const hint = await page.locator('.map-hint').evaluate(el => ({ size: getComputedStyle(el).fontSize, opacity: Number(getComputedStyle(el).opacity) }))
    expect(hint.size).toBe('14px')
    expect(hint.opacity).toBeGreaterThanOrEqual(0.87)
    await visit(page, '/search')
    const legend = await page.locator('.search-legend').evaluate(el => getComputedStyle(el).fontSize)
    expect(legend).toBe('14px')
  })
})

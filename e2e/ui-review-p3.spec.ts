import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { api, createLocation, createLog, signUp, snackbar, uid, visit } from './helpers'

// Covers the P3 fixes from UI_REVIEW.md: long and empty content, copy and
// typography, input attributes, and the map keeping its view.

test.use({ serviceWorkers: 'block' })

test.afterEach(async ({ page, context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' })
  await page.request.post('/api/deactivate-account').catch(() => {})
})

test.describe('long and empty content', () => {
  test('a long log name truncates, and the subtitle wraps instead of clipping', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await signUp(page)
    const alpha = await createLocation(page, { name: 'Alpha Camp With A Long Name' })
    const beta = await createLocation(page, { name: 'Beta Camp With A Long Name' })
    const name = 'A very long log name that keeps going well past the edge of a phone screen'
    await createLog(page, { name, locationIds: [alpha.id, beta.id], dateStart: '2026-03-01T00:00:00Z', dateEnd: '2026-03-04T00:00:00Z' })

    await visit(page, '/logs')
    const card = page.locator('.v-card', { hasText: 'Alpha Camp' })
    const title = card.locator('.v-card-title .text-truncate')
    await expect(title).toHaveText(name)
    expect(await title.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await title.evaluate(el => getComputedStyle(el).textOverflow)).toBe('ellipsis')

    const subtitle = card.locator('.v-card-subtitle')
    await expect(subtitle).toContainText('–')
    await expect(subtitle).not.toContainText(' to ')
    expect(await subtitle.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

    // "Alpha, Beta" - no space before the comma.
    const links = subtitle.getByRole('link')
    expect(await links.first().evaluate(a => a.textContent)).toBe('Alpha Camp With A Long Name')
    const separators = await subtitle.locator('.log-location').evaluateAll(spans =>
      spans.map(span => getComputedStyle(span, '::after').content))
    expect(separators).toEqual(['", "', 'none'])
  })

  test('empty Locations table and activity templates say so', async ({ page }) => {
    await signUp(page)
    await visit(page, '/locations')
    await expect(page.getByText('No locations yet. Add one to see it here.')).toBeVisible()
    // New accounts start with a template; remove it.
    for (const template of await api(page, 'GET', '/api/activityTemplate'))
      await api(page, 'DELETE', `/api/activityTemplate/${template.id}`)
    await visit(page, '/settings?panel=activities')
    await expect(page.getByText(/No activity templates yet/)).toBeVisible()
  })

  test('Locations notes are clamped to two lines', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Wordy Camp', notes: 'Lots to say about this place. '.repeat(30) })
    await visit(page, '/locations')
    const notes = page.locator('.notes-clamp')
    const lineHeight = await notes.evaluate(el => Number.parseFloat(getComputedStyle(el).lineHeight))
    const box = await notes.boundingBox()
    expect(box!.height).toBeLessThanOrEqual(lineHeight * 2 + 1)
  })

  test('City, State and Country wrap on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await signUp(page)
    const location = await createLocation(page, { name: 'Place Camp', city: 'Canberra', state: 'ACT', country: 'Australia' })
    await visit(page, `/location/${location.id}`)
    for (const label of ['City', 'State', 'Country']) {
      const box = await page.getByRole('textbox', { name: label }).boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(140)
    }
  })
})

test.describe('copy and typography', () => {
  test('Settings import reports proper plurals', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Export Camp' })
    const exported = await page.request.get('/api/export-data')
    expect(exported.ok()).toBeTruthy()

    await visit(page, '/settings?panel=data')
    await page.locator('input[type=file][accept="application/json"]').setInputFiles({
      name: 'export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(await exported.body()),
    })
    await page.getByRole('button', { name: 'Import Data' }).click()
    // New accounts start with an activity template, so the count isn't fixed.
    await expect(snackbar(page)).toContainText(/Imported 1 location, \d+ activity templates?, 0 logs and 0 activity entries/)
    await expect(snackbar(page)).not.toContainText('(s)')
  })

  test('the add-location map hint says tap, not click', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/location')
    await page.getByLabel('Edit location on map').check()
    await expect(page.getByText('Tap the map or drag the pin to fine-tune the location')).toBeVisible()
  })

  test('Terrain distances are in km, and imported rows can\'t have their dates edited', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/import')
    await page.getByRole('tab', { name: 'Logs (Terrain)' }).click()
    await page.locator('input[type=file][accept=".json"]').setInputFiles({
      name: 'terrain.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: [
        { id: `t-${uid()}`, title: 'First Hike', start_date: '2026-01-10T00:00:00Z', distance_travelled: 12000 },
        { id: `t-${uid()}`, title: 'Second Hike', start_date: '2026-01-11T00:00:00Z' },
      ] })),
    })
    await expect(page.getByText('Entry 1 of 2')).toBeVisible()
    await expect(page.getByText(/12\skm travelled/)).toBeVisible()
    await page.getByRole('button', { name: 'Import & Next' }).click()
    await expect(page.getByText('Entry 2 of 2')).toBeVisible()

    // Not imported yet: the picker opens.
    await page.getByRole('textbox', { name: 'Start Date' }).click()
    await expect(page.locator('.dp__menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dp__menu')).toHaveCount(0)

    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByText('Entry 1 of 2')).toBeVisible()
    await page.getByRole('textbox', { name: 'Start Date' }).click()
    await expect(page.locator('.dp__menu')).toHaveCount(0)
  })

  test('the CSV preview rounds coordinates', async ({ page }) => {
    await signUp(page)
    await visit(page, '/add/import')
    await page.locator('input[type=file][accept=".csv"]').setInputFiles({
      name: 'places.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('WKT,name,description\n"POINT (149.123456789 -35.3)",Coord Camp,\n'),
    })
    const row = page.getByRole('row', { name: /Coord Camp/ })
    await expect(row).toContainText('-35.30000')
    await expect(row).toContainText('149.12346')
  })

  test('Stats shows every statistic on one page', async ({ page }) => {
    await signUp(page)
    const location = await createLocation(page, { name: 'Stats Camp' })
    const templates = []
    for (let i = 1; i <= 6; i++)
      templates.push(await api(page, 'POST', '/api/activityTemplate', { name: `Stat ${i}`, description: 'x', unit: 'km' }))
    await createLog(page, { name: 'Busy Log', locationIds: [location.id], activities: templates.map(t => ({ templateId: t.id, value: 1 })) })

    await visit(page, '/stats')
    await expect(page.locator('tbody tr')).toHaveCount(7) // Nights Camped plus six activities
    await expect(page.locator('.v-data-table-footer')).toHaveCount(0)
  })
})

test.describe('input attributes', () => {
  test('name, email and activity value fields get the right keyboard hints', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('spellcheck', 'false')

    await signUp(page)
    await api(page, 'POST', '/api/activityTemplate', { name: 'Paddling', description: 'x', unit: 'km' })
    await visit(page, '/add/log')
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('autocomplete', 'off')
    await page.locator('.v-select', { hasText: 'Activity' }).locator('.v-field').click()
    await page.getByRole('option', { name: 'Paddling' }).click()
    await page.getByRole('button', { name: 'Add Activity' }).click()
    await expect(page.getByRole('spinbutton', { name: 'Paddling' })).toHaveAttribute('inputmode', 'decimal')

    await visit(page, '/add/location')
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('autocomplete', 'off')
  })
})

test.describe('map', () => {
  test('coming back to the map keeps where the user panned it', async ({ page }) => {
    await signUp(page)
    await createLocation(page, { name: 'Pan Camp' })
    await visit(page, '/')
    const nav = page.locator('.v-navigation-drawer')
    await nav.getByRole('link', { name: 'Map' }).click()
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible()

    const pane = page.locator('.leaflet-map-pane')
    const box = (await page.locator('.leaflet-container').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 100, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500) // let the drag's inertia settle
    const panned = await pane.evaluate(el => el.style.transform)

    await nav.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/logs$/)
    const reloaded = page.waitForResponse(r => r.url().includes('/api/log-location'))
    await page.goBack()
    await reloaded
    await page.waitForTimeout(500) // any re-centring pans with an animation
    expect(await pane.evaluate(el => el.style.transform)).toBe(panned)
  })
})

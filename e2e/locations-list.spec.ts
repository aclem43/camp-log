import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { createLocation, createLog, signUp, visit } from './helpers'

// The Locations list: filtering, what each card shows, and sorting by visits.

test.use({ serviceWorkers: 'block' })

test.afterEach(async ({ page }) => {
  await page.request.post('/api/deactivate-account').catch(() => {})
})

function card(page: Page, name: string) {
  return page.locator('.v-card', { has: page.getByText(name, { exact: true }) })
}

test('cards show type, place, nicknames, visits and a missing pin', async ({ page }) => {
  await signUp(page)
  const pinned = await createLocation(page, { name: 'Pinned Camp', type: 'remote', city: 'Canberra', state: 'ACT', nicknames: 'PC, The Spot' })
  await createLocation(page, { name: 'Pinless Camp', latitude: 0, longitude: 0 })
  await createLog(page, { name: 'Trip 1', locationIds: [pinned.id], dateStart: '2026-03-01T00:00:00.000Z' })
  await createLog(page, { name: 'Trip 2', locationIds: [pinned.id], dateStart: '2026-05-01T00:00:00.000Z' })
  await visit(page, '/locations')

  const pinnedCard = card(page, 'Pinned Camp')
  await expect(pinnedCard).toContainText('Remote / Bush Camp')
  await expect(pinnedCard).toContainText('Canberra, ACT')
  await expect(pinnedCard).toContainText('2 visits · last')
  await expect(pinnedCard.locator('.v-chip', { hasText: 'The Spot' })).toBeVisible()
  await expect(pinnedCard.getByText('No pin')).toHaveCount(0)
  await expect(pinnedCard.getByRole('link', { name: 'Show Pinned Camp on map' }))
    .toHaveAttribute('href', `/map?location=${pinned.id}`)

  const pinlessCard = card(page, 'Pinless Camp')
  await expect(pinlessCard).toContainText('No visits yet')
  await expect(pinlessCard.getByText('No pin')).toBeVisible()
  await expect(pinlessCard.getByRole('link', { name: /on map/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'Pinned Camp', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/location/${pinned.id}$`))
})

test('the filter matches nicknames and places, and says when nothing matches', async ({ page }) => {
  await signUp(page)
  await createLocation(page, { name: 'Alpha Camp', nicknames: 'Scout HQ' })
  await createLocation(page, { name: 'Beta Camp', city: 'Hobart' })
  await visit(page, '/locations')

  const filter = page.getByRole('textbox', { name: 'Filter' })
  await filter.fill('scout')
  await expect(card(page, 'Alpha Camp')).toBeVisible()
  await expect(card(page, 'Beta Camp')).toHaveCount(0)
  await expect(page).toHaveURL(/q=scout/)

  await filter.fill('hobart')
  await expect(card(page, 'Beta Camp')).toBeVisible()
  await expect(card(page, 'Alpha Camp')).toHaveCount(0)

  await filter.fill('nowhere')
  await expect(page.getByText('No locations match your filter.')).toBeVisible()
})

test('sorts by most visited, and pages past 10 locations', async ({ page }) => {
  await signUp(page)
  const busy = await createLocation(page, { name: 'Zulu Busy' })
  for (let i = 0; i < 10; i++)
    await createLocation(page, { name: `Camp ${String(i).padStart(2, '0')}` })
  await createLog(page, { name: 'Busy Trip', locationIds: [busy.id] })
  await visit(page, '/locations')

  await expect(page.locator('.v-card')).toHaveCount(10)
  await expect(page.getByRole('navigation', { name: /pagination/i })).toBeVisible()

  await page.locator('.v-select', { hasText: 'Sort by' }).locator('.v-field').click()
  await page.getByRole('option', { name: 'Most visited' }).click()
  await expect(page.locator('.v-card').first()).toContainText('Zulu Busy')
})

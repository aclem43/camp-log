import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// Offline behaviour depends on the service worker: it serves the precached
// app shell and route chunks, and only requests made while it controls the
// page land in its runtime cache. On a fresh browser it's still installing
// for a moment after the first load, so wait until it has taken control
// (it claims open pages as soon as it activates).
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}

// Shared by the UI review specs (ui-review*.spec.ts).

export const PASSWORD = 'test1234'

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function signUp(page: Page) {
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
export async function visit(page: Page, path: string) {
  await page.goto(path)
  await page.mouse.move(600, 300)
}

export async function api<T = any>(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown): Promise<T> {
  const resp = await page.request.fetch(path, { method, data })
  const text = await resp.text()
  expect(resp.ok(), `${method} ${path} -> ${resp.status()} ${text}`).toBeTruthy()
  return text ? JSON.parse(text) : undefined
}

export function createLocation(page: Page, data: Record<string, unknown>) {
  return api(page, 'POST', '/api/location', { latitude: -35.3, longitude: 149.1, type: 'remote', ...data })
}

export async function createLog(page: Page, input: Record<string, unknown>) {
  const result = await api(page, 'POST', '/api/createLog', {
    args: [{ description: '', weather: '', dateStart: new Date().toISOString(), activities: [], ...input }],
  })
  return result.data as number
}

export function snackbar(page: Page) {
  return page.locator('.v-snackbar')
}

export async function outboxCount(page: Page) {
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
export async function failRequests(context: BrowserContext, pattern: string, method?: string) {
  await context.route(pattern, route =>
    !method || route.request().method() === method ? route.abort('internetdisconnected') : route.fallback())
}

export async function goOffline(page: Page, context: BrowserContext) {
  await context.setOffline(true)
  await expect(page.getByRole('status').getByText('You’re offline')).toBeVisible({ timeout: 20_000 })
}

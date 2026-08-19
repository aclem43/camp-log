import { expect, test } from '@playwright/test'

test('unauthenticated visitors are redirected to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('.v-card-title')).toHaveText('Login')
})

test('login page has working email/password fields and a link to register', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()

  await page.getByRole('link', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.locator('.v-card-title')).toHaveText('Register')
})

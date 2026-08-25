// Phase 1 of the Terrain logbook import: opens a real (headed) Chromium window
// against your actual Terrain account, lets you log in and navigate by hand,
// then dumps the rendered HTML + a screenshot of whatever pages you're on so
// we can figure out the real field structure before writing the scraper.
//
// Nothing here sends your credentials or session anywhere except Terrain
// itself. The browser profile is saved locally (gitignored) so you don't have
// to log in again for the next phase.
//
// This runs non-interactively (no stdin available), so instead of "press
// Enter", it waits for signal files to appear in output/. Create them with
// e.g. `touch scripts/terrain-import/output/.signal-list` once you're ready
// for that step to be captured.
//
// Usage: node scripts/terrain-import/discover.mjs

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'output')
const profileDir = path.join(__dirname, '.browser-profile')

const LOGBOOK_URL = 'https://terrain.scouts.com.au/logbook'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForSignal(signalName) {
  const signalPath = path.join(outDir, signalName)
  console.log(`  (waiting for signal file: ${path.relative(process.cwd(), signalPath)})`)
  while (!existsSync(signalPath)) {
    await sleep(1000)
  }
  await rm(signalPath, { force: true })
}

async function dumpPage(page, name) {
  const html = await page.content()
  await writeFile(path.join(outDir, `${name}.html`), html, 'utf8')
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true })
  console.log(`  saved ${name}.html + ${name}.png  (url: ${page.url()})`)
}

async function main() {
  await mkdir(outDir, { recursive: true })

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1400, height: 1000 },
  })
  const page = context.pages()[0] ?? (await context.newPage())

  console.log(`\nOpening ${LOGBOOK_URL} ...`)
  await page.goto(LOGBOOK_URL).catch(() => {})

  console.log(`
Log in to Terrain in the browser window, and navigate to the page that
lists your logbook entries (all ~60 of them).
`)
  await waitForSignal('.signal-list')
  await dumpPage(page, 'logbook-list')

  console.log(`
Now click into ONE individual logbook entry so its full details are visible.
`)
  await waitForSignal('.signal-entry')
  await dumpPage(page, 'logbook-entry-sample')

  console.log(`
Done capturing. Waiting for shutdown signal before closing the browser
(so you can keep poking around if useful).
`)
  await waitForSignal('.signal-done')

  await context.close()
  console.log('Browser closed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Phase 2: the real scrape. Reuses the browser profile from discover.mjs
// (must already be logged in - run discover.mjs first if the session has
// expired), opens the logbook page just long enough to capture a live
// Authorization bearer token from the app's own API call, then fetches the
// full logbook list + every individual entry directly over HTTP using that
// token. Much faster and more reliable than clicking through ~60 entries in
// the UI.
//
// Output: scripts/terrain-import/output/terrain-export.json
//   { memberId, scrapedAt, entries: [ <full logbook record>, ... ] }
//
// Usage: node scripts/terrain-import/scrape.mjs

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'output')
const profileDir = path.join(__dirname, '.browser-profile')

const LOGBOOK_URL = 'https://terrain.scouts.com.au/logbook'
const LOGBOOK_LIST_RE = /achievements\.terrain\.scouts\.com\.au\/members\/([a-f0-9-]+)\/logbook$/

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  await mkdir(outDir, { recursive: true })

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
  })
  const page = context.pages()[0] ?? (await context.newPage())

  let authHeader = null
  let memberId = null
  let listBody = null

  page.on('response', async (response) => {
    const url = response.url()
    const match = LOGBOOK_LIST_RE.exec(url)
    if (!match)
      return
    memberId = match[1]
    authHeader = response.request().headers().authorization ?? null
    try {
      listBody = await response.json()
    }
    catch {
      // ignore - we'll error out below if listBody stays null
    }
  })

  console.log(`Opening ${LOGBOOK_URL} to capture an auth token...`)
  await page.goto(LOGBOOK_URL, { waitUntil: 'networkidle' })

  // Give the app's own calls a moment to fire even if networkidle raced them.
  for (let i = 0; i < 10; i++) {
    if (authHeader)
      break
    await sleep(500)
  }

  await context.close()

  if (!authHeader || !memberId || !listBody) {
    console.error(`
Could not capture an authenticated API call. Most likely your login session
has expired. Run:
    node scripts/terrain-import/discover.mjs
and log in again, then re-run this script.
`)
    process.exit(1)
  }

  const results = listBody.results ?? []
  console.log(`Captured auth token for member ${memberId}. Found ${results.length} logbook entries.`)

  const headers = {
    authorization: authHeader,
    accept: 'application/json',
  }

  const entries = []
  for (const [i, summary] of results.entries()) {
    const url = `https://achievements.terrain.scouts.com.au/members/${memberId}/logbook/${summary.id}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.error(`  [${i + 1}/${results.length}] FAILED ${res.status} - ${summary.title}`)
      continue
    }
    const detail = await res.json()
    entries.push(detail)
    console.log(`  [${i + 1}/${results.length}] ${summary.title}`)
    await sleep(150) // be polite to their API
  }

  const output = {
    memberId,
    scrapedAt: new Date().toISOString(),
    entries,
  }
  const outPath = path.join(outDir, 'terrain-export.json')
  await writeFile(outPath, JSON.stringify(output, null, 2), 'utf8')
  console.log(`\nSaved ${entries.length} entries to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

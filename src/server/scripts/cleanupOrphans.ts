/* eslint-disable no-console */
import process from 'node:process'
import { withRemult } from 'remult'
import { initAsyncHooks } from 'remult/async-hooks'
import { Activity } from '../../shared/models/Activity'
import { LogLocation } from '../../shared/models/LogLocation'
import { Photo } from '../../shared/models/Photo'
import { dataProvider } from '../db/dataProvider'
import { pool } from '../db/pool'
import '../photoStorage'

// One-off cleanup for rows left behind before deletes cascaded (see the
// `deleting` hooks on Log, Location and ActivityTemplate): activities whose
// log or template is gone, location links whose log or location is gone, and
// photos attached to neither a log nor a location any more (their files on
// disk are removed too). Run with --dry-run first to see what it would do:
//
//   tsx --tsconfig tsconfig.server.json src/server/scripts/cleanupOrphans.ts --dry-run
const dryRun = process.argv.includes('--dry-run')

async function run() {
  initAsyncHooks()
  await withRemult(async (r) => {
    const activities = await r.repo(Activity).find({ include: { log: true, template: true } })
    const orphanActivities = activities.filter(a => !a.log || !a.template)

    const links = await r.repo(LogLocation).find({ include: { log: true, location: true } })
    const orphanLinks = links.filter(l => !l.log || !l.location)

    const photos = await r.repo(Photo).find({ include: { log: true, location: true } })
    const orphanPhotos = photos.filter(p => !p.log && !p.location)

    console.log(`${orphanActivities.length} orphaned activities, ${orphanLinks.length} orphaned location links, ${orphanPhotos.length} orphaned photos`)
    if (dryRun)
      return

    for (const activity of orphanActivities)
      await r.repo(Activity).delete(activity)
    for (const link of orphanLinks)
      await r.repo(LogLocation).delete(link)
    for (const photo of orphanPhotos)
      await r.repo(Photo).delete(photo)
    console.log('Deleted.')
  }, { dataProvider })
  await pool.end()
}

run()

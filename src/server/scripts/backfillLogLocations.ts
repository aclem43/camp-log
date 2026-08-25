import { Entity, Fields, Relations, withRemult } from 'remult'
import { initAsyncHooks } from 'remult/async-hooks'
import { Location } from '../../shared/models/Location'
import type { Log } from '../../shared/models/Log'
import { LogLocation } from '../../shared/models/LogLocation'
import { User } from '../../shared/models/auth/User'
import { dataProvider } from '../db/dataProvider'
import { pool } from '../db/pool'

// Mirrors Log as it existed before its single `location` field was replaced
// by the LogLocation join table - scoped to this one-off backfill script so
// the current Log entity doesn't need to carry that field just to run this.
@Entity('log', { dbName: 'camp.log' })
class LegacyLog {
  @Fields.autoIncrement() id!: number
  @Relations.toOne(() => User) user?: User
  @Relations.toOne(() => Location) location?: Location
}

async function run() {
  initAsyncHooks()
  await withRemult(async (r) => {
    const logs = await r.repo(LegacyLog).find({ include: { location: true, user: true } })
    for (const log of logs) {
      if (!log.location || !log.user)
        continue
      r.user = { id: log.user.id, name: log.user.name }
      const already = await r.repo(LogLocation).findFirst({ log: { $id: log.id }, location: { $id: log.location.id } })
      if (already)
        continue
      await r.repo(LogLocation).insert({ log: { id: log.id } as Log, location: log.location })
      // eslint-disable-next-line no-console
      console.log(`log ${log.id} -> location ${log.location.id}`)
    }
  }, { dataProvider })
  await pool.end()
}

run()

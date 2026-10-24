import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { Activity } from './Activity'
import { LogLocation } from './LogLocation'
import { Photo } from './Photo'
import { User } from './auth/User'

@Entity<Log>('log', {
  dbName: 'camp.log',
  allowApiCrud: Allow.authenticated,
  apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
  saving: (log) => {
    log.user = { id: remult.user!.id } as User
  },
  // Lifecycle hooks only run on the backend, so this cascade covers every
  // way a log gets deleted. If it fails part-way the log itself is kept, and
  // deleting it again finishes the job.
  deleting: async (log) => {
    await remult.repo(Activity).deleteMany({ where: { log: { $id: log.id } } })
    await remult.repo(LogLocation).deleteMany({ where: { log: { $id: log.id } } })
    await remult.repo(Photo).deleteMany({ where: { log: { $id: log.id } } })
  },
})
export class Log {
  @Fields.autoIncrement()
  id!: number

  @Relations.toOne(() => User)
  user?: User

  @Fields.string()
  name = ''

  @Fields.string()
  description = ''

  @Fields.string()
  weather = ''

  // Terrain logbook entry id, when this log was created via the Terrain
  // import - lets a resumed import skip entries already brought in.
  @Fields.string()
  terrainId = ''

  @Fields.date()
  dateStart = new Date()

  @Fields.date()
  dateEnd?: Date
}

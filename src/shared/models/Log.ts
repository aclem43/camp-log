import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { User } from './auth/User'

@Entity<Log>('log', {
  dbName: 'camp.log',
  allowApiCrud: Allow.authenticated,
  apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
  saving: (log) => {
    log.user = { id: remult.user!.id } as User
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

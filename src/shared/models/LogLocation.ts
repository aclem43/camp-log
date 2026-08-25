import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { Location } from './Location'
import { Log } from './Log'
import { User } from './auth/User'

@Entity<LogLocation>('log-location', {
  dbName: 'camp.logLocation',
  allowApiCrud: Allow.authenticated,
  apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
  saving: (logLocation) => {
    logLocation.user = { id: remult.user!.id } as User
  },
})
export class LogLocation {
  @Fields.autoIncrement()
  id!: number

  @Relations.toOne(() => User)
  user?: User

  @Relations.toOne(() => Log)
  log?: Log

  @Relations.toOne(() => Location)
  location?: Location
}

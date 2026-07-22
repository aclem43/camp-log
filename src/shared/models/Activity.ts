import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { ActivityTemplate } from './ActivityTemplate'
import { Log } from './Log'
import { User } from './auth/User'

@Entity<Activity>('activity', {
    dbName: 'camp.activity',
    allowApiCrud: Allow.authenticated,
    apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
    saving: (activity) => {
      activity.user = { id: remult.user!.id } as User
    },
})
export class Activity {
    @Fields.autoIncrement()
    id!: number

    @Relations.toOne(() => User)
    user?: User

    @Relations.toOne(() => ActivityTemplate)
    template?: ActivityTemplate

    @Relations.toOne(() => Log)
    log?: Log

    @Fields.number()
    value = 0
}

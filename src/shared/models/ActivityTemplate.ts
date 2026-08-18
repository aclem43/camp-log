import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { User } from './auth/User'

@Entity<ActivityTemplate>('activityTemplate', {
    dbName: 'camp.activityTemplate',
    allowApiCrud: Allow.authenticated,
    apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
    saving: (activityTemplate) => {
      activityTemplate.user = { id: remult.user!.id } as User
    },
})
export class ActivityTemplate {
    @Fields.autoIncrement()
    id!: number

    @Relations.toOne(() => User)
    user?: User

    @Fields.string()
    name = ''

    @Fields.string()
    description = ''

    @Fields.string()
    unit = ''
}

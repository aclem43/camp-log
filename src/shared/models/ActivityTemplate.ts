import { Entity, Fields, Relations } from 'remult'
import { User } from './User'

@Entity('activityTemplate', {
    dbName: 'camp.activityTemplate',
    allowApiCrud: true,
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

import { Entity, Fields, Relations } from 'remult'
import { ActivityTemplate } from './ActivityTemplate'
import { Log } from './Log'
import { User } from './User'

@Entity('activity', {
    dbName: 'camp.activity',
    allowApiCrud: true,
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

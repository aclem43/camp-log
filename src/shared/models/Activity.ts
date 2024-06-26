import { Entity, Fields, Relations } from 'remult'
import { ActivityTemplate } from './ActivityTemplate'
import { Log } from './Log'

@Entity('activity', {
  dbName: 'camp.activity',
  allowApiCrud: true,
})
export class Activity {
  @Fields.autoIncrement()
    id!: number

  @Relations.toOne(() => ActivityTemplate)
    template?: ActivityTemplate

  @Relations.toOne(() => Log)
    log?: Log

  @Fields.number()
    value = 0
}

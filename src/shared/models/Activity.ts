import { Entity, Fields, Relations } from 'remult'
import { ActivityTemplate } from './ActivityTemplate'
import { Log } from './Log'

@Entity('activity', {
  dbName: 'camp.activity',
})
export class Activity {
  @Fields.autoIncrement()
    id!: number

  @Relations.toOne(() => ActivityTemplate)
    template?: ActivityTemplate

  @Relations.toOne(() => Log)
    log?: Log

  @Fields.number()
    quantity = 0
}

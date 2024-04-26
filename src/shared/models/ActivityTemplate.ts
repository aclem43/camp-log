import { Entity, Fields, Relations } from 'remult'

@Entity('activityTemplate', {
  dbName: 'camp.activityTemplate',
})
export class ActivityTemplate {
  @Fields.autoIncrement()
    id!: number

  @Fields.string()
    name = ''

  @Fields.string()
    description = ''

  @Fields.string()
    unit = ''
}

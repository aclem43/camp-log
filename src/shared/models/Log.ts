import { Entity, Fields, Relations } from 'remult'
import { Location } from './Location'

@Entity('log', {
  dbName: 'camp.log',
})
export class Log {
  @Fields.autoIncrement()
    id!: number

  @Fields.string()
    name = ''

  @Fields.string()
    description = ''

  @Fields.string()
    weather = ''

  @Fields.date()
    dateStart = new Date()

  @Fields.date()
    dateEnd = new Date()

  @Relations.toOne(() => Location)
    location?: Location
}

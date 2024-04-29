import { Entity, Fields, Relations } from 'remult'
import { Location } from './Location'

@Entity('log', {
  dbName: 'camp.log',
  allowApiCrud: true,
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
    dateEnd?: Date | null

  @Relations.toOne(() => Location)
    location?: Location
}

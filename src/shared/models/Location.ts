import { Entity, Fields } from 'remult'

@Entity('location', {
  dbName: 'camp.location',
})
export class Location {
  @Fields.autoIncrement()
    id!: number

  @Fields.string()
    name = ''

  @Fields.string()
    notes = ''

  @Fields.literal(() => ['remote', '2wdAcess', '4wdAcess', 'bushCamp'])
    type = '2wdAcess'

  @Fields.number()
    latitude!: number

  @Fields.number()
    longitude!: number
}

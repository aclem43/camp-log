import { Entity, Fields } from 'remult'

export const campTypes = ['remote', '2wdAcess', '4wdAcess', 'bushCamp']

export type campTypesType = 'remote' | '2wdAcess' | '4wdAcess' | 'bushCamp'

export function campTypesToText(campType: campTypesType) {
  switch (campType) {
    case 'remote':
      return 'Remote'
    case '2wdAcess':
      return '2WD Access'
    case '4wdAcess':
      return '4WD Access'
    case 'bushCamp':
      return 'Bush Camp'
  }
}

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

  @Fields.literal(() => campTypes)
    type: campTypesType = '2wdAcess'

  @Fields.string()
    address = ''

  @Fields.number()
    latitude?: number

  @Fields.number()
    longitude?: number
}

import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { User } from './auth/User'

export const campTypes = ['remote', '2wdAcess', '4wdAcess', 'bushCamp', 'unknown']

export type campTypesType = 'remote' | '2wdAcess' | '4wdAcess' | 'bushCamp' | 'unknown'

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
    case 'unknown':
      return 'Unknown'
  }
}

export function campTypesToColor(campType: campTypesType) {
  switch (campType) {
    case 'remote':
      return '#2e7d32'
    case '2wdAcess':
      return '#1976d2'
    case '4wdAcess':
      return '#f57c00'
    case 'bushCamp':
      return '#6d4c41'
    case 'unknown':
      return '#757575'
  }
}

@Entity<Location>('location', {
  dbName: 'camp.location',
  allowApiCrud: Allow.authenticated,
  apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
  saving: (location) => {
    location.user = { id: remult.user!.id } as User
  },
})
export class Location {
  @Fields.autoIncrement()
    id!: number

  @Relations.toOne(() => User)
    user?: User

  @Fields.string()
    name = ''

  @Fields.string()
    notes = ''

  @Fields.literal(() => campTypes)
    type: campTypesType = '2wdAcess'

  @Fields.string()
    address = ''

  @Fields.string()
    city = ''
  
  @Fields.string()
    state = ''
  @Fields.string() 
    country = ''

  @Fields.number()
    latitude?: number

  @Fields.number()
    longitude?: number
}

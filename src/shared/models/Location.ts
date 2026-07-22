import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { User } from './auth/User'

export const campTypes = ['remote', '2wdAcess', '4wdAcess', 'bushCamp', 'unknown']

export type campTypesType = 'remote' | '2wdAcess' | '4wdAcess' | 'bushCamp' | 'unknown'

const campTypeText: Record<campTypesType, string> = {
  'remote': 'Remote',
  '2wdAcess': '2WD Access',
  '4wdAcess': '4WD Access',
  'bushCamp': 'Bush Camp',
  'unknown': 'Unknown',
}

const campTypeColor: Record<campTypesType, string> = {
  'remote': '#2e7d32',
  '2wdAcess': '#1976d2',
  '4wdAcess': '#f57c00',
  'bushCamp': '#6d4c41',
  'unknown': '#757575',
}

export function campTypesToText(campType: campTypesType) {
  return campTypeText[campType]
}

export function campTypesToColor(campType: campTypesType) {
  return campTypeColor[campType]
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

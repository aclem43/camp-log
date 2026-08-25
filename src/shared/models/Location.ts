import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { User } from './auth/User'

export const campTypes = ['remote', '2wdAcess', '4wdAcess', 'nonCampground', 'unknown']

export type campTypesType = 'remote' | '2wdAcess' | '4wdAcess' | 'nonCampground' | 'unknown'

const campTypeText: Record<campTypesType, string> = {
  'remote': 'Remote / Bush Camp',
  '2wdAcess': '2WD Access',
  '4wdAcess': '4WD Access',
  'nonCampground': 'Non-Campground',
  'unknown': 'Unknown',
}

const campTypeColor: Record<campTypesType, string> = {
  'remote': '#2e7d32',
  '2wdAcess': '#1976d2',
  '4wdAcess': '#f57c00',
  'nonCampground': '#5e35b1',
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

  // Comma-separated alternate names (e.g. "KP, Scout HQ") - lets search and
  // the Terrain import matcher find a location by a name other than its
  // canonical one.
  @Fields.string()
  nicknames = ''

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

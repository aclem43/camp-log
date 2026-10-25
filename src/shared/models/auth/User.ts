import { Allow, Entity, Fields, remult } from 'remult'

export const unitPreferences = ['metric', 'imperial'] as const
export type UnitPreference = typeof unitPreferences[number]

// Enforced by better-auth (src/server/auth.ts); the register form checks it
// too so it can say so up front.
export const MIN_PASSWORD_LENGTH = 8

@Entity<User>('user', {
  dbName: 'camp.user',
  allowApiCrud: false,
  allowApiRead: Allow.authenticated,
  apiPrefilter: () => ({ id: remult.user!.id }),
})
export class User {
  @Fields.string()
  id!: string

  @Fields.string()
  name = ''

  @Fields.string()
  email = ''

  @Fields.boolean()
  emailVerified = false

  @Fields.string()
  image?: string

  @Fields.boolean()
  active = true

  @Fields.literal(() => unitPreferences)
  unitPreference: UnitPreference = 'metric'

  @Fields.createdAt()
  createdAt!: Date

  @Fields.updatedAt()
  updatedAt!: Date
}

import { Allow, Entity, Fields, remult } from 'remult'

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

  @Fields.createdAt()
  createdAt!: Date

  @Fields.updatedAt()
  updatedAt!: Date
}

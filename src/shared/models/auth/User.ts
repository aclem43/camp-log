import { Entity, Fields } from 'remult'

@Entity('user', {
  dbName: 'camp.user',
  allowApiCrud: false,
  allowApiRead: true,
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

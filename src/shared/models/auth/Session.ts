import { Entity, Fields, Relations } from 'remult'
import { User } from './User'

@Entity('session', {
  dbName: 'camp.session',
  allowApiCrud: false,
})
export class Session {
  @Fields.string()
  id!: string

  @Fields.date()
  expiresAt!: Date

  @Fields.string()
  token = ''

  @Fields.createdAt()
  createdAt!: Date

  @Fields.updatedAt()
  updatedAt!: Date

  @Fields.string()
  ipAddress?: string

  @Fields.string()
  userAgent?: string

  @Fields.string()
  userId = ''

  @Relations.toOne<Session, User>(() => User, 'userId')
  user!: User
}

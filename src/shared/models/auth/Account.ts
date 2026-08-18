import { Entity, Fields, Relations } from 'remult'
import { User } from './User'

@Entity('account', {
  dbName: 'camp.account',
  allowApiCrud: false,
})
export class Account {
  @Fields.string()
  id!: string

  @Fields.string()
  accountId = ''

  @Fields.string()
  providerId = ''

  @Fields.string()
  userId = ''

  @Relations.toOne<Account, User>(() => User, 'userId')
  user!: User

  @Fields.string()
  accessToken?: string

  @Fields.string()
  refreshToken?: string

  @Fields.string()
  idToken?: string

  @Fields.date()
  accessTokenExpiresAt?: Date

  @Fields.date()
  refreshTokenExpiresAt?: Date

  @Fields.string()
  scope?: string

  @Fields.string()
  password?: string

  @Fields.createdAt()
  createdAt!: Date

  @Fields.updatedAt()
  updatedAt!: Date
}

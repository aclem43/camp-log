import { Entity, Fields } from 'remult'

@Entity('verification', {
  dbName: 'camp.verification',
  allowApiCrud: false,
})
export class Verification {
  @Fields.string()
  id!: string

  @Fields.string()
  identifier = ''

  @Fields.string()
  value = ''

  @Fields.date()
  expiresAt!: Date

  @Fields.createdAt()
  createdAt!: Date

  @Fields.updatedAt()
  updatedAt!: Date
}

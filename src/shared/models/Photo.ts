import { Allow, Entity, Fields, Relations, remult } from 'remult'
import { Location } from './Location'
import { Log } from './Log'
import { User } from './auth/User'

// Inserts/deletes go through src/server/routes/photos.ts (multipart upload,
// disk cleanup on delete) rather than the generic remult API - only reading
// the resulting rows goes through the normal CRUD API.
@Entity<Photo>('photo', {
  dbName: 'camp.photo',
  allowApiRead: Allow.authenticated,
  allowApiInsert: false,
  allowApiUpdate: false,
  allowApiDelete: false,
  apiPrefilter: () => ({ user: { $id: remult.user!.id } }),
})
export class Photo {
  @Fields.autoIncrement()
  id!: number

  @Relations.toOne(() => User)
  user?: User

  @Relations.toOne(() => Log)
  log?: Log

  @Relations.toOne(() => Location)
  location?: Location

  // On-disk filename (random, not the original) - served via
  // GET /api/photos/:id/file rather than a public static path.
  @Fields.string()
  filename = ''

  @Fields.string()
  originalName = ''

  @Fields.string()
  caption = ''

  @Fields.createdAt()
  createdAt!: Date
}

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { photoFiles } from '../shared/models/Photo'
import { proc } from './config'

export const uploadsDir = path.resolve(proc.env.UPLOADS_DIR ?? './uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

export async function removePhotoFile(filename: string) {
  await fsp.unlink(path.join(uploadsDir, filename)).catch(() => {})
}

// Plugs real file removal into the Photo entity's `deleted` hook, so a
// photo's file goes with its row however it's deleted (directly, or cascaded
// from its log/location). Anything that deletes photos server-side must
// import this module first.
photoFiles.remove = removePhotoFile

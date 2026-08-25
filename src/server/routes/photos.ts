import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { UserInfo } from 'remult'
import { Router } from 'express'
import multer from 'multer'
import { remult, withRemult } from 'remult'
import { Location } from '../../shared/models/Location'
import { Log } from '../../shared/models/Log'
import { Photo } from '../../shared/models/Photo'
import type { User } from '../../shared/models/auth/User'
import { proc } from '../config'
import { dataProvider } from '../db/dataProvider'

interface RequestWithUser extends Request {
  authUser?: UserInfo
}

const router: Router = Router()

const uploadsDir = path.resolve(proc.env.UPLOADS_DIR ?? './uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_FILE_SIZE = 15 * 1024 * 1024

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Self-heals if the directory ever disappears at runtime (volume
      // remount, manual cleanup, etc.) instead of failing every upload
      // until the server restarts.
      fs.mkdirSync(uploadsDir, { recursive: true })
      cb(null, uploadsDir)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'))
      return
    }
    cb(null, true)
  },
})

function requireUser(res: Response) {
  if (!remult.user) {
    res.status(401).json({ message: 'Not authenticated' })
    return null
  }
  return remult.user
}

router.post(
  '/photos',
  // multer's disk storage engine signals completion from inside a stream
  // "finish" event, which - despite this being registered Express
  // middleware - runs outside the AsyncLocalStorage context remult-express
  // sets up per-request (Node's async_hooks doesn't reliably carry that
  // context through EventEmitter callbacks). remult.user throws if touched
  // after this point, so capture it here, while we're still definitely
  // inside the real request cycle, and re-enter a fresh context explicitly
  // below via withRemult() rather than relying on the automatic one.
  (req: RequestWithUser, _res, next) => {
    req.authUser = remult.user
    next()
  },
  upload.single('file'),
  async (req: RequestWithUser, res) => {
    const authUser = req.authUser
    if (!authUser) {
      res.status(401).json({ message: 'Not authenticated' })
      return
    }
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' })
      return
    }

    await withRemult(async (r) => {
      r.user = authUser
      try {
        const { logId, locationId, caption } = req.body as { logId?: string, locationId?: string, caption?: string }

        let log: Log | undefined
        let location: Location | undefined

        if (logId) {
          log = await r.repo(Log).findFirst({ id: Number(logId), user: { $id: authUser.id } })
          if (!log)
            throw new Error('Log not found')
        }
        if (locationId) {
          location = await r.repo(Location).findFirst({ id: Number(locationId), user: { $id: authUser.id } })
          if (!location)
            throw new Error('Location not found')
        }
        if (!log && !location)
          throw new Error('logId or locationId is required')

        const photo = await r.repo(Photo).insert({
          user: { id: authUser.id } as User,
          log,
          location,
          filename: req.file!.filename,
          originalName: req.file!.originalname,
          caption: typeof caption === 'string' ? caption : '',
        })

        res.json(photo)
      }
      catch (err) {
        await fsp.unlink(path.join(uploadsDir, req.file!.filename)).catch(() => {})
        res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to save photo' })
      }
    }, { dataProvider })
  },
)

// Catches errors thrown by upload.single('file') above (bad mimetype, file
// too large, missing dir, etc.) - a normal try/catch can't see those since
// they happen inside multer's own middleware, before our handler runs.
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (!err) {
    next()
    return
  }
  res.status(400).json({ message: err instanceof Error ? err.message : 'Upload failed' })
})

router.get('/photos/:id/file', async (req, res) => {
  const authUser = requireUser(res)
  if (!authUser)
    return

  const photo = await remult.repo(Photo).findFirst({ id: Number(req.params.id), user: { $id: authUser.id } })
  if (!photo) {
    res.status(404).end()
    return
  }

  res.sendFile(photo.filename, { root: uploadsDir }, (err) => {
    if (err && !res.headersSent)
      res.status(404).end()
  })
})

router.delete('/photos/:id', async (req, res) => {
  const authUser = requireUser(res)
  if (!authUser)
    return

  const photo = await remult.repo(Photo).findFirst({ id: Number(req.params.id), user: { $id: authUser.id } })
  if (!photo) {
    res.status(404).json({ message: 'Photo not found' })
    return
  }

  await remult.repo(Photo).delete(photo)
  await fsp.unlink(path.join(uploadsDir, photo.filename)).catch(() => {})
  res.json({ success: true })
})

export default router

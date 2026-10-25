import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { remult } from 'remult'

export function requireUser(res: Response) {
  if (!remult.user) {
    res.status(401).json({ message: 'Not authenticated' })
    return null
  }
  return remult.user
}

// Express 4 doesn't catch promises rejected by async route handlers - left
// alone, any thrown error (a DB timeout, say) becomes an unhandled rejection,
// which crashes the whole process on Node 15+. This forwards it to the error
// middleware in src/server/index.ts instead.
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next)
  }
}

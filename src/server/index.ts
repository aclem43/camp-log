/* eslint-disable no-console */
import process from 'node:process'
import type { NextFunction, Request, Response } from 'express'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { toNodeHandler } from 'better-auth/node'
import { api } from './plugins/remult'
import { auth } from './auth'
import { isDev, isProd, proc } from './config'
import GeocodeRoutes from './routes/geocode'
import AccountRoutes from './routes/account'
import TerrainImportRoutes from './routes/terrainImport'
import PhotoRoutes from './routes/photos'

const app = express()
const port = Number.parseInt(proc.env.PORT as string ?? 3000)
const hostname = proc.env.HOST ?? 'localhost'

const tileHosts = [
  'https://tile.openstreetmap.org',
  'https://*.tile.opentopomap.org',
  'https://server.arcgisonline.com',
  'https://*.basemaps.cartocdn.com',
]

app.use(helmet({
  // This server is plain HTTP behind Tailscale (no TLS termination here),
  // so an HSTS header would make browsers force-upgrade future requests
  // to https and lock themselves out.
  hsts: false,
  // Leaflet tiles are fetched cross-origin as plain <img> tags; the tile
  // hosts below don't send CORP headers, so COEP would block them, and the
  // default img-src ('self' + data:) would too.
  crossOriginEmbedderPolicy: false,
  // helmet defaults to no-referrer, and tile.openstreetmap.org rejects tile
  // requests without a Referer (403 "Access blocked"). This is the browser
  // default: cross-origin requests get the origin only, never the path.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // Same reasoning as hsts above: this deployment is plain HTTP, so
      // upgrading insecure requests would break every asset on the page.
      'upgrade-insecure-requests': null,
      'img-src': ['\'self\'', 'data:', ...tileHosts],
      // The service worker caches tiles (runtimeCaching in vite.config.ts),
      // so it re-requests them with fetch(), which connect-src governs -
      // without this it falls back to default-src 'self' and blocks them.
      'connect-src': ['\'self\'', ...tileHosts],
    },
  },
}))
app.use(compression())

app.all('/api/auth/*', toNodeHandler(auth))
app.use(api)
app.use(api.withRemult)
app.use('/api/', GeocodeRoutes)
app.use('/api/', AccountRoutes)
app.use('/api/', TerrainImportRoutes)
app.use('/api/', PhotoRoutes)

const frontendFiles = `${process.cwd()}/dist`

app.get('/api/version', (_, res) => {
  let ver = proc.env.npm_package_version
  if (isDev) {
    ver = `${ver}-dev`
    console.log(`[server] Version: ${ver}-dev`)
  }
  res.send(JSON.stringify({ version: ver }))
})

if (isProd) {
  app.use(express.static(frontendFiles))

  app.get('/*', (_, res) => {
    res.sendFile(`${frontendFiles}/index.html`)
  })
}

// Last-resort handler for errors thrown by routes (async ones reach it via
// asyncHandler in ./http.ts) - log it and fail just this request rather than
// leaving it hanging or taking the server down.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(`[server] ${req.method} ${req.originalUrl} failed:`, err)
  if (res.headersSent) {
    next(err)
    return
  }
  res.status(500).json({ message: 'Something went wrong. Please try again.' })
})

app.listen(port, hostname, () => {
  console.log(`[server] Server is running on http://${hostname}:${port}`)
})

/* eslint-disable no-console */
import process from 'node:process'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import session from 'express-session'
import { remult, withRemult } from 'remult'
import { User } from '../shared/models/User'
import { api } from './plugins/remult'
import { isDev, isProd, proc } from './config'
import UserRoutes from './routes/user'
const app = express()
const port = Number.parseInt(proc.env.PORT as string ?? 3000)
const hostname = proc.env.HOST ?? 'localhost'

// app.use(helmet())
// app.use(compression())

app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }, resave: true, saveUninitialized: true }))
app.use(api)
app.use(api.withRemult)
app.get('/api/session', (req, res) => {
  res.json(req.session)
  // req.session!.user = { id: 'test', name: 'test' }
  // res.send('Logged in')
})
app.use('/api/',UserRoutes )


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

app.listen(port, hostname, () => {
  console.log(`[server] Server is running on http://${hostname}:${port}`)
})

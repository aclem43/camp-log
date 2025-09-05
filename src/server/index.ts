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

app.get('/api/login', (req, res) => {
  req.session!.user = { id: 'test', email: 'test' }
  res.send('Logged in')
})

app.post('/api/login', async (req, res) => {
  const userRepo = remult.repo(User)
  const user = await userRepo.find({ where: { email: req.body.email } })
  let userFound = null
  for (const u of user) {
    if (u && u.password === req.body.password) {
      req.session!.user = { id: u.id, email: u.email }
      userFound = u
      break
    }
  }
  if (userFound) {
    res.json({ success: true, user: userFound })
  }
  else {
    res.json({ success: false, message: 'Invalid email or password' })
  }
})

app.get('/api/logout', (req, res) => {
  req.session!.destroy(() => {
    res.send('Logged out')
  })
})

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

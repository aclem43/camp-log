/* eslint-disable no-console */
import process from 'node:process'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { api } from './plugins/remult'
import { isDev, proc } from './config'

const app = express()
const port = Number.parseInt(proc.env.PORT as string ?? 3000)
const hostname = proc.env.HOST ?? 'localhost'

app.use(helmet())
app.use(compression())
app.use(api)

const frontendFiles = `${process.cwd()}/dist`

app.get('/api/version', (_, res) => {
  let ver = proc.env.npm_package_version
  if (isDev) {
    ver = `${ver}-dev`
    console.log(`[server] Version: ${ver}-dev`)
  }
  res.send(JSON.stringify({ version: ver }))
})

app.use(express.static(frontendFiles))
app.get('/*', (_, res) => {
  res.sendFile(`${frontendFiles}/index.html`)
})

app.listen(port, hostname, () => {
  console.log(`[server] Server is running on http://${hostname}:${port}`)
})

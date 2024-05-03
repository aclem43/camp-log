/* eslint-disable no-console */
import process from 'node:process'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { api } from './plugins/remult'
import { proc } from './config'

const app = express()
const port = Number.parseInt(proc.env.PORT as string ?? 3000)
const hostname = proc.env.HOST ?? 'localhost'

app.use(helmet())
app.use(compression())
app.use(api)

const frontendFiles = `${process.cwd()}/dist`

app.get('/api/version', (_, res) => {
  res.send(JSON.stringify({ version: proc.env.npm_package_version }))
})

app.use(express.static(frontendFiles))
app.get('/*', (_, res) => {
  res.sendFile(`${frontendFiles}/index.html`)
})

const version = proc.env.npm_package_version

app.listen(port, hostname, () => {
  console.log(`[server] Version: ${version}`)
  console.log(`[server] Server is running on http://${hostname}:${port}`)
})

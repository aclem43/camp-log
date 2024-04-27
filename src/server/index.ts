/* eslint-disable no-console */
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { type UserInfo, repo } from 'remult'
import { api } from './plugins/remult'
import { proc } from './config'

const app = express()
const port = Number.parseInt(proc.env.PORT as string ?? 3000)
const hostname = proc.env.HOST ?? 'localhost'

app.use(api)

const version = proc.env.npm_package_version
app.listen(port, hostname, () => {
  console.log(`[server] Version: ${version}`)
  console.log(`[server] Server is running on http://${hostname}:${port}`)
})

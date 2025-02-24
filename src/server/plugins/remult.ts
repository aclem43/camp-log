import { remultExpress } from 'remult/remult-express'
import { PostgresDataProvider } from 'remult/postgres'
import { JsonDataProvider, SqlDatabase, type UserInfo, repo } from 'remult'
import type { Request } from 'express'
import { JsonEntityFileStorage } from 'remult/server'
import { isDev, proc } from '../config'
import { pool } from '../db/pool'
import { Activity } from '../../shared/models/Activity'
import { Location } from '../../shared/models/Location'
import { ActivityTemplate } from '../../shared/models/ActivityTemplate'
import { Log } from '../../shared/models/Log'
import { User } from '../../shared/models/User'

let dataProvider
if (proc.env.DATABASE_TYPE === 'JSON') {
  dataProvider = new JsonDataProvider(new JsonEntityFileStorage('./db'))
}
else {
  dataProvider = new SqlDatabase(new PostgresDataProvider(pool, {
    orderByNullsFirst: false,
  }))
}

export const api = remultExpress(
  {
    admin: isDev,
    entities: [
      Activity,
      ActivityTemplate,
      Location,
      Log,
      User,
    ],
    dataProvider,
  },
)

import { remultExpress } from 'remult/remult-express'
import { PostgresDataProvider } from 'remult/postgres'
import { SqlDatabase, type UserInfo, repo } from 'remult'
import type { Request } from 'express'
import { isDev } from '../config'
import { pool } from '../db/pool'
import { Activity } from '../../shared/models/Activity'
import { Location } from '../../shared/models/Location'
import { ActivityTemplate } from '../../shared/models/ActivityTemplate'
import { Log } from '../../shared/models/Log'

export const api = remultExpress(
  {
    admin: isDev,
    entities: [
      Activity,
      ActivityTemplate,
      Location,
      Log,

    ],
    dataProvider: new SqlDatabase(new PostgresDataProvider(pool, {
      orderByNullsFirst: false,
    })),
  },
)

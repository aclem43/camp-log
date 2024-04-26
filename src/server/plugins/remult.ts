import { remultExpress } from 'remult/remult-express'
import { PostgresDataProvider } from 'remult/postgres'
import { SqlDatabase, type UserInfo, repo } from 'remult'
import type { Request } from 'express'
import { isDev } from '../config'
import { pool } from '../db/pool'

export const api = remultExpress(
  {
    admin: isDev,
    entities: [
    ],
    dataProvider: new SqlDatabase(new PostgresDataProvider(pool, {
      orderByNullsFirst: false,
    })),
  },
)

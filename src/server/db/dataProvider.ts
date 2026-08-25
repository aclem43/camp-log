import { JsonDataProvider, SqlDatabase } from 'remult'
import { PostgresDataProvider } from 'remult/postgres'
import { JsonEntityFileStorage } from 'remult/server'
import { proc } from '../config'
import { pool } from './pool'

export const dataProvider = proc.env.DATABASE_TYPE === 'JSON'
  ? new JsonDataProvider(new JsonEntityFileStorage('./db'))
  : new SqlDatabase(new PostgresDataProvider(pool, {
      orderByNullsFirst: false,
    }))

// @ts-expect-error - no types available
import pg from 'pg'
import { proc } from '../config'

const { Pool } = pg

const connectionString = proc.env.DATABASE_URL

export const pool = new Pool({
  connectionString,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// @ts-expect-error - no types available
import pg from 'pg'
import { proc } from '../config'

const { Pool } = pg

const connectionString = proc.env.DATABASE_URL

export const pool = new Pool({
  connectionString,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Without these a query on a connection to an unresponsive database waits
  // forever, hanging the request. statement_timeout has Postgres cancel slow
  // queries; query_timeout is the client-side backstop for when the server
  // can't answer at all.
  statement_timeout: 10000,
  query_timeout: 15000,
})

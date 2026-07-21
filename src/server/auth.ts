import { betterAuth } from 'better-auth'
import { remultAdapter } from '@nerdfolio/remult-better-auth'
import { Account } from '../shared/models/auth/Account'
import { Session } from '../shared/models/auth/Session'
import { User } from '../shared/models/auth/User'
import { Verification } from '../shared/models/auth/Verification'
import { dataProvider } from './db/dataProvider'
import { isDev, proc } from './config'

export const auth = betterAuth({
  database: remultAdapter({
    authEntities: { User, Session, Account, Verification },
    dataProvider,
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: proc.env.BETTER_AUTH_SECRET,
  baseURL: proc.env.BETTER_AUTH_URL,
  // In dev, the Vite dev server (port 4000) proxies /api to this server (port 3000),
  // so the browser's Origin header doesn't match baseURL — trust it explicitly.
  trustedOrigins: isDev ? ['http://localhost:4000'] : undefined,
})

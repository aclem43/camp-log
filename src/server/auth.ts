import { APIError, betterAuth } from 'better-auth'
import { remultAdapter } from '@nerdfolio/remult-better-auth'
import { Account } from '../shared/models/auth/Account'
import { Session } from '../shared/models/auth/Session'
import { User } from '../shared/models/auth/User'
import { Verification } from '../shared/models/auth/Verification'
import { dataProvider } from './db/dataProvider'
import { isDev, proc } from './config'
import { createDefaultActivityTemplates } from './defaults'

export const auth = betterAuth({
  database: remultAdapter({
    authEntities: { User, Session, Account, Verification },
    dataProvider,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      active: {
        type: 'boolean',
        required: false,
        input: false,
        defaultValue: true,
      },
      unitPreference: {
        type: 'string',
        required: false,
        input: false,
        defaultValue: 'metric',
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createDefaultActivityTemplates(user.id)
        },
      },
    },
    session: {
      create: {
        // Blocks new sign-ins for deactivated accounts. Existing sessions are
        // revoked separately (see /api/deactivate-account) since this hook
        // only runs when a session is created, not on every request.
        before: async (session, ctx) => {
          if (!ctx)
            return
          const user = await ctx.context.internalAdapter.findUserById(session.userId) as { active?: boolean } | null
          if (user?.active === false) {
            throw new APIError('FORBIDDEN', {
              message: 'This account has been deactivated.',
              code: 'ACCOUNT_DEACTIVATED',
            })
          }
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: proc.env.GOOGLE_CLIENT_ID!,
      clientSecret: proc.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  secret: proc.env.BETTER_AUTH_SECRET,
  baseURL: proc.env.BETTER_AUTH_URL,
  // In dev, the Vite dev server (port 4000) proxies /api to this server (port 3000),
  // so the browser's Origin header doesn't match baseURL — trust it explicitly.
  trustedOrigins: isDev ? ['http://localhost:4000'] : undefined,
})

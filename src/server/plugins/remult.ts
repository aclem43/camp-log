import { remultExpress } from 'remult/remult-express'
import type { UserInfo } from 'remult'
import { fromNodeHeaders } from 'better-auth/node'
import { isDev } from '../config'
import { dataProvider } from '../db/dataProvider'
import { auth } from '../auth'
import { Activity } from '../../shared/models/Activity'
import { Location } from '../../shared/models/Location'
import { ActivityTemplate } from '../../shared/models/ActivityTemplate'
import { Log } from '../../shared/models/Log'
import { LogLocation } from '../../shared/models/LogLocation'
import { Photo } from '../../shared/models/Photo'
import { Account } from '../../shared/models/auth/Account'
import { Session } from '../../shared/models/auth/Session'
import { User } from '../../shared/models/auth/User'
import { Verification } from '../../shared/models/auth/Verification'

export const api = remultExpress(
  {
    admin: isDev,
    entities: [
      Activity,
      ActivityTemplate,
      Location,
      Log,
      LogLocation,
      Photo,
      User,
      Session,
      Account,
      Verification,
    ],
    getUser: async (req) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
      if (!session)
        return undefined
      return { id: session.user.id, name: session.user.name } as UserInfo
    },
    dataProvider,
  },
)

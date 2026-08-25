import type { Response as ExpressResponse } from 'express'
import { Router } from 'express'
import { remult } from 'remult'

const router: Router = Router()

const BRANCHES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA', 'National']

// Public config for Terrain's own frontend (Cognito app clients are meant to
// be embedded in public clients like a browser) - read from
// https://terrain.scouts.com.au's own page source (window.__NUXT__.config.cognito).
const COGNITO_REGION = 'ap-southeast-2'
const COGNITO_CLIENT_ID = '6v98tbc09aqfvh52fml3usas3c'
const MEMBERS_API = 'https://members.terrain.scouts.com.au'
const ACHIEVEMENTS_API = 'https://achievements.terrain.scouts.com.au'

function requireUser(res: ExpressResponse) {
  if (!remult.user) {
    res.status(401).json({ message: 'Not authenticated' })
    return null
  }
  return remult.user
}

// Terrain's Cognito app client has SRP disabled, so this is a plain
// InitiateAuth call with the raw password (over HTTPS) rather than an SRP
// challenge-response.
async function cognitoLogin(cognitoUsername: string, password: string): Promise<string> {
  const res = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: cognitoUsername, PASSWORD: password },
    }),
  })
  const body = await res.json() as {
    __type?: string
    ChallengeName?: string
    AuthenticationResult?: { IdToken?: string }
  }

  if (!res.ok)
    throw new Error(body.__type ?? 'AUTH_FAILED')

  if (body.ChallengeName === 'NEW_PASSWORD_REQUIRED')
    throw new Error('NEW_PASSWORD_REQUIRED')
  if (body.ChallengeName)
    throw new Error('MFA_REQUIRED')

  const idToken = body.AuthenticationResult?.IdToken
  if (!idToken)
    throw new Error('AUTH_FAILED')
  return idToken
}

// Terrain's frontend calls its APIs with the raw ID token in the
// `authorization` header - no observed "Bearer " prefix, but fall back to
// trying it in case a given API route disagrees.
async function terrainFetch(url: string, idToken: string) {
  const plain = await fetch(url, { headers: { authorization: idToken, accept: 'application/json' } })
  if (plain.status !== 401)
    return plain
  return fetch(url, { headers: { authorization: `Bearer ${idToken}`, accept: 'application/json' } })
}

router.post('/terrain-import/scrape', async (req, res) => {
  if (!requireUser(res))
    return

  const { branch, memberNumber, password } = req.body ?? {}
  if (!BRANCHES.includes(branch) || typeof memberNumber !== 'string' || !memberNumber.trim() || typeof password !== 'string' || !password) {
    res.status(400).json({ message: 'Branch, member number and password are required' })
    return
  }

  const cognitoUsername = `${branch.toLowerCase()}-${memberNumber.trim()}`

  let idToken: string
  try {
    idToken = await cognitoLogin(cognitoUsername, password)
  }
  catch (err) {
    const code = err instanceof Error ? err.message : ''
    if (code === 'MFA_REQUIRED') {
      res.status(422).json({ message: 'Your Terrain account needs extra verification (MFA) this tool doesn\'t support yet.' })
      return
    }
    if (code === 'NEW_PASSWORD_REQUIRED') {
      res.status(422).json({ message: 'Terrain wants you to set a new password first - log into Terrain directly once to clear that, then try again here.' })
      return
    }
    res.status(422).json({ message: 'Terrain rejected those credentials. Double-check your branch, member number and password.' })
    return
  }

  try {
    const profilesRes = await terrainFetch(`${MEMBERS_API}/profiles`, idToken)
    if (!profilesRes.ok) {
      res.status(502).json({ message: 'Logged in, but could not load your Terrain profile.' })
      return
    }
    const profiles = await profilesRes.json() as { profiles?: { member?: { id?: string } }[] }
    const memberId = profiles.profiles?.[0]?.member?.id
    if (!memberId) {
      res.status(502).json({ message: 'Logged in, but could not find a member profile on your Terrain account.' })
      return
    }

    const listRes = await terrainFetch(`${ACHIEVEMENTS_API}/members/${memberId}/logbook`, idToken)
    if (!listRes.ok) {
      res.status(502).json({ message: 'Logged in, but could not load your logbook.' })
      return
    }
    const list = await listRes.json() as { results?: { id: string }[] }
    const summaries = list.results ?? []

    const entries = []
    for (const summary of summaries) {
      const entryRes = await terrainFetch(`${ACHIEVEMENTS_API}/members/${memberId}/logbook/${summary.id}`, idToken)
      if (!entryRes.ok)
        continue
      entries.push(await entryRes.json())
    }

    res.json({ entries })
  }
  catch {
    res.status(500).json({ message: 'Logged in, but something went wrong talking to Terrain. Please try again.' })
  }
})

export default router

import type { Response } from 'express'
import { Router } from 'express'
import { remult } from 'remult'
import { fromNodeHeaders } from 'better-auth/node'
import { Activity } from '../../shared/models/Activity'
import { ActivityTemplate } from '../../shared/models/ActivityTemplate'
import { Location, campTypes } from '../../shared/models/Location'
import { Log } from '../../shared/models/Log'
import { LogLocation } from '../../shared/models/LogLocation'
import { User, unitPreferences } from '../../shared/models/auth/User'
import { auth } from '../auth'

const router: Router = Router()

function requireUser(res: Response) {
  if (!remult.user) {
    res.status(401).json({ message: 'Not authenticated' })
    return null
  }
  return remult.user
}

router.patch('/profile', async (req, res) => {
  const authUser = requireUser(res)
  if (!authUser)
    return

  const { name, unitPreference } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'Name is required' })
    return
  }
  if (!unitPreferences.includes(unitPreference)) {
    res.status(400).json({ message: 'Invalid unit preference' })
    return
  }

  const userRepo = remult.repo(User)
  const user = await userRepo.findId(authUser.id)
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }

  user.name = name.trim()
  user.unitPreference = unitPreference
  await userRepo.save(user)
  res.json({ id: user.id, name: user.name, unitPreference: user.unitPreference })
})

router.post('/deactivate-account', async (req, res) => {
  const authUser = requireUser(res)
  if (!authUser)
    return

  const userRepo = remult.repo(User)
  const user = await userRepo.findId(authUser.id)
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }

  user.active = false
  await userRepo.save(user)

  try {
    await auth.api.revokeSessions({ headers: fromNodeHeaders(req.headers) })
  }
  catch {
    // best-effort: the account is already marked inactive and future
    // sign-ins are blocked regardless of whether this revoke succeeds
  }

  res.json({ success: true })
})

router.get('/export-data', async (req, res) => {
  const authUser = requireUser(res)
  if (!authUser)
    return

  const userFilter = { user: { $id: authUser.id } }

  const [locations, activityTemplates, logs, activities, logLocations] = await Promise.all([
    remult.repo(Location).find({ where: userFilter }),
    remult.repo(ActivityTemplate).find({ where: userFilter }),
    remult.repo(Log).find({ where: userFilter }),
    remult.repo(Activity).find({ where: userFilter, include: { template: true, log: true } }),
    remult.repo(LogLocation).find({ where: userFilter, include: { log: true, location: true } }),
  ])

  const locationIdsByLogId = new Map<number, number[]>()
  for (const link of logLocations) {
    if (!link.log || !link.location)
      continue
    const existing = locationIdsByLogId.get(link.log.id) ?? []
    existing.push(link.location.id)
    locationIdsByLogId.set(link.log.id, existing)
  }

  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      locations: locations.map(l => ({
        id: l.id,
        name: l.name,
        notes: l.notes,
        type: l.type,
        address: l.address,
        city: l.city,
        state: l.state,
        country: l.country,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
      activityTemplates: activityTemplates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        unit: t.unit,
      })),
      logs: logs.map(l => ({
        id: l.id,
        name: l.name,
        description: l.description,
        weather: l.weather,
        dateStart: l.dateStart,
        dateEnd: l.dateEnd,
        locationIds: locationIdsByLogId.get(l.id) ?? [],
      })),
      activities: activities.map(a => ({
        id: a.id,
        value: a.value,
        templateId: a.template?.id ?? null,
        logId: a.log?.id ?? null,
      })),
    },
  }

  res.setHeader('Content-Disposition', `attachment; filename="camp-log-export-${new Date().toISOString().slice(0, 10)}.json"`)
  res.json(payload)
})

router.post('/import-data', async (req, res) => {
  const authUser = requireUser(res)
  if (!authUser)
    return

  const body = req.body
  if (!body || typeof body !== 'object' || !body.data) {
    res.status(400).json({ message: 'Invalid export file' })
    return
  }

  const {
    locations = [],
    activityTemplates = [],
    logs = [],
    activities = [],
  } = body.data

  const locationRepo = remult.repo(Location)
  const templateRepo = remult.repo(ActivityTemplate)
  const logRepo = remult.repo(Log)
  const activityRepo = remult.repo(Activity)
  const logLocationRepo = remult.repo(LogLocation)

  const locationIdMap = new Map<number, Location>()
  const templateIdMap = new Map<number, ActivityTemplate>()
  const logIdMap = new Map<number, Log>()

  const counts = { locations: 0, activityTemplates: 0, logs: 0, activities: 0, failed: 0 }

  for (const loc of locations) {
    try {
      const created = await locationRepo.insert({
        name: loc.name ?? '',
        notes: loc.notes ?? '',
        type: campTypes.includes(loc.type) ? loc.type : 'unknown',
        address: loc.address ?? '',
        city: loc.city ?? '',
        state: loc.state ?? '',
        country: loc.country ?? '',
        latitude: loc.latitude,
        longitude: loc.longitude,
      })
      if (typeof loc.id === 'number')
        locationIdMap.set(loc.id, created)
      counts.locations++
    }
    catch {
      counts.failed++
    }
  }

  for (const tmpl of activityTemplates) {
    try {
      const created = await templateRepo.insert({
        name: tmpl.name ?? '',
        description: tmpl.description ?? '',
        unit: tmpl.unit ?? '',
      })
      if (typeof tmpl.id === 'number')
        templateIdMap.set(tmpl.id, created)
      counts.activityTemplates++
    }
    catch {
      counts.failed++
    }
  }

  for (const log of logs) {
    try {
      const created = await logRepo.insert({
        name: log.name ?? '',
        description: log.description ?? '',
        weather: log.weather ?? '',
        dateStart: log.dateStart ? new Date(log.dateStart) : new Date(),
        dateEnd: log.dateEnd ? new Date(log.dateEnd) : undefined,
      })
      if (typeof log.id === 'number')
        logIdMap.set(log.id, created)
      counts.logs++

      // v2 exports carry locationIds (many-to-many); older v1 exports carry
      // a single locationId - support both so old export files still import.
      const locationIds: number[] = Array.isArray(log.locationIds)
        ? log.locationIds
        : (typeof log.locationId === 'number' ? [log.locationId] : [])
      for (const locationId of locationIds) {
        const location = locationIdMap.get(locationId)
        if (!location)
          continue
        await logLocationRepo.insert({ log: created, location })
      }
    }
    catch {
      counts.failed++
    }
  }

  for (const act of activities) {
    const template = act.templateId != null ? templateIdMap.get(act.templateId) : undefined
    const log = act.logId != null ? logIdMap.get(act.logId) : undefined
    if (!template || !log) {
      counts.failed++
      continue
    }
    try {
      await activityRepo.insert({ value: act.value ?? 0, template, log })
      counts.activities++
    }
    catch {
      counts.failed++
    }
  }

  res.json(counts)
})

export default router

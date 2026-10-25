import { Allow, BackendMethod, remult } from 'remult'
import { Activity } from '../models/Activity'
import { ActivityTemplate } from '../models/ActivityTemplate'
import { Location } from '../models/Location'
import { Log } from '../models/Log'
import { LogLocation } from '../models/LogLocation'

export interface LogActivityInput {
  templateId: number
  value: number
}

export interface LogInput {
  name: string
  description: string
  weather: string
  // Dates arrive at the backend as ISO strings (backend method args are
  // JSON-serialized) - resolveInput() turns them back into Dates.
  dateStart: Date
  dateEnd?: Date
  locationIds: number[]
  activities: LogActivityInput[]
}

// Validates a LogInput and loads the locations/templates it refers to,
// checking they all belong to the current user.
async function resolveInput(input: LogInput) {
  const userId = remult.user!.id

  if (!input.name?.trim())
    throw new Error('Name is required')
  const dateStart = new Date(input.dateStart)
  if (!input.dateStart || Number.isNaN(dateStart.getTime()))
    throw new Error('Start date is required')

  const locationIds = [...new Set(input.locationIds ?? [])]
  if (!locationIds.length)
    throw new Error('At least one location is required')
  const locations = await remult.repo(Location).find({ where: { id: locationIds, user: { $id: userId } } })
  if (locations.length !== locationIds.length)
    throw new Error('One or more of the selected locations no longer exist')

  // One value per activity type - the last one wins if a template repeats.
  const valueByTemplateId = new Map((input.activities ?? []).map(a => [a.templateId, Number(a.value) || 0]))
  const templateIds = [...valueByTemplateId.keys()]
  const templates = templateIds.length
    ? await remult.repo(ActivityTemplate).find({ where: { id: templateIds, user: { $id: userId } } })
    : []
  if (templates.length !== templateIds.length)
    throw new Error('One or more of the selected activities no longer exist')

  return {
    fields: {
      name: input.name,
      description: input.description ?? '',
      weather: input.weather ?? '',
      dateStart,
      dateEnd: input.dateEnd ? new Date(input.dateEnd) : undefined,
    },
    locations,
    activities: templates.map(template => ({ template, value: valueByTemplateId.get(template.id)! })),
  }
}

// Creating or editing a log touches several tables (the log, its location
// links, its activities). Doing that as one backend method runs it all in a
// single transaction, so a dropped connection can't leave a log half-saved.
export class LogController {
  @BackendMethod({ allowed: Allow.authenticated })
  static async createLog(input: LogInput): Promise<number> {
    const resolved = await resolveInput(input)

    const log = await remult.repo(Log).insert(resolved.fields)
    for (const location of resolved.locations)
      await remult.repo(LogLocation).insert({ log, location })
    for (const { template, value } of resolved.activities)
      await remult.repo(Activity).insert({ log, template, value })

    return log.id
  }

  @BackendMethod({ allowed: Allow.authenticated })
  static async updateLog(id: number, input: LogInput): Promise<void> {
    const logRepo = remult.repo(Log)
    const logLocationRepo = remult.repo(LogLocation)
    const activityRepo = remult.repo(Activity)

    const log = await logRepo.findFirst({ id, user: { $id: remult.user!.id } })
    if (!log)
      throw new Error('Log not found')
    const resolved = await resolveInput(input)

    Object.assign(log, resolved.fields)
    // Saving an undefined field leaves the column as it was, so clearing the
    // end date (a trip edited down to one day) needs an explicit null.
    log.dateEnd ??= null as unknown as undefined
    await logRepo.save(log)

    // Location links: keep the ones still selected, drop the rest (including
    // any pointing at a since-deleted location), then add the new ones.
    const wantedLocationIds = new Set(resolved.locations.map(l => l.id))
    const linkedLocationIds = new Set<number>()
    const links = await logLocationRepo.find({ where: { log: { $id: log.id } }, include: { location: true } })
    for (const link of links) {
      if (link.location && wantedLocationIds.has(link.location.id) && !linkedLocationIds.has(link.location.id))
        linkedLocationIds.add(link.location.id)
      else
        await logLocationRepo.delete(link)
    }
    for (const location of resolved.locations) {
      if (!linkedLocationIds.has(location.id))
        await logLocationRepo.insert({ log, location })
    }

    // Activities, matched up by template the same way.
    const wantedValues = new Map(resolved.activities.map(a => [a.template.id, a.value]))
    const recordedTemplateIds = new Set<number>()
    const activities = await activityRepo.find({ where: { log: { $id: log.id } }, include: { template: true } })
    for (const activity of activities) {
      const templateId = activity.template?.id
      if (templateId === undefined || !wantedValues.has(templateId) || recordedTemplateIds.has(templateId)) {
        await activityRepo.delete(activity)
        continue
      }
      recordedTemplateIds.add(templateId)
      const value = wantedValues.get(templateId)!
      if (activity.value !== value)
        await activityRepo.update(activity.id, { value })
    }
    for (const { template, value } of resolved.activities) {
      if (!recordedTemplateIds.has(template.id))
        await activityRepo.insert({ log, template, value })
    }
  }
}

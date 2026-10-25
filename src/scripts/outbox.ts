import type { DBSchema } from 'idb'
import { openDB } from 'idb'
import { ref } from 'vue'

export type PendingEntity = 'log' | 'location'

export interface PendingRecord {
  id: string
  entity: PendingEntity
  payload: Record<string, unknown>
  createdAt: number
  status: 'pending' | 'failed'
  error?: string
}

interface OutboxDB extends DBSchema {
  pending: {
    key: string
    value: PendingRecord
  }
}

const dbPromise = openDB<OutboxDB>('camp-log-outbox', 1, {
  upgrade(db) {
    db.createObjectStore('pending', { keyPath: 'id' })
  },
})

export const pendingItems = ref<PendingRecord[]>([])

export async function refreshPending() {
  const db = await dbPromise
  pendingItems.value = await db.getAll('pending')
}

export async function queueMutation(entity: PendingEntity, payload: Record<string, unknown>) {
  const db = await dbPromise
  const record: PendingRecord = {
    id: crypto.randomUUID(),
    entity,
    payload,
    createdAt: Date.now(),
    status: 'pending',
  }
  await db.put('pending', record)
  await refreshPending()
  return record
}

export async function removePending(id: string) {
  const db = await dbPromise
  await db.delete('pending', id)
  await refreshPending()
}

// A queued log can link to a queued location by its outbox id
// (`pendingLocationIds`). Once that location syncs, swap in its real id - or,
// if it's discarded instead (realId null), drop the link.
export async function resolvePendingLocation(pendingId: string, realId: number | null) {
  const db = await dbPromise
  for (const record of await db.getAll('pending')) {
    const pendingIds = record.payload.pendingLocationIds as string[] | undefined
    if (record.entity !== 'log' || !pendingIds?.includes(pendingId))
      continue
    record.payload.pendingLocationIds = pendingIds.filter(id => id !== pendingId)
    if (realId !== null)
      record.payload.locationIds = [...(record.payload.locationIds as number[] | undefined ?? []), realId]
    await db.put('pending', record)
  }
  await refreshPending()
}

export async function clearOutbox() {
  const db = await dbPromise
  await db.clear('pending')
  await refreshPending()
}

export async function markFailed(id: string, error: string) {
  const db = await dbPromise
  const record = await db.get('pending', id)
  if (!record)
    return
  record.status = 'failed'
  record.error = error
  await db.put('pending', record)
  await refreshPending()
}

export async function retryPending(id: string) {
  const db = await dbPromise
  const record = await db.get('pending', id)
  if (!record)
    return
  record.status = 'pending'
  record.error = undefined
  await db.put('pending', record)
  await refreshPending()
}

export function isNetworkError(err: unknown) {
  return err instanceof TypeError
}

// The server's explanation for a failed remult call, if it gave one - remult
// throws HTTP errors as plain `{ message, status }` objects, not Error
// instances. Undefined for network failures ("Failed to fetch" helps no-one).
export function serverErrorMessage(err: unknown): string | undefined {
  if (isNetworkError(err))
    return undefined
  return (err as { message?: string } | undefined)?.message
}

// A snackbar message for a failed request, e.g. describeFailure('delete log', err).
export function describeFailure(action: string, err: unknown) {
  if (isNetworkError(err))
    return `Failed to ${action}: you’re offline. Try again when you have a connection.`
  const message = serverErrorMessage(err)
  return message ? `Failed to ${action}: ${message}` : `Failed to ${action}. Please try again.`
}

refreshPending()

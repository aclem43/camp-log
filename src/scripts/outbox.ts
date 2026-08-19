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

refreshPending()

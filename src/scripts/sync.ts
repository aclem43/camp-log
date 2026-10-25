import { remult } from 'remult'
import { showAlert } from './alert'
import { isNetworkError, markFailed, pendingItems, removePending, serverErrorMessage } from './outbox'
import { LogController, type LogInput } from '@/shared/controllers/LogController'
import { Location } from '@/shared/models/Location'
import { offline } from '@/scripts/connectivity'
import { checkLogin } from '@/scripts/user'

let syncing = false

export async function syncOutbox() {
  if (syncing || offline.value || !checkLogin())
    return

  syncing = true
  try {
    const items = pendingItems.value.filter(item => item.status === 'pending')
    for (const item of items) {
      try {
        if (item.entity === 'log') {
          // Logs queued before activities could be saved offline have no
          // `activities` key.
          const payload = item.payload as Partial<LogInput>
          await LogController.createLog({
            ...payload,
            locationIds: payload.locationIds ?? [],
            activities: payload.activities ?? [],
          } as LogInput)
        }
        else {
          await remult.repo(Location).insert(item.payload as Partial<Location>)
        }
        await removePending(item.id)
      }
      catch (err) {
        if (isNetworkError(err)) {
          // still offline, or the request couldn't reach the server — stop and retry later
          return
        }
        await markFailed(item.id, serverErrorMessage(err) ?? 'Sync failed')
        showAlert(`A saved ${item.entity} couldn't be synced — see the pending item to retry or discard it.`)
      }
    }
  }
  finally {
    syncing = false
  }
}

export function initSync() {
  window.addEventListener('online', () => syncOutbox())
  window.addEventListener('focus', () => syncOutbox())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      syncOutbox()
  })
  syncOutbox()
}

import { remult } from 'remult'
import { Location } from '@/shared/models/Location'
import { Log } from '@/shared/models/Log'
import { offline } from '@/scripts/connectivity'
import { checkLogin } from '@/scripts/user'
import { showAlert } from './alert'
import { isNetworkError, markFailed, pendingItems, removePending } from './outbox'

let syncing = false

export async function syncOutbox() {
  if (syncing || offline.value || !checkLogin())
    return

  syncing = true
  try {
    const items = pendingItems.value.filter(item => item.status === 'pending')
    for (const item of items) {
      try {
        if (item.entity === 'log')
          await remult.repo(Log).insert(item.payload as Partial<Log>)
        else
          await remult.repo(Location).insert(item.payload as Partial<Location>)
        await removePending(item.id)
      }
      catch (err) {
        if (isNetworkError(err)) {
          // still offline, or the request couldn't reach the server — stop and retry later
          return
        }
        await markFailed(item.id, err instanceof Error ? err.message : 'Sync failed')
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

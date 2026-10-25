import { useEventListener } from '@vueuse/core'
import { onBeforeRouteLeave } from 'vue-router'
import { askConfirm } from './confirm'

// Asks before leaving a form with unsaved edits - in the app (route change)
// or by closing/reloading the tab (the browser's own prompt).
export function useUnsavedChanges(isDirty: () => boolean) {
  onBeforeRouteLeave(async () => {
    if (!isDirty())
      return true
    return askConfirm('You have unsaved changes. Leave this page and discard them?', {
      title: 'Unsaved changes',
      confirmText: 'Discard',
      cancelText: 'Keep Editing',
      color: 'warning',
    })
  })

  useEventListener(window, 'beforeunload', (event) => {
    if (isDirty())
      event.preventDefault()
  })
}

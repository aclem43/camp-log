import { useOnline } from '@vueuse/core'
import { ref, watch } from 'vue'

const browserOnline = useOnline()

// navigator.onLine (what useOnline tracks) only reflects whether the OS
// thinks a network adapter is up — it has well-known false negatives (VPNs,
// captive portals, Windows flagging a working connection as "no internet
// access"). Only trust "offline" once an actual request also fails.
export const offline = ref(false)

async function probe(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch('/api/version', { cache: 'no-store', signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  }
  catch {
    return false
  }
}

async function recheck() {
  if (browserOnline.value) {
    offline.value = false
    return
  }
  offline.value = !(await probe())
}

watch(browserOnline, recheck, { immediate: true })
setInterval(recheck, 15_000)

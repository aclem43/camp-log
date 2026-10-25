import type { LocationQuery, LocationQueryValue } from 'vue-router'
import type { WritableComputedRef } from 'vue'
import { computed, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// The query as last set, until the navigation applying it finishes. Changes
// build on it rather than on route.query, which only updates once the
// navigation is done - otherwise two changes in a row (a new search, then the
// page reset it triggers) would each start from the old query and undo one
// another. Reactive, so a field shows its new value straight away.
const pending = shallowRef<LocationQuery | null>(null)

type QueryValue = string | number | boolean | string[]

function parse<T extends QueryValue>(raw: LocationQueryValue | LocationQueryValue[] | undefined, defaultValue: T): T {
  if (typeof raw !== 'string')
    return defaultValue
  if (typeof defaultValue === 'number') {
    const value = Number(raw)
    return (Number.isFinite(value) ? value : defaultValue) as T
  }
  if (typeof defaultValue === 'boolean')
    return (raw === '1') as T
  if (Array.isArray(defaultValue))
    return (raw ? raw.split(',') : []) as T
  return raw as T
}

function serialize(value: QueryValue): string {
  if (typeof value === 'boolean')
    return value ? '1' : '0'
  if (Array.isArray(value))
    return value.join(',')
  return String(value)
}

// A ref kept in the URL's query string, so back/forward and reload keep it.
// The default is left out of the URL, and decides how the value is parsed.
export function useRouteQuery(key: string, defaultValue: number): WritableComputedRef<number>
export function useRouteQuery(key: string, defaultValue: boolean): WritableComputedRef<boolean>
export function useRouteQuery(key: string, defaultValue: string[]): WritableComputedRef<string[]>
export function useRouteQuery(key: string, defaultValue: string): WritableComputedRef<string>
// For a string union, given explicitly: useRouteQuery<SortOrder>('sort', 'dateDesc')
export function useRouteQuery<T extends string>(key: string, defaultValue: T): WritableComputedRef<T>
export function useRouteQuery<T extends QueryValue>(key: string, defaultValue: T) {
  const route = useRoute()
  const router = useRouter()
  const routeName = route.name

  return computed<T>({
    get: () => parse((pending.value ?? route.query)[key], defaultValue),
    set: (value) => {
      // A kept-alive view setting its state after the user has moved on
      // mustn't rewrite another page's URL.
      if (route.name !== routeName)
        return
      const isDefault = serialize(value ?? defaultValue) === serialize(defaultValue)
      const query: LocationQuery = { ...(pending.value ?? route.query) }
      if (isDefault)
        delete query[key]
      else
        query[key] = serialize(value)
      pending.value = query
      router.replace({ query }).finally(() => {
        if (pending.value === query)
          pending.value = null
      })
    },
  })
}

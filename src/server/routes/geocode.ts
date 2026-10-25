import { Router } from 'express'
import { proc } from '../config'
import { asyncHandler, requireUser } from '../http'

const router: Router = Router()

interface GeocodeResult {
  address: string
  info: {
    city?: string
    state?: string
    country?: string
  }
  latitude: number
  longitude: number
}

// Least-recently-used cache: a Map iterates in insertion order, so re-inserting
// on every hit keeps the oldest entry first, ready to be evicted.
const CACHE_LIMIT = 1000
const cache = new Map<string, GeocodeResult>()

function getCached(key: string) {
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
  }
  return hit
}

function setCached(key: string, value: GeocodeResult) {
  cache.set(key, value)
  if (cache.size > CACHE_LIMIT)
    cache.delete(cache.keys().next().value!)
}

router.post('/geocode', asyncHandler(async (req, res) => {
  if (!requireUser(res))
    return

  const { address, latitude, longitude } = req.body ?? {}

  const isReverse = typeof latitude === 'number' && typeof longitude === 'number'

  if (!isReverse && (typeof address !== 'string' || !address.trim())) {
    res.status(400).json({ message: 'Address is required' })
    return
  }

  const query = isReverse ? `${latitude}+${longitude}` : address.trim()
  const cacheKey = isReverse ? `rev:${latitude.toFixed(5)},${longitude.toFixed(5)}` : `fwd:${query.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  const apiKey = proc.env.OPENCAGE_API_KEY
  if (!apiKey) {
    console.error('Geocode request rejected: OPENCAGE_API_KEY is not set')
    res.status(503).json({ message: 'Address lookup isn\'t configured on this server' })
    return
  }

  try {
    const resp = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}`)

    if (!resp.ok) {
      console.error(`OpenCage request failed: ${resp.status} ${resp.statusText}`)
      res.status(502).json({ message: 'Geocoding service unavailable' })
      return
    }

    const result = await resp.json()

    if (result.results && result.results.length > 0) {
      const { lat, lng } = result.results[0].geometry
      const components = result.results[0].components

      const geocodeResult: GeocodeResult = {
        address: isReverse ? (result.results[0].formatted ?? query) : address,
        info: {
          city: components.city ?? components.town ?? components.village ?? components.county,
          state: components.state,
          country: components.country,
        },
        latitude: isReverse ? latitude : lat,
        longitude: isReverse ? longitude : lng,
      }

      setCached(cacheKey, geocodeResult)
      res.json(geocodeResult)
    }
    else {
      res.status(404).json({ message: isReverse ? 'Location not found' : 'Address not found' })
    }
  }
  catch (err) {
    console.error('Geocode request error:', err)
    res.status(502).json({ message: 'Geocoding service unavailable' })
  }
}))

export default router

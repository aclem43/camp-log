import { Router } from 'express'
import { proc } from '../config'

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

const cache = new Map<string, GeocodeResult>()

router.post('/geocode', async (req, res) => {
  const { address, latitude, longitude } = req.body

  const isReverse = typeof latitude === 'number' && typeof longitude === 'number'

  if (!isReverse && (typeof address !== 'string' || !address.trim())) {
    res.status(400).json({ message: 'Address is required' })
    return
  }

  const query = isReverse ? `${latitude}+${longitude}` : address.trim()
  const cacheKey = isReverse ? `rev:${latitude.toFixed(5)},${longitude.toFixed(5)}` : `fwd:${query.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  const apiKey = proc.env.OPENCAGE_API_KEY

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

      cache.set(cacheKey, geocodeResult)
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
})

export default router

import { Router } from "express"

const router: Router = Router()

router.post('/geocode',async (req, res) => {
    const { address } = req.body
  // Implement geocoding logic here
  const apiKey = process.env.OPENCAGE_API_KEY
  const resp = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}`)
  const result = await resp.json()
  if (result.results && result.results.length > 0) {
    const { lat, lng } = result.results[0].geometry
    res.json({ message: 'Geocode endpoint', address,info:{
      city: result.results[0].components.city,
      state: result.results[0].components.state,
      country: result.results[0].components.country,
    }, latitude: lat, longitude: lng })
  } else {
    res.status(404).json({ message: 'Address not found' })
  }
})

export default router
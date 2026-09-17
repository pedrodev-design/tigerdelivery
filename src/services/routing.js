const routingBase = (import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '')
const cache = new Map()

const validPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
const pointKey = point => point.map(value => Number(value).toFixed(5)).join(',')

export async function getDrivingRoute(points, signal) {
  const safePoints = points.filter(validPoint)
  if (safePoints.length < 2) return null
  const key = safePoints.map(pointKey).join(';')
  if (cache.has(key)) return cache.get(key)
  const coordinates = safePoints.map(([lat, lng]) => `${lng},${lat}`).join(';')
  const response = await fetch(`${routingBase}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('route_unavailable')
  const payload = await response.json()
  if (payload.code !== 'Ok' || !payload.routes?.[0]) throw new Error('route_not_found')
  const result = {
    geometry: payload.routes[0].geometry,
    distance: Math.round(payload.routes[0].distance),
    duration: Math.round(payload.routes[0].duration),
  }
  cache.set(key, result)
  return result
}

export function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`
}


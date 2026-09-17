import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './DeliveryMap.module.css'

const rasterStyle = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 512,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f3f2ed' } },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-saturation': -0.28, 'raster-contrast': 0.02, 'raster-brightness-min': 0.08, 'raster-brightness-max': 0.98 } },
  ],
}

const emptyLine = { type: 'FeatureCollection', features: [] }
const validPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
const lngLat = point => [point[1], point[0]]
const markerAnimations = new WeakMap()

function moveMarker(marker, target, animated) {
  if (!animated) { marker.setLngLat(target); return }
  const previousFrame = markerAnimations.get(marker)
  if (previousFrame) cancelAnimationFrame(previousFrame)
  const from = marker.getLngLat()
  const startedAt = performance.now()
  const tick = now => {
    const progress = Math.min(1, (now - startedAt) / 700)
    const eased = 1 - Math.pow(1 - progress, 3)
    marker.setLngLat([from.lng + (target[0] - from.lng) * eased, from.lat + (target[1] - from.lat) * eased])
    if (progress < 1) markerAnimations.set(marker, requestAnimationFrame(tick))
    else markerAnimations.delete(marker)
  }
  markerAnimations.set(marker, requestAnimationFrame(tick))
}

function makeMarker(kind, label) {
  const element = document.createElement('div')
  element.className = `${styles.marker} ${styles[kind]}`
  element.setAttribute('aria-label', label)
  element.innerHTML = kind === 'driver' ? '<span>➤</span>' : kind === 'store' ? '<span>●</span>' : '<span></span>'
  return element
}

function updateMarker(markerRef, map, point, kind, label) {
  if (!validPoint(point)) {
    markerRef.current?.remove()
    markerRef.current = null
    return
  }
  if (!markerRef.current) markerRef.current = new maplibregl.Marker({ element: makeMarker(kind, label), anchor: 'center' }).setLngLat(lngLat(point)).addTo(map)
  else moveMarker(markerRef.current, lngLat(point), kind === 'driver')
}

export function DeliveryMap({
  center,
  zoom = 16,
  interactive = true,
  onCenterChange,
  userLocation,
  accuracy = 0,
  driverLocation,
  storeLocation,
  destination,
  route,
  className = '',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const callbacksRef = useRef({ onCenterChange })
  const markers = useRef({ user: null, driver: null, store: null, destination: null })
  const [initialCenter] = useState(() => validPoint(center) ? lngLat(center) : [-46.633308, -23.55052])

  useEffect(() => { callbacksRef.current.onCenterChange = onCenterChange }, [onCenterChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterStyle,
      center: initialCenter,
      zoom,
      minZoom: 3,
      maxZoom: 20,
      attributionControl: false,
      dragPan: interactive,
      scrollZoom: interactive,
      doubleClickZoom: interactive,
      touchZoomRotate: interactive,
      keyboard: interactive,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: emptyLine })
      map.addLayer({ id: 'route-shadow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': .9 } })
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#24241f', 'line-width': 5 } })
      map.addSource('accuracy', { type: 'geojson', data: emptyLine })
      map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#3278f6', 'fill-opacity': .1 } })
    })
    const emitCenter = () => {
      const next = map.getCenter()
      callbacksRef.current.onCenterChange?.([next.lat, next.lng])
    }
    if (interactive) map.on('moveend', emitCenter)
    mapRef.current = map
    const markerRegistry = markers.current
    return () => {
      Object.values(markerRegistry).forEach(marker => marker?.remove())
      map.remove()
      mapRef.current = null
    }
  }, [initialCenter, interactive, zoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !validPoint(center)) return
    const current = map.getCenter()
    if (Math.abs(current.lat - center[0]) > .00002 || Math.abs(current.lng - center[1]) > .00002) map.easeTo({ center: lngLat(center), duration: 420 })
  }, [center])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const set = (key, point, kind, label) => {
      const ref = { current: markers.current[key] }
      updateMarker(ref, map, point, kind, label)
      markers.current[key] = ref.current
    }
    set('driver', driverLocation, 'driver', 'Motorista')
    set('store', storeLocation, 'store', 'Loja')
    set('destination', destination, 'destination', 'Destino')
  }, [destination, driverLocation, storeLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ref = { current: markers.current.user }
    updateMarker(ref, map, userLocation, 'user', 'Sua localização')
    markers.current.user = ref.current
  }, [userLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const source = map.getSource('route')
      if (!source) return
      source.setData(route?.type === 'Feature' ? route : route?.type === 'LineString' ? { type: 'Feature', properties: {}, geometry: route } : emptyLine)
    }
    if (map.loaded()) apply()
    else map.once('load', apply)
  }, [route])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !validPoint(userLocation)) return
    const apply = () => {
      const source = map.getSource('accuracy')
      if (!source) return
      const radius = Math.min(Math.max(Number(accuracy) || 35, 20), 500)
      const [lat, lon] = userLocation
      const points = Array.from({ length: 49 }, (_, index) => {
        const angle = index / 48 * Math.PI * 2
        const dx = radius * Math.cos(angle), dy = radius * Math.sin(angle)
        return [lon + dx / (111320 * Math.cos(lat * Math.PI / 180)), lat + dy / 110540]
      })
      source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [points] } })
    }
    if (map.loaded()) apply()
    else map.once('load', apply)
  }, [accuracy, userLocation])

  return <div className={`${styles.map} ${className}`} ref={containerRef} />
}

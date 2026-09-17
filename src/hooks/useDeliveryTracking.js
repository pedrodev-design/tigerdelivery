import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getDrivingRoute } from '../services/routing'

const pointFromAddress = address => {
  if (Array.isArray(address?.point) && address.point.length === 2) return address.point.map(Number)
  const lat = Number(address?.latitude), lng = Number(address?.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

export function useDeliveryTracking(order) {
  const [driver, setDriver] = useState(null)
  const [route, setRoute] = useState(null)
  const [routeMeta, setRouteMeta] = useState(null)
  const destination = useMemo(() => pointFromAddress(order.delivery_address), [order.delivery_address])
  const store = useMemo(() => {
    const lat = Number(order.stores?.latitude), lng = Number(order.stores?.longitude)
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
  }, [order.stores?.latitude, order.stores?.longitude])

  useEffect(() => {
    if (!order.driver_id || ['delivered', 'cancelled'].includes(order.status)) return undefined
    let active = true
    const load = async () => {
      const { data } = await supabase.from('driver_locations').select('latitude, longitude, accuracy_m, heading, speed_mps, last_location_update').eq('driver_id', order.driver_id).maybeSingle()
      if (active && data && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) setDriver(data)
    }
    load()
    const channel = supabase.channel(`customer-driver-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${order.driver_id}` }, payload => {
        const next = payload.new
        if (Number.isFinite(next.latitude) && Number.isFinite(next.longitude)) setDriver(next)
      })
      .subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [order.driver_id, order.id, order.status])

  const driverPoint = useMemo(() => driver ? [Number(driver.latitude), Number(driver.longitude)] : null, [driver])
  const routeTarget = order.status === 'picked_up' ? destination : store

  useEffect(() => {
    if (!driverPoint || !routeTarget || ['delivered', 'cancelled'].includes(order.status)) return undefined
    const controller = new AbortController()
    getDrivingRoute([driverPoint, routeTarget], controller.signal)
      .then(result => { if (result) { setRoute(result.geometry); setRouteMeta({ distance: result.distance, duration: result.duration }) } })
      .catch(error => { if (error.name !== 'AbortError') { setRoute(null); setRouteMeta(null) } })
    return () => controller.abort()
  }, [driverPoint, order.status, routeTarget])

  return { driver, driverPoint, destination, store, route, routeMeta }
}

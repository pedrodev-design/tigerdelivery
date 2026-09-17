import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const permissionMessage = error => {
  if (error?.code === 1) return 'Ative a localização do navegador para ficar online.'
  if (error?.code === 2) return 'Não conseguimos localizar você. Verifique o GPS.'
  if (error?.code === 3) return 'O GPS demorou para responder. Tente novamente.'
  return 'Não foi possível iniciar sua localização.'
}

export function useDriverTracking(driverId) {
  const [online, setOnline] = useState(false)
  const [location, setLocation] = useState(null)
  const [error, setError] = useState('')
  const [changing, setChanging] = useState(false)
  const watchId = useRef(null)
  const lastSentAt = useRef(0)

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  const sendLocation = useCallback(async position => {
    const next = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    }
    setLocation(next)
    const now = Date.now()
    if (now - lastSentAt.current < 4000) return
    lastSentAt.current = now
    const { error: updateError } = await supabase.rpc('update_driver_location', {
      p_latitude: next.latitude,
      p_longitude: next.longitude,
      p_accuracy_m: next.accuracy,
      p_heading: next.heading,
      p_speed_mps: next.speed,
    })
    if (updateError && !updateError.message.includes('driver_is_offline')) setError('O GPS está ativo, mas não conseguimos atualizar sua posição.')
  }, [])

  const startWatch = useCallback(() => {
    stopWatch()
    if (!navigator.geolocation) { setError('Localização indisponível neste navegador.'); return }
    watchId.current = navigator.geolocation.watchPosition(sendLocation, failure => setError(permissionMessage(failure)), {
      enableHighAccuracy: true,
      maximumAge: 2500,
      timeout: 12000,
    })
  }, [sendLocation, stopWatch])

  useEffect(() => {
    if (!driverId) return undefined
    let cancelled = false
    supabase.from('driver_locations').select('is_online, latitude, longitude, accuracy_m').eq('driver_id', driverId).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return
      setOnline(Boolean(data.is_online))
      if (Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) setLocation({ latitude: data.latitude, longitude: data.longitude, accuracy: data.accuracy_m })
      if (data.is_online) startWatch()
    })
    return () => { cancelled = true; stopWatch() }
  }, [driverId, startWatch, stopWatch])

  const setAvailability = useCallback(async next => {
    if (changing) return false
    setChanging(true)
    setError('')
    if (!next) {
      const { error: rpcError } = await supabase.rpc('set_driver_availability', { p_is_online: false })
      setChanging(false)
      if (rpcError) { setError(rpcError.message.includes('active_delivery') ? 'Finalize a entrega atual antes de ficar offline.' : 'Não foi possível ficar offline.'); return false }
      stopWatch()
      setOnline(false)
      return true
    }
    if (!navigator.geolocation) { setChanging(false); setError('Localização indisponível neste navegador.'); return false }
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(async position => {
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, heading: position.coords.heading, speed: position.coords.speed }
      const { error: rpcError } = await supabase.rpc('set_driver_availability', {
        p_is_online: true,
        p_latitude: nextLocation.latitude,
        p_longitude: nextLocation.longitude,
        p_accuracy_m: nextLocation.accuracy,
      })
      setChanging(false)
      if (rpcError) { setError('Não foi possível ficar online agora.'); resolve(false); return }
      setLocation(nextLocation)
      setOnline(true)
      lastSentAt.current = Date.now()
      startWatch()
      resolve(true)
    }, failure => {
      setChanging(false)
      setError(permissionMessage(failure))
      resolve(false)
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }))
  }, [changing, startWatch, stopWatch])

  return { online, location, error, changing, setAvailability }
}


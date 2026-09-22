const highAccuracyOptions = {
  enableHighAccuracy: true,
  maximumAge: 15000,
  timeout: 12000,
}

const reliableOptions = {
  enableHighAccuracy: false,
  maximumAge: 120000,
  timeout: 20000,
}

export function geolocationMessage(error) {
  if (!window.isSecureContext) return 'A localização só funciona em uma conexão segura (HTTPS).'
  if (error?.code === 'unsupported') return 'Este navegador não oferece acesso à localização.'
  if (error?.code === 1) return 'A localização está bloqueada. Libere o acesso nas permissões do navegador.'
  if (error?.code === 2) return 'O celular não encontrou sua posição. Ative o GPS e tente novamente em um local aberto.'
  if (error?.code === 3) return 'O GPS demorou para responder. Confira se a localização do celular está ativada.'
  return 'Não foi possível iniciar sua localização agora.'
}

function readPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getBestPosition() {
  if (!window.isSecureContext) throw Object.assign(new Error('insecure_context'), { code: 'insecure' })
  if (!navigator.geolocation) throw Object.assign(new Error('unsupported'), { code: 'unsupported' })

  try {
    return await readPosition(highAccuracyOptions)
  } catch (error) {
    if (error?.code === 1) throw error
    return readPosition(reliableOptions)
  }
}

export function watchBestPosition(onPosition, onError) {
  if (!window.isSecureContext || !navigator.geolocation) {
    onError?.(Object.assign(new Error('unsupported'), { code: 'unsupported' }))
    return () => {}
  }

  let watchId = null
  let stopped = false
  let usingFallback = false

  const begin = options => {
    watchId = navigator.geolocation.watchPosition(
      position => {
        if (!stopped) onPosition(position)
      },
      error => {
        if (!stopped && !usingFallback && error?.code !== 1) {
          usingFallback = true
          if (watchId !== null) navigator.geolocation.clearWatch(watchId)
          begin(reliableOptions)
          return
        }
        if (!stopped) onError?.(error)
      },
      options,
    )
  }

  begin(highAccuracyOptions)
  return () => {
    stopped = true
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  }
}

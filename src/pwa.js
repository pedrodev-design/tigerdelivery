let deferredPrompt = null
let initialized = false
const listeners = new Set()

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)

let snapshot = {
  canInstall: !isStandalone(),
  installed: isStandalone(),
  manualIos: isIos() && !isStandalone(),
}

const publish = patch => {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach(listener => listener())
}

export const subscribePwaInstall = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getPwaInstallSnapshot = () => snapshot

export async function requestPwaInstall() {
  if (snapshot.manualIos && !deferredPrompt) return { outcome: 'manual-ios' }
  if (!deferredPrompt) return { outcome: 'unavailable' }

  const prompt = deferredPrompt
  deferredPrompt = null
  await prompt.prompt()
  const choice = await prompt.userChoice
  publish({ canInstall: false })
  return choice
}

export function initializePwa() {
  if (initialized) return
  initialized = true

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event
    publish({ canInstall: true, manualIos: false })
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    publish({ canInstall: false, installed: true, manualIos: false })
  })

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

const CACHE_VERSION = 'tigredelivery-v3'
const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('tigredelivery-') && key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async response => {
          const cache = await caches.open(CACHE_VERSION)
          await cache.put(request, response.clone())
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || caches.match('/offline.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION)
            await cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

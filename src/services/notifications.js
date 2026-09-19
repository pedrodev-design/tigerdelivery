import notificationSound from '../assets/sounds/notification.wav'

export async function playNotificationSound() {
  const audio = new Audio(notificationSound)
  audio.volume = 0.9
  try {
    await audio.play()
    return true
  } catch {
    return false
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export async function showSystemNotification({ title, body, tag = 'tigredelivery-admin' }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false

  const options = {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag,
    renotify: true,
    vibrate: [180, 90, 180],
    data: { url: '/#admin' },
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, options)
      } else {
        new Notification(title, options)
      }
    } else {
      new Notification(title, options)
    }
    return true
  } catch {
    return false
  }
}

export async function deliverAdminNotification(notification) {
  const [sound, system] = await Promise.all([
    playNotificationSound(),
    showSystemNotification(notification),
  ])
  return { sound, system }
}

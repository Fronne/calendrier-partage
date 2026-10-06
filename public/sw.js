// Service worker : garde l'application disponible hors ligne et affiche les rappels reçus.
const CACHE = 'calendrier-v1'
// En développement local on ne met rien en cache, pour toujours voir la dernière version
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (DEV || req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      // Page : réseau d'abord, copie locale si pas de connexion
      if (req.mode === 'navigate') {
        try {
          const res = await fetch(req)
          if (res.ok) cache.put('/', res.clone())
          return res
        } catch {
          return (await cache.match('/')) || Response.error()
        }
      }
      // Fichiers de l'app : copie locale tout de suite, mise à jour en arrière-plan
      const hit = await cache.match(req)
      const fresh = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone())
        return res
      })
      if (!hit) return fresh
      fresh.catch(() => {})
      return hit
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Calendrier partagé', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.length) return windows[0].focus()
      return self.clients.openWindow('/')
    })(),
  )
})

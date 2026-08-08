/**
 * Service Worker: macht den Kalender offline benutzbar.
 *
 * Bewusst ohne Build-Werkzeug und ohne vorgefertigte Liste zu cachender
 * Dateien. Die Dateinamen der Bündel tragen einen Hash, den eine statische
 * Datei nicht kennen kann — eine von Hand gepflegte Liste wäre nach dem
 * nächsten Build falsch, und zwar lautlos. Stattdessen wird gecacht, was
 * tatsächlich abgerufen wird, mit je nach Art unterschiedlicher Strategie:
 *
 *   HTML          Netz zuerst — sonst hinge man auf einer alten Fassung fest.
 *   /assets/…     Cache zuerst — die Namen tragen einen Hash, sie ändern sich nie.
 *   /data/…       Cache sofort, Netz im Hintergrund. Termine dürfen eine
 *                 Minute alt sein; wichtiger ist, dass überhaupt etwas dasteht.
 *   Bilder        wie /assets/, aber getrennt, damit sie eigen begrenzt sind.
 *
 * Die Version im Cache-Namen ist der Aufräumschalter: Sie zu erhöhen wirft
 * beim nächsten Start alles Alte weg.
 */
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const DATA = `data-${VERSION}`
const MEDIA = `media-${VERSION}`
const KEEP = [SHELL, DATA, MEDIA]

self.addEventListener('install', (event) => {
  // Die Startseite vorab holen, damit der allererste Offline-Start klappt.
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest']))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** Cache zuerst, Netz nur beim ersten Mal. Für unveränderliche Adressen. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

/** Sofort aus dem Cache antworten und parallel auffrischen. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return hit ?? (await fresh) ?? Response.error()
}

/** Netz zuerst, Cache als Rettung. Für Seiten, die aktuell sein sollen. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const hit = await cache.match(request)
    // Ohne Netz und ohne Kopie: die Startseite ist besser als ein Fehler.
    return hit ?? (await cache.match('/')) ?? Promise.reject(err)
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Fremde Server bleiben unberührt — Cover liegen beim AniList-CDN, und der
  // Newsletter-Worker darf keine Antwort aus der Konserve bekommen.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL))
    return
  }
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request, DATA))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL))
    return
  }
  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/og/')) {
    event.respondWith(cacheFirst(request, MEDIA))
  }
})

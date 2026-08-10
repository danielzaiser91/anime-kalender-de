/**
 * Service Worker: macht den Kalender offline benutzbar.
 *
 * Bewusst ohne Build-Werkzeug und ohne von Hand gepflegte Dateiliste. Die
 * Bündelnamen tragen einen Hash, eine feste Liste wäre nach dem nächsten Build
 * falsch — und zwar lautlos. Stattdessen liest der Worker beim Einrichten die
 * ausgelieferte `index.html` und zieht die Adressen daraus.
 *
 * Strategien:
 *   HTML          Netz zuerst, aber mit Zeitlimit — sonst hängt die App an
 *                 einer toten Verbindung, statt die Kopie zu nehmen.
 *   /assets/…     Cache zuerst. Die Namen tragen einen Hash, sie ändern sich nie.
 *   /data/…       Cache sofort, Netz im Hintergrund. Termine dürfen eine Minute
 *                 alt sein; wichtiger ist, dass überhaupt etwas dasteht.
 *   Cover         Cache zuerst, auch vom fremden CDN. Die App legt die Bilder
 *                 der aktuellen und nächsten Woche selbst hier ab.
 *
 * Die Version im Cache-Namen ist der Aufräumschalter: Sie zu erhöhen wirft
 * beim nächsten Start alles Alte weg.
 */
const VERSION = 'v3'
const SHELL = `shell-${VERSION}`
const DATA = `data-${VERSION}`
const MEDIA = `media-${VERSION}`
const KEEP = [SHELL, DATA, MEDIA]

/** Wie lange auf das Netz gewartet wird, bevor die Kopie gewinnt. */
const NETWORK_TIMEOUT_MS = 3000

/** Die Dateien, ohne die der Kalender nichts anzeigen kann. */
const DATA_FILES = [
  '/data/meta.json',
  '/data/events.json',
  '/data/releases.json',
  '/data/titles-core.json',
]

/** Bildquellen, die wir mitcachen dürfen — sonst bliebe jede Kachel grau. */
function isCoverHost(url) {
  return /(^|\.)anilist\.co$/.test(url.hostname)
}

/**
 * Alles einsammeln, was für einen Kaltstart ohne Netz nötig ist.
 *
 * Der Grund für diesen Aufwand: Vorher wurde nur die Startseite vorab geholt,
 * die Bündel landeten erst im Cache, wenn sie einmal durch den Worker gelaufen
 * waren — also ab dem **zweiten** Besuch. Wer die App installierte und ohne
 * weiteres Laden aus dem WLAN ging, bekam eine leere Seite. Genau so passiert.
 */
async function precache() {
  const shell = await caches.open(SHELL)
  await shell.addAll(['/', '/manifest.webmanifest'])

  const html = await (await shell.match('/'))?.text()
  if (html) {
    const assets = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
    // Einzeln, damit eine fehlende Datei nicht die ganze Einrichtung kippt.
    await Promise.all([...new Set(assets)].map((url) => shell.add(url).catch(() => undefined)))
  }

  const data = await caches.open(DATA)
  await Promise.all(DATA_FILES.map((url) => data.add(url).catch(() => undefined)))

  const media = await caches.open(MEDIA)
  await Promise.all(
    ['/icons/icon-192.png', '/icons/icon-512.png'].map((url) => media.add(url).catch(() => undefined)),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precache()
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

/**
 * Wie viele Cover höchstens liegen bleiben.
 *
 * Ohne Obergrenze wuchs der Bildspeicher unbegrenzt: Wer einmal durch die
 * Datenbank-Ansicht scrollte, sammelte 2.759 Cover ein — 313 MB auf der Platte,
 * bei 6,7 MB eigentlichen Daten (gemessen am 10.08.2026). Der Zweck war nie ein
 * Bildarchiv, sondern dass der Kalender offline nicht wie eine Baustelle
 * aussieht. Dafür genügen die Cover der aktuellen und der nächsten Woche.
 *
 * 400 Einträge sind großzügig gerechnet: Eine Woche zeigt selten mehr als
 * zwanzig Titel, ein ausgiebiger Streifzug durch die Datenbank ein paar hundert.
 */
const MEDIA_MAX = 400

/**
 * Ältere Einträge wegräumen, bis die Grenze wieder eingehalten ist.
 *
 * `cache.keys()` liefert sie in Einfügereihenfolge — die ältesten stehen vorn.
 * Das ist keine echte Nutzungsstatistik, aber es genügt: Was vor tausend
 * Bildern einmal angesehen wurde, braucht offline niemand mehr.
 */
async function trimCache(cache, max) {
  const keys = await cache.keys()
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

/** Cache zuerst, Netz nur beim ersten Mal. Für unveränderliche Adressen. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  // `opaque` sind Antworten fremder Server ohne CORS — speichern lässt sich
  // das trotzdem, und für ein <img> genügt es vollauf.
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
    if (cacheName === MEDIA) await trimCache(cache, MEDIA_MAX)
  }
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

/**
 * Netz zuerst, Kopie als Rettung — mit Zeitlimit.
 *
 * Ohne Limit ist „kein Netz" der schlimmste Fall: Die Anfrage schlägt nicht
 * fehl, sie hängt. Ein Handy mit einem Balken oder in einem WLAN ohne
 * Internet lässt die App dann minutenlang weiß.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  try {
    const response = await Promise.race([
      fetch(request).then((r) => {
        if (r.ok) cache.put(request, r.clone())
        return r
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Netz zu langsam')), NETWORK_TIMEOUT_MS),
      ),
    ])
    return response
  } catch {
    return cached ?? (await cache.match('/')) ?? Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    // Fremde Server bleiben unberührt — bis auf die Cover. Ohne sie sähe der
    // Kalender offline aus wie eine Baustelle, obwohl alle Daten da sind.
    if (isCoverHost(url) && request.destination === 'image') {
      event.respondWith(cacheFirst(request, MEDIA))
    }
    return
  }

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

/**
 * Die App meldet, welche Cover offline gebraucht werden.
 *
 * Warum nicht im Build festlegen: „aktuelle Woche" hängt vom Tag ab, an dem
 * jemand die Seite öffnet, nicht vom Tag des Builds. Eine im Build erzeugte
 * Liste wäre nach einer Woche die falsche.
 */
self.addEventListener('message', (event) => {
  const { type, urls } = event.data ?? {}
  if (type !== 'cache-covers' || !Array.isArray(urls)) return
  event.waitUntil(
    caches.open(MEDIA).then(async (cache) => {
      for (const url of urls.slice(0, 120)) {
        if (await cache.match(url)) continue
        try {
          // Nicht `cache.add`: Das lehnt opake Antworten ab, weil deren Status
          // 0 ist — und fremde Bilder ohne CORS sind immer opak. Nur der Umweg
          // über `fetch` und `put` legt sie überhaupt ab. Zum Anzeigen in einem
          // <img> genügen sie vollauf.
          const response = await fetch(url, { mode: 'no-cors' })
          if (response.ok || response.type === 'opaque') await cache.put(url, response)
        } catch {
          // Ein einzelnes Bild darf den Rest nicht aufhalten.
        }
      }
    }),
  )
})

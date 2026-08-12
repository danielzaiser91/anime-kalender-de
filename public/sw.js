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
 *   /data/…       Cache zuerst **je Build-Kennung**, sonst Netz. Siehe unten.
 *   Cover         Cache zuerst, auch vom fremden CDN. Die App legt die Bilder
 *                 der aktuellen und nächsten Woche selbst hier ab.
 *
 * Die Version im Cache-Namen ist der Aufräumschalter: Sie zu erhöhen wirft
 * beim nächsten Start alles Alte weg.
 */
const VERSION = 'v4'
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
async function trimCache(cache, max, nurPfad) {
  const alle = await cache.keys()
  // Bei einem Pfadfilter zählt und löscht nur, was darunter liegt.
  //
  // Ohne ihn hätte das Aufräumen der Bündel die Startseite mitgenommen: Sie
  // wird beim Einrichten als Erstes abgelegt, steht also ganz vorn in der
  // Einfügereihenfolge — und ist ausgerechnet die Datei, ohne die es offline
  // keine Seite mehr gibt.
  const keys = nurPfad ? alle.filter((k) => new URL(k.url).pathname.startsWith(nurPfad)) : alle
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

/**
 * Wie viele Bündel-Dateien höchstens liegen bleiben.
 *
 * Die Namen unter `/assets/` tragen einen Hash, jeder Deploy erzeugt also neue.
 * Die alten fragt danach niemand mehr an — sie lagen aber bis zum nächsten
 * Wechsel der Cache-Version herum, rund 400 KB je Deploy. Bei mehreren Deploys
 * am Tag ist das derselbe stille Zuwachs, der schon einmal 313 MB Cover
 * angesammelt hat.
 */
const SHELL_MAX = 40

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
    if (cacheName === SHELL) await trimCache(cache, SHELL_MAX, '/assets/')
  }
  return response
}

/**
 * Wie viele Datendateien höchstens liegen bleiben.
 *
 * Seit die Adressen eine Build-Kennung tragen, hinterlässt jeder Deploy einen
 * neuen Satz Einträge. Ohne Obergrenze läge nach fünfzig Deploys fünfzigmal
 * derselbe Datensatz im Speicher.
 */
const DATA_MAX = 80

/**
 * Daten: Cache zuerst — aber nur bei **gleicher** Build-Kennung.
 *
 * Der Kern des Cache-Bustings, und der Grund, warum hartes Neuladen nie wieder
 * nötig sein sollte:
 *
 *  - **Gleiche Kennung** heißt: exakt dieselbe Datei wie beim letzten Mal. Sie
 *    kann sich nicht geändert haben, also wird sofort geantwortet, ohne Netz.
 *  - **Neue Kennung** heißt: neuer Deploy. Der Cache kennt die Adresse nicht,
 *    es geht ans Netz — genau einmal, danach ist auch sie schnell.
 *  - **Offline** wird die Kennung ignoriert (`ignoreSearch`) und die letzte
 *    bekannte Fassung genommen. Lieber Termine von vorgestern als eine leere
 *    Seite.
 *
 * Vorher stand hier „Cache sofort, Netz im Hintergrund". Das klingt richtig,
 * war es aber nicht: Die Adresse blieb nach einem Deploy dieselbe, und der
 * Auffrischungs-Abruf lief seinerseits in den HTTP-Cache des Browsers
 * (GitHub Pages: zehn Minuten). Aufgefrischt wurde damit mit demselben alten
 * Inhalt, beliebig oft (Daniel, 12.08.2026: „hartes Neuladen sollte nie
 * notwendig sein").
 */
async function dataFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const exakt = await cache.match(request)
  if (exakt) return exakt

  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      await trimCache(cache, DATA_MAX, '/data/')
    }
    return response
  } catch {
    // Kein Netz: irgendeine Fassung ist besser als keine.
    return (await cache.match(request, { ignoreSearch: true })) ?? Response.error()
  }
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
      /**
       * `no-cache` heißt hier nicht „nicht cachen", sondern „beim Server
       * nachfragen, ob die Kopie noch stimmt". Ohne das antwortet der
       * HTTP-Cache des Browsers zehn Minuten lang (GitHub Pages setzt
       * `max-age=600`) mit dem alten HTML — und altes HTML verweist auf das
       * alte Bündel, das wiederum die alte Build-Kennung trägt. Die ganze
       * Kette hinge dann an einer Datei, die niemand nachgefragt hat.
       *
       * Die Antwort ist meist ein 304 und damit fast kostenlos.
       */
      fetch(request, { cache: 'no-cache' }).then((r) => {
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
    event.respondWith(dataFirst(request, DATA))
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

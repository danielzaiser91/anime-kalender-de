/**
 * Live-Modus von `kachel-ecken-messen.mjs` (`--live [url]`): dieselbe Pixelmessung gegen die ausgelieferte Seite statt gegen `dist/`.
 * Der Service Worker bleibt gesperrt und fremde Bilder (Cover) werden durch einen festen Ersatz ersetzt, damit die Messung
 * weder am Cache noch an der Ladezeit fremder Bilder hängt. Die Daten, das CSS und der Code kommen von der echten Adresse.
 */
export const LIVE_STANDARD = 'https://anime-kalender.de'

/** Adresse des Live-Modus aus den Argumenten: `undefined` ohne `--live`, sonst die folgende Adresse (ohne Schrägstrich am Ende) oder der Standard. */
export function liveArgument(argv) {
  const i = argv.indexOf('--live')
  if (i < 0) return undefined
  const folgend = argv[i + 1]
  const roh = folgend && !folgend.startsWith('--') ? folgend : LIVE_STANDARD
  const url = new URL(roh)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`--live: nur http(s), nicht ${url.protocol}`)
  return url.origin
}

/** Was mit einer Anfrage geschieht: `weiter` (echte Adresse, unverändert), `kulisse` (events.json bekommt die Saal-Kulisse), `ersatz` (fremdes Ziel: Bild aus dem festen Ersatz), `ignorieren` (kein http). */
export function liveAktion(anfrageUrl, basis) {
  const url = new URL(anfrageUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'ignorieren'
  if (url.origin !== basis) return 'ersatz'
  return url.pathname.endsWith('/data/events.json') ? 'kulisse' : 'weiter'
}

/** Datenstand der Live-Seite (`generatedAt` aus `data/meta.json`) oder ein Fehlertext; `holen` ist `fetch`. */
export async function liveDatenstand(basis, holen = fetch) {
  try {
    const antwort = await holen(`${basis}/data/meta.json`)
    if (!antwort.ok) return { fehler: `Messwoche: ${basis}/data/meta.json antwortet mit ${antwort.status}` }
    const { generatedAt } = await antwort.json()
    return typeof generatedAt === 'string' ? { erzeugt: generatedAt } : { fehler: `Messwoche: ${basis}/data/meta.json ohne generatedAt` }
  } catch (e) {
    return { fehler: `Messwoche: ${basis}/data/meta.json nicht lesbar (${e.message})` }
  }
}

/** Feste Antwort für fremde Bilder (Cover): ein Rand wird gegen ein Bild und nicht gegen Weiß geprüft. */
export const ERSATZ_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#4a5a80"/></svg>'

/** Route-Handler des Live-Modus: echte Adresse durchreichen, events.json über `kulisse(inhalt)` umschreiben, fremde Ziele als Ersatzbild. */
export async function antworteLive(route, basis, kulisse) {
  const aktion = liveAktion(route.request().url(), basis)
  if (aktion === 'ersatz') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: ERSATZ_SVG })
  if (aktion !== 'kulisse') return route.continue()
  const antwort = await route.fetch()
  return route.fulfill({ response: antwort, body: kulisse(await antwort.body()) })
}

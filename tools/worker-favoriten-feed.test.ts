/**
 * **Persönlicher Feed aus `feeds/all.ics`** (23.10.2026, `worker/src/favoriten-feed.ts`): der Ausschnitt muss Byte für Byte
 * der Datei entsprechen, die `buildIcs` aus den Terminen der Favoriten baut; der Edge-Cache hält die Antwort, damit
 * Kalender-Abrufe D1 nicht bei jedem Mal lesen.
 *
 * Aufruf: `npx tsx tools/worker-favoriten-feed.test.ts`
 */
import worker from '../worker/src/index.ts'
import { schneideFeed } from '../worker/src/favoriten-feed-schnitt.ts'
import { buildIcs } from '../shared/ics.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { abonnenten, fetchAttrappe, neueDatenbank, testEnv, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

const NAME = 'Anime-Kalender DE – Meine Favoriten'
const SITE = 'https://anime-kalender.de/'
const LANG = 'Ein Titel mit Komma, Semikolon; und so vielen Zeichen, dass die Beschreibung und die Überschrift gefaltet werden müssen ÄÖÜ'
const ev = (id: string, titleId: number, date: string, o: Partial<ReleaseEvent> = {}): ReleaseEvent => ({
  id,
  releaseSlug: `s${titleId}`,
  titleId,
  date,
  time: '10:00',
  releaseType: 'weekly',
  platform: 'netflix',
  name: `Titel ${titleId}`,
  episode: 1,
  episodeCount: 12,
  ...o,
})
/* Titel 12 und 123 (Vorsilbe), Titel 5 mit zwei Staffeln (zwei Release-Kennungen), zusammengefasste Folgen, Termin ohne Uhrzeit, langer Name. */
const TERMINE: ReleaseEvent[] = [
  ev('a1', 12, '2026-10-20'),
  ev('b1', 123, '2026-10-20'),
  ev('c1', 5, '2026-10-21', { releaseSlug: 's5-1', episode: 1 }),
  ev('c2', 5, '2026-10-21', { releaseSlug: 's5-1', episode: 2 }),
  ev('d1', 5, '2026-10-22', { releaseSlug: 's5-2', episode: 1, time: undefined }),
  ev('e1', 7, '2026-10-23', { name: LANG, releaseType: 'batch' }),
  ev('f1', 9999999, '2026-10-24', { name: LANG }),
  ev('g1', -284833, '2026-10-24', { platform: 'paramountplus' }),
]
const ALLES = buildIcs(TERMINE, { siteUrl: SITE, calendarName: 'Anime-Kalender DE' })

function vergleiche(favoriten: number[]): boolean {
  const erwartet = buildIcs(TERMINE.filter((e) => favoriten.includes(e.titleId)), { siteUrl: SITE, calendarName: NAME })
  return schneideFeed(ALLES, new Set(favoriten), NAME) === erwartet
}

function ausschnitte() {
  console.log('Ausschnitt gleich buildIcs:')
  pruefe(vergleiche([]), 'keine Favoriten: nur Rahmen')
  pruefe(vergleiche([12]), 'Titel 12 nimmt nicht 123 mit')
  pruefe(vergleiche([123]), 'Titel 123 nimmt nicht 12 mit')
  pruefe(vergleiche([5]), 'Titel mit zwei Staffeln und zusammengefassten Folgen')
  pruefe(vergleiche([7, 9999999]), 'lange, gefaltete Namen')
  pruefe(vergleiche([12, 123, 5, 7, 9999999, -284833]), 'alle Titel')
  pruefe(vergleiche([-284833]), 'Cartoon mit negativer Kennung')
  pruefe(vergleiche([42]), 'Titel ohne Termin')
  pruefe(schneideFeed('', new Set([1]), NAME) === buildIcs([], { calendarName: NAME }), 'leere Quelle: nur Rahmen')
  const halb = ALLES.slice(0, ALLES.indexOf('END:VEVENT', ALLES.indexOf('END:VEVENT') + 1))
  pruefe(!schneideFeed(halb, new Set([12, 123, 5]), NAME).includes('Titel 5'), 'abgeschnittene Quelle: unvollständiger Termin entfällt')
}

const cache = new Map<string, Response>()
Object.assign(globalThis, {
  caches: {
    default: {
      match: async (r: Request) => cache.get(r.url)?.clone(),
      put: async (r: Request, a: Response) => void cache.set(r.url, a),
    },
  },
})
const ausstehend: Promise<unknown>[] = []
const ctx = { waitUntil: (p: Promise<unknown>) => void ausstehend.push(p) } as unknown as ExecutionContext
let allIcsAbrufe = 0
let allIcsStatus = 200

function umgebung() {
  const db = neueDatenbank()
  abonnenten(db, 1)
  db.exec("UPDATE subscribers SET feed_token = 'tok1', favorites = 'ak:12,5'")
  fetchAttrappe('2026-10-23')
  const basis = globalThis.fetch
  globalThis.fetch = (async (e: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url
    if (url.endsWith('data/feeds/all.ics')) {
      allIcsAbrufe++
      return new Response(allIcsStatus === 200 ? ALLES : 'weg', { status: allIcsStatus })
    }
    return basis(e, init)
  }) as typeof fetch
  return { db, env: testEnv(db, 7) }
}

const abruf = async (env: ReturnType<typeof testEnv>, k: string) => {
  const res = await worker.fetch(new Request(`https://w.example.invalid/feed/favoriten.ics${k}`), env, ctx)
  await Promise.all(ausstehend.splice(0))
  return res
}

async function handler() {
  console.log('Route und Edge-Cache:')
  const { env } = umgebung()
  zaehlerZurueck()
  const erste = await abruf(env, '?k=tok1')
  const text = await erste.text()
  pruefe(erste.status === 200 && text === buildIcs(TERMINE.filter((e) => [12, 5].includes(e.titleId)), { siteUrl: SITE, calendarName: NAME }), 'Abruf liefert die Termine der Favoriten')
  pruefe(erste.headers.get('Content-Type') === 'text/calendar; charset=utf-8', 'Inhaltstyp text/calendar')
  const d1Vorher = zaehler.d1
  const zweite = await abruf(env, '?k=tok1')
  pruefe((await zweite.text()) === text && zaehler.d1 === d1Vorher && allIcsAbrufe === 1, 'zweiter Abruf aus dem Cache: keine D1-Abfrage, kein neuer Abruf von all.ics')
  pruefe((await abruf(env, '')).status === 400, 'ohne Adresse-Schlüssel: 400')
  const fremd = await abruf(env, '?k=unbekannt')
  const d1Fremd = zaehler.d1
  await abruf(env, '?k=unbekannt')
  pruefe(fremd.status === 404 && zaehler.d1 > d1Fremd, 'unbekannter Schlüssel: 404, wird nicht gehalten')
  cache.clear()
  allIcsStatus = 503
  const kaputt = await abruf(env, '?k=tok1')
  pruefe(kaputt.status !== 200 && cache.size === 0, 'Quelle nicht abrufbar: kein 200 und nichts im Cache')
}

ausschnitte()
await handler()
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nPersönlicher Feed: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)

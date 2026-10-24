/**
 * Zusicherung: Der Tagesfeed `motn-changes.json` setzt „Im Angebot seit" sofort (`pipeline/bau/angebot-feed.ts`), durch `ergaenzeAngebotSeit` hindurch.
 * Gegenproben: removed, Meldung ohne Deutsch, belegtes seit aus motn.json, unbekannte Serie, Wiedereinstellung nach Entfernung, Erfassungsstichtag (Monatsstand und Feed-Welle ab STICHTAG_AB), Schreibstelle (feedEintrag).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-angebot-feed.ts`
 */
import type { MotnDaten } from './lib/motn.ts'
import type { Release, Title } from '../shared/types.ts'
import { ergaenzeAngebotSeit } from './bau/13-3-angebot-seit.ts'
import { STICHTAG_AB } from './bau/angebot-stichtag.ts'
import { feedEintrag, tonspuren, type MotnChanges } from './bau/angebot-feed.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Show = { imdbId: string; dienste: Record<string, { gelistet: number[]; deutsch: number[]; seit?: string }> }
const archiv: Record<string, Show> = {}
const tmdbZuImdb: Record<string, { imdbId: string }> = {}
const tmdbZuTitel: Record<string, { tmdbId: string; kind: string }> = {}
const titel = new Map<number, Title>()
const gesehen: NonNullable<MotnChanges['gesehen']> = {}

function titelMit(id: number, dienste: Show['dienste'], plattform = 'primevideo'): void {
  archiv[`tt${id}`] = { imdbId: `tt${id}`, dienste }
  tmdbZuImdb[`tv/${id}`] = { imdbId: `tt${id}` }
  tmdbZuTitel[String(id)] = { tmdbId: String(id), kind: 'tv' }
  titel.set(id, { id, titleEn: `T${id}`, format: 'TV', episodes: 12, streams: [{ platform: plattform, url: `https://x.example/${id}`, dub: true }] } as unknown as Title)
}
const meldung = (art: 'new' | 'removed', id: number, am: string, deutschBeiDienst = true, dienst = 'prime') => {
  gesehen[`${art}:${id}:${dienst}`] = { art, imdbId: `tt${id}`, dienst, am, deutsch: true, deutschBeiDienst }
}

titelMit(1, {}) // Montag-Fall: motn.json kennt die Serie, aber noch keinen Prime-Stand
meldung('new', 1, '2026-10-19')
titelMit(2, {})
meldung('new', 2, '2026-10-19')
meldung('removed', 2, '2026-10-20') // später wieder entfernt
titelMit(3, {})
meldung('new', 3, '2026-10-19', false) // ohne deutsche Tonspur bei diesem Dienst, obwohl ein anderer Dienst deutschen Ton führt (deutsch: true)
titelMit(4, { primevideo: { gelistet: [], deutsch: [], seit: '2026-09-01' } })
meldung('new', 4, '2026-10-19') // jünger als belegtes seit
titelMit(5, {})
meldung('removed', 5, '2026-10-19') // nur removed
titelMit(6, {})
meldung('removed', 6, '2026-08-01')
meldung('new', 6, '2026-10-19') // zurück nach Entfernung
gesehen['new:99:prime'] = { art: 'new', imdbId: 'tt99', dienst: 'prime', am: '2026-10-19', deutsch: true, deutschBeiDienst: true } // nicht in motn.json
titelMit(7, {}, 'netflix')
meldung('new', 7, '2026-10-19', true, 'netflix')
titelMit(8, {})
meldung('new', 8, '2026-10-18', true, 'unbekannt') // Dienst unbekannt
titelMit(9, {}) // knapp unter der Schwelle: STICHTAG_AB - 1 Feed-Meldungen am selben Tag sind noch Angebotstage
meldung('new', 9, '2026-10-17')
for (let i = 0; i < STICHTAG_AB - 2; i++) {
  titelMit(100 + i, {})
  meldung('new', 100 + i, '2026-10-17')
}
// genau an der Schwelle: Welle wie Prime 26.09.2026, kein seit; Netflix am selben Tag und Meldungen ohne Ton beim Dienst zählen nicht mit
for (let i = 0; i < STICHTAG_AB; i++) {
  titelMit(200 + i, {})
  meldung('new', 200 + i, '2026-10-12')
}
titelMit(300, {}, 'netflix')
meldung('new', 300, '2026-10-12', true, 'netflix')
for (let i = 0; i < STICHTAG_AB - 1; i++) {
  titelMit(400 + i, {})
  meldung('new', 400 + i, '2026-10-11')
}
for (let i = 0; i < 5; i++) {
  titelMit(450 + i, {})
  meldung('new', 450 + i, '2026-10-11', false)
}

titelMit(10, {}) // removed am selben Tag wie new: gilt als entfernt
meldung('new', 10, '2026-10-16')
meldung('removed', 10, '2026-10-16')
titelMit(11, {}) // removed bei einem anderen Dienst sperrt Prime nicht
meldung('new', 11, '2026-10-15')
meldung('removed', 11, '2026-10-16', true, 'netflix')
titelMit(12, {}) // Eintrag ohne Feld imdbId: Schlüssel zählt
delete (archiv.tt12 as Partial<Show>).imdbId
meldung('new', 12, '2026-10-14')

titelMit(14, {}) // Meldung aus dem Altbestand ohne Feld deutschBeiDienst: nichts
gesehen['new:14:prime'] = { art: 'new', imdbId: 'tt14', dienst: 'prime', am: '2026-10-19', deutsch: true }
titelMit(13, {}, 'primevideo') // Welle schon im Monatsstand: STICHTAG_AB fremde Shows am selben Tag
for (let i = 0; i < STICHTAG_AB; i++) archiv[`fremd-${i}`] = { imdbId: `ttf${i}`, dienste: { primevideo: { gelistet: [], deutsch: [], seit: '2026-10-13' } } }
meldung('new', 13, '2026-10-13')

const slim = [...titel.values()].map((t) => ({ ...t }))
const releases: Release[] = []
ergaenzeAngebotSeit({
  slim: slim as never,
  releases,
  titles: titel,
  quellen: { motn: { shows: archiv, tmdb: tmdbZuImdb } as unknown as MotnDaten, tmdb: tmdbZuTitel, changes: { gesehen } },
})
const seit = (id: number) => titel.get(id)!.angebotSeit

console.log('\nIm Angebot seit aus dem Tagesfeed:')
pruefe('new + deutsch beim Dienst: Termin am Meldetag (Prime, 19.10.)', seit(1)?.date === '2026-10-19' && seit(1)?.platform === 'primevideo' && releases.some((r) => r.slug === 'motn-1-primevideo' && r.schedule.firstEpisodeDate === '2026-10-19'), seit(1))
pruefe('Ausgeliefertes Slim trägt es ebenfalls', (slim.find((t) => t.id === 1) as Title).angebotSeit?.date === '2026-10-19')
pruefe('spätere removed-Meldung: nichts', !seit(2), seit(2))
pruefe('Deutsch nur bei einem anderen Dienst (deutsch: true, deutschBeiDienst: false): nichts', !seit(3), seit(3))
pruefe('Altmeldung ohne deutschBeiDienst: nichts', !seit(14), seit(14))
pruefe('belegtes seit aus motn.json bleibt', seit(4)?.date === '2026-09-01', seit(4))
pruefe('nur removed: nichts', !seit(5), seit(5))
pruefe('removed älter als new: new gilt', seit(6)?.date === '2026-10-19', seit(6))
pruefe('Serie nicht in motn.json: unberührt', !titel.has(99))
pruefe('Netflix wird genauso gesetzt', seit(7)?.platform === 'netflix' && seit(7)?.date === '2026-10-19', seit(7))
pruefe('unbekannter Dienst: nichts', !seit(8), seit(8))
pruefe('knapp unter der Schwelle (STICHTAG_AB - 1 am Tag) ist keine Welle', seit(9)?.date === '2026-10-17' && seit(100)?.date === '2026-10-17' && seit(100 + STICHTAG_AB - 3)?.date === '2026-10-17', seit(9))
pruefe('genau STICHTAG_AB Feed-Meldungen eines Anbieters an einem Tag: kein seit, kein Termin', !seit(200) && !seit(200 + STICHTAG_AB - 1) && !releases.some((r) => r.titleId >= 200 && r.titleId < 200 + STICHTAG_AB), seit(200))
pruefe('Welle bei Prime sperrt Netflix am selben Tag nicht', seit(300)?.date === '2026-10-12' && seit(300)?.platform === 'netflix', seit(300))
pruefe('Meldungen ohne Ton beim Dienst zählen nicht zur Welle', seit(400)?.date === '2026-10-11' && !seit(450), seit(400))
pruefe('Welle im Monatsstand sperrt die Feed-Meldung', !seit(13) && !releases.some((r) => r.titleId === 13), seit(13))
pruefe('removed am selben Tag wie new: nichts', !seit(10), seit(10))
pruefe('removed eines anderen Dienstes sperrt nicht', seit(11)?.date === '2026-10-15', seit(11))
pruefe('Serie ohne imdbId-Feld wird über den Schlüssel gefunden', seit(12)?.date === '2026-10-14', seit(12))

const optionen = [
  { service: { id: 'netflix' }, audios: [{ language: 'jpn' }, { language: 'deu' }] },
  { service: { id: 'prime' }, audios: [{ language: 'jpn' }] },
  { service: { id: 'disney' } },
]
pruefe('Erzeuger: deutscher Ton nur bei Netflix zählt für Netflix', tonspuren(optionen, 'netflix').deutschBeiDienst)
pruefe('Erzeuger: derselbe Ton zählt nicht für Prime (Optionen ohne deu)', !tonspuren(optionen, 'prime').deutschBeiDienst)
pruefe('Erzeuger: Dienst ohne audios und ohne Eintrag: nein', !tonspuren(optionen, 'disney').deutschBeiDienst && !tonspuren(optionen, 'crunchyroll').deutschBeiDienst)
pruefe('Erzeuger: ohne Dienstkennung nie wahr', !tonspuren([{ audios: [{ language: 'deu' }] }], undefined).deutschBeiDienst)
pruefe('Erzeuger: deutsch zählt jeden Dienst, leere Optionen nicht', tonspuren(optionen, 'prime').deutsch && !tonspuren([{ service: { id: 'prime' } }], 'prime').deutsch)

const primeTon = [{ service: { id: 'prime' }, audios: [{ language: 'deu' }] }, { service: { id: 'netflix' }, audios: [{ language: 'jpn' }] }]
const stempel = Date.UTC(2026, 9, 19, 23, 30) / 1000
const zeige = { title: 'Titel', originalTitle: 'Original', imdbId: 'tt7', tmdbId: 'tv/7' }
const primeEintrag = feedEintrag('new', zeige, { timestamp: stempel, service: { id: 'prime' } }, primeTon)
pruefe(
  'Schreibstelle: „Ton nur bei Prime" ergibt deutschBeiDienst === true und das ganze Feldbild',
  JSON.stringify(primeEintrag) === JSON.stringify({ art: 'new', titel: 'Titel', originalTitel: 'Original', imdbId: 'tt7', tmdbId: 'tv/7', dienst: 'prime', am: '2026-10-19', deutsch: true, deutschBeiDienst: true }),
  primeEintrag,
)
const netflixEintrag = feedEintrag('removed', zeige, { service: { id: 'netflix' } }, primeTon)
pruefe('Schreibstelle: dieselben Optionen bei Netflix: deutsch ja, beim Dienst nein, art und fehlender Zeitstempel durchgereicht', netflixEintrag.deutsch === true && netflixEintrag.deutschBeiDienst === false && netflixEintrag.art === 'removed' && netflixEintrag.am === undefined, netflixEintrag)
const ohneDienst = feedEintrag('new', zeige, { timestamp: stempel }, primeTon)
pruefe('Schreibstelle: Änderung ohne Dienstkennung: nie deutschBeiDienst', ohneDienst.deutschBeiDienst === false && ohneDienst.dienst === undefined, ohneDienst)

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nIm Angebot seit aus dem Tagesfeed: ${faelle} Zusicherungen erfüllt.`)

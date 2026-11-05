/**
 * Zusicherung: die ausgelagerte Logik der Crunchyroll-Abrufskripte (`lib/cr-abruf-logik.ts`) liefert feste Werte.
 * Kleine Fixtures, keine Abrufe. Die Gleichheit zur alten Skript-Logik wurde am echten Bestand gemessen (PR-Text).
 */
import {
  audioVon,
  einzelwerkFund,
  episodenTreffer,
  ersterEinzelwerkTreffer,
  filmbloeckeZusammen,
  katalogEintrag,
  katalogZuordnung,
  offeneFilmbloecke,
  offeneOhneSerienkennung,
  offeneOhneUrteil,
  passenderBlock,
  reiheVon,
  serienIdsAusSuche,
} from './lib/cr-abruf-logik.ts'

let fehler = 0
let faelle = 0
function gleich(name: string, ist: unknown, soll: unknown): void {
  faelle++
  if (JSON.stringify(ist) === JSON.stringify(soll)) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(ist)}, erwartet: ${JSON.stringify(soll)}`)
}

const cr = { serien: [{ url: 'u/mit', seriesId: 'S1' }, { url: 'u/ohne' }] }
const stream = (url: string, extra = {}) => ({ platform: 'crunchyroll', url, ...extra })
const titles = [
  { id: 1, titleDe: 'A', titleEn: 'AE', format: 'MOVIE', episodes: 1, jpYear: 2019, streams: [stream('u/mit')] },
  { id: 2, titleEn: 'B', format: 'OVA', episodes: 2, streams: [stream('u/ohne'), { platform: 'netflix', url: 'n' }] },
  { id: 3, titleDe: 'C', format: 'TV', streams: [stream('u/neu')] },
  { id: 4, titleDe: 'D', format: 'ONA', streams: [stream('u/x', { dub: false })] },
]

console.log('audioVon')
gleich('Liste vor Einzelwert', audioVon({ audio_locales: ['a'], audio_locale: 'b' }), ['a'])
gleich('Einzelwert', audioVon({ audio_locale: 'b' }), ['b'])
gleich('leer', audioVon({}), [])

console.log('offene Listen')
gleich('ohne Serienkennung: Weg mit seriesId fällt weg, Titel fällt auf titleEn zurück', offeneOhneSerienkennung(titles, cr), [
  { id: 2, titel: 'B', en: 'B', romaji: undefined, format: 'OVA', folgen: 2, url: 'u/ohne' },
  { id: 3, titel: 'C', en: undefined, romaji: undefined, format: 'TV', folgen: undefined, url: 'u/neu' },
])
gleich('ohne Urteil: dub gesetzt und fremde Plattform fallen weg', offeneOhneUrteil(titles).map((o) => o.id), [1, 2, 3])
gleich('Filmblöcke: TV und ONA fallen weg, Serienzeile hängt dran', offeneFilmbloecke(titles, cr).map((o) => [o.id, o.serie?.seriesId ?? null, o.jahr ?? null]), [[1, 'S1', 2019], [2, null, null]])

console.log('Einzelwerk-Treffer')
const gruppen = [
  { type: 'series', items: [{ id: 's', title: 'Fruits Basket', type: 'series', series_metadata: { audio_locales: ['ja-JP'] } }] },
  { type: 'movie_listing', items: [{ id: 'm', title: '-prelude-', type: 'movie_listing', movie_listing_metadata: { audio_locale: 'de-DE' } }] },
]
const treffer = ersterEinzelwerkTreffer(gruppen, ['Fruits Basket -prelude-'])
gleich('Teiltreffer gegen Film, Serie wird übersprungen', treffer && [treffer.id, treffer.typ, treffer.art, treffer.exakt], ['m', 'movie_listing', 'movie_listing', false])
gleich('kein Treffer', ersterEinzelwerkTreffer(gruppen, ['Etwas Anderes']), null)
gleich('keine Antwort', ersterEinzelwerkTreffer(undefined as never, ['x']), null)
gleich('Fund mit Treffer trägt audio', einzelwerkFund({ id: 7 }, treffer), { id: 7, treffer: { id: 'm', typ: 'movie_listing', art: 'movie_listing', exakt: false, titel: '-prelude-', audio: ['de-DE'] } })
gleich('Fund ohne Treffer', einzelwerkFund({ id: 7 }, null), { id: 7, treffer: null })

console.log('Katalog')
const roh = { id: 'k', title: 'T', slug_title: 'sl', description: 'x'.repeat(400), movie_listing_metadata: { audio_locale: 'de-DE', movie_release_year: '2019' } }
const eintrag = katalogEintrag(roh, 'movie_listing')
gleich('Eintrag Film', [eintrag.typ, eintrag.slug, eintrag.beschreibung.length, eintrag.audio, eintrag.jahr, eintrag.folgen], ['film', 'sl', 300, ['de-DE'], '2019', null])
gleich('Eintrag Serie', [katalogEintrag({ id: 'k', title: 'T', series_metadata: { episode_count: 12, season_count: 2, series_launch_year: 2020 } }, '').typ], ['serie'])
const kat = [
  { id: 'a', titel: 'One-Punch Man', folgen: 12, audio: ['de-DE'] },
  { id: 'b', titel: '-prelude-', folgen: 1, audio: ['de-DE'] },
  { id: 'c', titel: 'Doppelt', folgen: 3, audio: [] },
  { id: 'd', titel: 'Doppelt', folgen: 3, audio: [] },
]
const offen = [
  { id: 1, titel: 'One Punch Man OVAs', folgen: 6, format: 'OVA' },
  { id: 2, en: 'Fruits Basket -prelude-', folgen: 1, format: 'MOVIE' },
  { id: 3, titel: 'Doppelt', folgen: 3 },
  { id: 4, titel: 'One Punch Man', folgen: 12 },
]
gleich('Zuordnung: Folgenzahl sperrt, Gleichstand sperrt, Teiltreffer und exakter Name ordnen zu', katalogZuordnung(offen, kat), [
  { id: 2, unser: 'Fruits Basket -prelude-', katalogId: 'b', katalogTitel: '-prelude-', audio: ['de-DE'], art: 'Katalogtitel steckt in unserem', folgen: 1 },
  { id: 4, unser: 'One Punch Man', katalogId: 'a', katalogTitel: 'One-Punch Man', audio: ['de-DE'], art: 'Name exakt', folgen: 12 },
])

console.log('Filmblöcke')
gleich('Reihe vor dem Doppelpunkt', reiheVon({ titel: 'Tonikawa: Over The Moon' }), 'Tonikawa')
gleich('Reihe fällt auf en zurück', reiheVon({ en: 'Free! - The Movie' }), 'Free!')
const suche = { data: [{ items: [{ id: 'x', title: 'Tonikawa' }, { id: 'y', title: 'Anderes' }] }] }
gleich('Serien-IDs nach Reihe', serienIdsAusSuche(suche, 'Tonikawa'), ['x'])
gleich('Serien-IDs ohne Antwort', serienIdsAusSuche(null, 'Tonikawa'), [])
const bloecke = [{ id: 'b1', titel: 'Staffel 1', audio: ['ja-JP'] }, { id: 'b2', titel: 'Genocidal Organ', audio: ['de-DE'] }]
gleich('Block über exakten Namen', passenderBlock(bloecke, ['Genocidal Organ'], 'S'), { serienId: 'S', blockId: 'b2', blockTitel: 'Genocidal Organ', audio: ['de-DE'] })
gleich('Block über Kennwort', passenderBlock(bloecke, ['Project Itoh: Genocidal Organ'], 'S')?.blockId, 'b2')
gleich('Kennwort unter sechs Zeichen sperrt', passenderBlock([{ id: 'z', titel: 'Movie', audio: [] }], ['Free: Movie'], 'S'), null)
const ep = (extra = {}) => ({ id: 'e', title: 'Uniform Special', episode_metadata: { series_title: 'TONIKAWA', series_id: 'T', versions: [{ audio_locale: 'de-DE' }, {}], ...extra } })
gleich('Episode: Serienname und Kennwort', episodenTreffer({ data: [{ items: [ep()] }] }, ['Tonikawa: Uniform'], 'Tonikawa'), { serienId: 'T', blockId: 'e', blockTitel: 'Folge „Uniform Special" in TONIKAWA', audio: ['de-DE'] })
gleich('Episode: falsche Serie', episodenTreffer({ data: [{ items: [ep({ series_title: 'Anderes' })] }] }, ['Tonikawa: Uniform'], 'Tonikawa'), null)
gleich('Episode: Kennwort fehlt', episodenTreffer({ data: [{ items: [ep()] }] }, ['Tonikawa: Dress'], 'Tonikawa'), null)
gleich('Episode: ohne Fassungen', episodenTreffer({ data: [{ items: [ep({ versions: [] })] }] }, ['Tonikawa: Uniform'], 'Tonikawa'), null)

console.log('Zusammenführen')
const alt = [{ id: 2, treffer: { audio: ['a'] } }, { id: 1, treffer: null }, { id: 5, treffer: { audio: ['alt'] } }, { id: null }]
const funde = [{ id: 1, treffer: { audio: ['n'] } }, { id: 2, treffer: null }, { id: 3, treffer: { audio: ['neu'] } }, { id: 5, treffer: { audio: ['neu5'] } }, { treffer: null }]
const z = filmbloeckeZusammen(alt, funde)
gleich('Zähler', [z.neuDazu, z.ersetzt, z.behalten], [1, 2, 1])
gleich('Schweigen behält alten Treffer, sortiert nach id', z.gesamt.map((f) => [f.id, f.treffer?.audio?.[0] ?? null]), [[1, 'n'], [2, 'a'], [3, 'neu'], [5, 'neu5']])
gleich('Vorher kein Array', filmbloeckeZusammen({}, [{ id: 1, treffer: null }]).gesamt.length, 1)

if (fehler) {
  console.error(`check-cr-abruf-logik: ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`check-cr-abruf-logik: ${faelle} Fälle (Listen, Einzelwerk-Treffer, Katalog, Filmblöcke, Zusammenführen) ok`)

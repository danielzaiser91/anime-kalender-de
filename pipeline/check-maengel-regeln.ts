/** Test des Mängel-Registers: je Regel ein Treffer und eine Ausnahme/ein Nichttreffer, die Fortschreibung (neu, behoben, Rückfall, `seit` bleibt) und die Meldungen der Wache. */
import type { Release, Title } from '../shared/types.ts'
import { adresseMehrfach, REGELN, zaehleMaengel, type Kontext } from './lib/maengel-regeln.ts'
import { maengelWarnZeilen, meldungen, offeneJeArt, schreibeFort, serialisiere } from './lib/maengel-register.ts'
import { warnZeilen } from './lib/qualitaet-warnzeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const HEUTE = '2026-11-16'
/** Ein vollständiger Titel: keine Regel schlägt an. */
const gut = (id: number, ueber: Partial<Title> = {}): Title => ({
  id,
  titleDe: 'Gut',
  jpYear: 2020,
  coverImage: 'c',
  bannerImage: 'b',
  format: 'TV',
  episodes: 12,
  fsk: 12,
  score: 70,
  studios: ['S'],
  genres: ['G'],
  runtimeMin: 24,
  hasVoices: true,
  dubConfidence: 'high',
  jpEnd: '2020-12-01',
  streams: [{ platform: 'netflix', url: `u${id}`, dub: true }],
  watchLinks: [],
  ...ueber,
} as unknown as Title)
const zwoelfFolgen = () => ({ f: Array.from({ length: 12 }, (_, i) => [i + 1, `F${i + 1}`] as [number, string]) })
const kontext = (ueber: Partial<Kontext> = {}): Kontext => ({
  heute: HEUTE,
  coverBekannt: {},
  synopse: () => ({ de: 'Text' }),
  folgen: zwoelfFolgen,
  kuenftig: new Set(),
  releases: new Map(),
  discTitel: new Set(),
  adresseMehrfach: new Set(),
  ...ueber,
})
const arten = (t: Title, k = kontext()) => zaehleMaengel([t], k).map((x) => (x.grund ? `${x.art}:${x.grund}` : x.art))
const rel = (ueber: Partial<Release>): Release => ({ titleId: 1, platform: 'netflix', releaseType: 'batch', schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 12 }, ...ueber } as unknown as Release)
const mitReleases = (...r: Release[]) => kontext({ releases: new Map([[1, r]]) })
const ohneFolgen = kontext({ folgen: () => undefined })

pruefe('vollständiger Titel: keine Regel schlägt an', arten(gut(1)).length === 0, arten(gut(1)))
pruefe('Tabelle: jede Art einmal, jede mit Wirkung 1–3 und wer', new Set(REGELN.map((r) => r.art)).size === REGELN.length && REGELN.every((r) => r.wirkung >= 1 && r.wirkung <= 3 && r.wer), REGELN.map((r) => r.art))

pruefe('cover: Treffer', arten(gut(1, { coverImage: undefined })).join() === 'cover')
pruefe('cover: auf der Handliste cover-ohne-bekannt ist Ausnahme', arten(gut(1, { coverImage: undefined }), kontext({ coverBekannt: { 1: 'TMDB führt ihn nicht' } })).join() === 'cover:ohne-bekanntes-cover')
pruefe('cover: anderer Titel auf der Handliste ändert nichts', arten(gut(1, { coverImage: undefined }), kontext({ coverBekannt: { 2: 'x' } })).join() === 'cover')
pruefe('banner: Treffer', arten(gut(1, { bannerImage: undefined })).join() === 'banner')
pruefe('titel-de: Treffer mit Weg', arten(gut(1, { titleDe: undefined })).join() === 'titel-de')
pruefe('titel-de: ohne Weg und Erstausgabe zu Recht leer', arten(gut(1, { titleDe: undefined, streams: [], watchLinks: [], deErstausgabe: undefined })).join() === 'titel-de:ohne-deutsche-fassung,kein-weg')
pruefe('handlung-de: Treffer', arten(gut(1), kontext({ synopse: () => ({ en: 'only' }) })).join() === 'handlung-de')
pruefe('folgentitel: Serie mit fehlenden Titeln', arten(gut(1), kontext({ folgen: () => ({ f: [[1, 'A'], [2, '']] }) })).join() === 'folgentitel')
pruefe('folgentitel: Liste voll lang, aber eine Folge ohne Titel', arten(gut(1), kontext({ folgen: () => ({ f: Array.from({ length: 12 }, (_, i) => [i + 1, i === 5 ? '' : 'T'] as [number, string]) }) })).join() === 'folgentitel')
pruefe('folgentitel: Film mit Folgen ist Ausnahme', arten(gut(1, { format: 'MOVIE' }), ohneFolgen).join() === 'folgentitel:film')
pruefe('folgentitel: Einzelwerk (1 Folge) zählt nicht', arten(gut(1, { episodes: 1 }), ohneFolgen).length === 0)
pruefe('folgenzahl: Treffer', arten(gut(1, { episodes: undefined, jpEnd: '2020-12-01' }), ohneFolgen).join() === 'folgenzahl')
pruefe('folgenzahl: Langläufer ohne Ende ist Ausnahme', arten(gut(1, { episodes: undefined, jpEnd: undefined, jpYear: 1999 }), kontext({ folgen: () => undefined, kuenftig: new Set([1]) })).join() === 'folgenzahl:langlaeufer')
pruefe('folgenzahl: junge Serie ohne Ende bleibt offen', arten(gut(1, { episodes: undefined, jpEnd: undefined, jpYear: 2026 }), kontext({ folgen: () => undefined, kuenftig: new Set([1]) })).join() === 'folgenzahl')
pruefe('fsk: fehlt = Treffer', arten(gut(1, { fsk: undefined })).join() === 'fsk')
pruefe('fsk: 0 ist eine Einstufung, kein Mangel', arten(gut(1, { fsk: 0 as never })).length === 0)
pruefe('wertung: Treffer', arten(gut(1, { score: undefined })).join() === 'wertung')
pruefe('studio: Treffer', arten(gut(1, { studios: [] })).join() === 'studio')
pruefe('genre: Treffer', arten(gut(1, { genres: [] })).join() === 'genre')
pruefe('laufzeit: Treffer', arten(gut(1, { runtimeMin: undefined })).join() === 'laufzeit')
pruefe('jahr: Treffer', arten(gut(1, { jpYear: undefined })).join() === 'jahr')
pruefe('sprecher: Treffer mit Synchro', arten(gut(1, { hasVoices: false })).join() === 'sprecher')
pruefe('sprecher: ohne Synchro zu Recht leer', arten(gut(1, { hasVoices: false, streams: [{ platform: 'netflix', url: 'u', dub: false }] as Title['streams'] })).join() === 'sprecher:ohne-synchro')
pruefe('kein-weg: Treffer', arten(gut(1, { streams: [], watchLinks: [] })).includes('kein-weg'))
pruefe('kein-weg: Kauflink genügt', !arten(gut(1, { streams: [], watchLinks: [{ name: 'x', url: 'u', kind: 'buy' }] as Title['watchLinks'] })).includes('kein-weg'))
const erst = { von: '2022-01-01', synchro: true } as Title['deErstausgabe']
pruefe('erstausgabe-ohne-weg: Treffer', arten(gut(1, { streams: [], watchLinks: [], deErstausgabe: erst })).includes('erstausgabe-ohne-weg'))
pruefe('erstausgabe-ohne-weg: Disc-Termin ist ein Weg (#4034)', !arten(gut(1, { streams: [], watchLinks: [], deErstausgabe: erst }), kontext({ discTitel: new Set([1]) })).includes('erstausgabe-ohne-weg'))
pruefe('erstausgabe-ohne-weg: mit Weg kein Treffer', !arten(gut(1, { deErstausgabe: erst })).includes('erstausgabe-ohne-weg'))
pruefe('termin-fehlt-laufend: Treffer', arten(gut(1, { jpEnd: undefined })).join() === 'termin-fehlt-laufend')
pruefe('termin-fehlt-laufend: Termin da oder Serie beendet: kein Treffer', arten(gut(1, { jpEnd: undefined }), kontext({ kuenftig: new Set([1]) })).length === 0 && arten(gut(1)).length === 0)
pruefe('sprachurteil-offen: Treffer', arten(gut(1, { streams: [{ platform: 'netflix', url: 'u' }] as Title['streams'] })).join() === 'sprachurteil-offen')
pruefe('sprachurteil-offen: ein Urteil genügt', !arten(gut(1, { streams: [{ platform: 'netflix', url: 'u', dub: false }, { platform: 'adn', url: 'v' }] as Title['streams'] })).includes('sprachurteil-offen'))
pruefe('synchro-schwach: Treffer', arten(gut(1, { dubConfidence: 'low' })).join() === 'synchro-schwach')
pruefe('synchro-schwach: normal ist kein Treffer', arten(gut(1, { dubConfidence: 'normal' })).length === 0)
pruefe('erschienen-ohne-weg: Treffer', arten(gut(1), mitReleases(rel({ platform: 'adn' }))).join() === 'erschienen-ohne-weg')
pruefe('erschienen-ohne-weg: Plattform vorhanden, künftig oder Disc kein Treffer',
  arten(gut(1), mitReleases(rel({ platform: 'netflix' }), rel({ platform: 'adn', schedule: { firstEpisodeDate: '2027-01-01' } as never }), rel({ platform: 'disc' }))).length === 0)
pruefe('folgenzahl-widerspruch: Release mit mehr Folgen', arten(gut(1), mitReleases(rel({ schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 24 } }))).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: Liste länger als Folgenzahl', arten(gut(1), kontext({ folgen: () => ({ f: Array.from({ length: 13 }, (_, i) => [i + 1, 'x'] as [number, string]) }) })).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: Disc mit mehr Folgen zählt nicht', arten(gut(1), mitReleases(rel({ releaseType: 'disc', platform: 'disc', schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 99 } }))).length === 0)
const strom = (url: string, extra = {}) => [{ platform: 'netflix', url, dub: true, ...extra }] as Title['streams']
const geteilt = adresseMehrfach([gut(1, { streams: strom('x') }), gut(2, { streams: strom('x') }), gut(3, { streams: strom('x', { sharedWith: 1 }) }), gut(4)])
pruefe('adresse-mehrfach: gleiche Adresse bei zwei Titeln; `sharedWith` und Einzelne ausgenommen', [...geteilt].sort().join() === '1,2', [...geteilt])
pruefe('adresse-mehrfach: Regel nutzt die Menge', arten(gut(1), kontext({ adresseMehrfach: new Set([1]) })).join() === 'adresse-mehrfach')

/* Fortschreibung */
const T = (t: number, art: string, grund?: string) => ({ t, art, wirkung: 2, wer: 'daniel' as const, ...(grund ? { grund } : {}) })
const ARTEN = ['a', 'b']
const zeile = (r: ReturnType<typeof schreibeFort>, t: number) => r.zeilen.find((z) => z.t === t)!
const erst1 = schreibeFort(null, [T(1, 'a'), T(2, 'a'), T(3, 'b', 'zu-recht')], ARTEN, '2026-11-01')
pruefe('Erstlauf: offen gezählt, nichts „neu“, Ausnahme nur im Zähler', erst1.zaehler.a!.offen === 2 && erst1.zaehler.a!.neu === 0 && erst1.zaehler.b!.ausnahme === 1 && erst1.zeilen.length === 2 && erst1.zeilen.every((z) => !z.ereignis), erst1)
const zweit = schreibeFort(erst1, [T(1, 'a'), T(4, 'a')], ARTEN, '2026-11-05')
pruefe('`seit` bleibt, solange offen', zeile(zweit, 1).seit === '2026-11-01' && !zeile(zweit, 1).ereignis, zweit)
pruefe('neuer Titel: neu + ereignis, `seit` heute', zweit.zaehler.a!.neu === 1 && zeile(zweit, 4).ereignis === 'neu' && zeile(zweit, 4).seit === '2026-11-05', zweit)
pruefe('verschwundener Mangel: behoben mit `bis`, `seit` bleibt', zweit.zaehler.a!.behoben === 1 && zeile(zweit, 2).status === 'behoben' && zeile(zweit, 2).bis === '2026-11-05' && zeile(zweit, 2).seit === '2026-11-01', zeile(zweit, 2))
const dritt = schreibeFort(zweit, [T(1, 'a'), T(4, 'a')], ARTEN, '2026-11-06')
pruefe('behoben bleibt erhalten, zählt nicht erneut; Ereignis des Vortags ist weg', zeile(dritt, 2).status === 'behoben' && dritt.zaehler.a!.behoben === 0 && !zeile(dritt, 4).ereignis, dritt)
const rueck = schreibeFort(dritt, [T(1, 'a'), T(2, 'a'), T(4, 'a')], ARTEN, '2026-11-07')
pruefe('Rückfall: behoben und wieder offen, `seit` neu', rueck.zaehler.a!.rueckfall === 1 && rueck.zaehler.a!.neu === 0 && zeile(rueck, 2).ereignis === 'rueckfall' && zeile(rueck, 2).status === 'offen' && zeile(rueck, 2).seit === '2026-11-07', rueck)
const alt = schreibeFort(zweit, [T(1, 'a'), T(4, 'a')], ARTEN, '2027-02-20')
pruefe('behobene Zeile verfällt nach 90 Tagen', !alt.zeilen.some((z) => z.t === 2), alt)
const stabil = schreibeFort(null, [T(9, 'b'), T(2, 'a'), T(1, 'a')], ARTEN, '2026-11-01')
pruefe('Zeilen stabil sortiert: Art (Tabellenreihenfolge), dann Kennung', stabil.zeilen.map((z) => `${z.art}${z.t}`).join() === 'a1,a2,b9', stabil)
pruefe('Serialisierung ist gültiges JSON und gibt dasselbe Register zurück', JSON.stringify(JSON.parse(serialisiere(rueck))) === JSON.stringify(rueck))
pruefe('Serialisierung: eine Zeile je Mangel', serialisiere(rueck).split('\n').filter((l) => l.includes('"art"')).length === rueck.zeilen.length)
pruefe('Verlauf: offen je Art', JSON.stringify(offeneJeArt(rueck)) === '{"a":3,"b":0}', offeneJeArt(rueck))
const cover = schreibeFort(erst1, [T(1, 'cover'), T(2, 'cover')], ['cover'], '2026-11-02')
pruefe('Wache: NEU und RÜCKFALL je Art mit Beispielen', meldungen(zweit, 'neu').join() === 'a: 1 (4)' && meldungen(rueck, 'rueckfall').join() === 'a: 1 (2)', [meldungen(zweit, 'neu'), meldungen(rueck, 'rueckfall')])
pruefe('Wache: Cover bleibt draußen', meldungen(cover, 'neu').length === 0, meldungen(cover, 'neu'))
pruefe('Warnzeilen: je Ereignis eine Zeile mit Präfix', JSON.stringify(maengelWarnZeilen(rueck)) === '["MAENGEL_RUECKFALL a: 1 (2)"]' && JSON.stringify(maengelWarnZeilen(zweit)) === '["MAENGEL_NEU a: 1 (4)"]', [maengelWarnZeilen(rueck), maengelWarnZeilen(zweit)])
pruefe('Warnzeilen: ohne Register oder ohne Ereignis keine', maengelWarnZeilen(null).length === 0 && maengelWarnZeilen(dritt).length === 0 && maengelWarnZeilen(cover).length === 0)
const messwerte = { mitStreamingWeg: 100, erstausgabeOhneWeg: 5 }
pruefe('`warnZeilen` reicht die Mängel durch, zuletzt, ohne Register wie bisher', warnZeilen(messwerte, messwerte, zweit).join() === 'MAENGEL_NEU a: 1 (4)' && warnZeilen(messwerte, messwerte).length === 0, warnZeilen(messwerte, messwerte, zweit))
pruefe('`warnZeilen`: Streaming-Rückgang bleibt vor den Mängeln', warnZeilen({ mitStreamingWeg: 50, erstausgabeOhneWeg: 5 }, messwerte, zweit).map((z) => z.split(' ')[0]).join() === 'STREAMING_RUECKGANG,MAENGEL_NEU')
const viele = schreibeFort(erst1, [1, 2, 3, 4, 5].map((t) => T(t, 'b')), ARTEN, '2026-11-02')
pruefe('Wache: mehr als drei Beispiele enden auf „…“', meldungen(viele, 'neu').join() === 'b: 5 (1, 2, 3, …)', meldungen(viele, 'neu'))

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('Mängel-Register: alle Prüfungen bestanden')

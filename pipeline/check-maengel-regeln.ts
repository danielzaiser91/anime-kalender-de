/** Test der Regeltabelle des Mängel-Registers: je Regel Treffer, Ausnahme und Grenzfälle. Die Fortschreibung testet `check-maengel-register.ts`. */
import type { Release, Title } from '../shared/types.ts'
import { adresseMehrfach, REGELN, zaehleMaengel, type Kontext } from './lib/maengel-regeln.ts'
import { baueNeinGilt } from './lib/maengel-nein.ts'

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
  adresseMehrfach: new Map(),
  staffelZuordnung: new Map(),
  franchiseTeile: () => [],
  neinGilt: () => false,
  ...ueber,
})
const arten = (t: Title, k = kontext()) => zaehleMaengel([t], k).map((x) => (x.grund ? `${x.art}:${x.grund}` : x.art))
const rel = (ueber: Partial<Release>): Release => ({ titleId: 1, platform: 'netflix', releaseType: 'batch', sources: [{ url: 'https://q' }], schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 12 }, ...ueber } as unknown as Release)
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
pruefe('folgenzahl: läuft noch (kein Ende) ist Ausnahme, auch eine junge Serie', arten(gut(1, { episodes: undefined, jpEnd: undefined, jpYear: 2026 }), kontext({ folgen: () => undefined, kuenftig: new Set([1]) })).join() === 'folgenzahl:laeuft' && arten(gut(1, { episodes: undefined, jpEnd: undefined, jpYear: 1999 }), kontext({ folgen: () => undefined, kuenftig: new Set([1]) })).join() === 'folgenzahl:laeuft')
pruefe('folgenzahl: Ende heute läuft noch, Ende gestern ist offen', arten(gut(1, { episodes: undefined, jpEnd: HEUTE }), ohneFolgen).includes('folgenzahl:laeuft') && arten(gut(1, { episodes: undefined, jpEnd: '2026-11-15' }), ohneFolgen).join() === 'folgenzahl')
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
const sichtung = (ueber: Partial<Release> = {}) => rel({ releaseType: 'weekly', tvLetzteSichtung: '2026-11-14', ...ueber })
pruefe('termin-fehlt-laufend: nur Sichtungen (Beyblade X) schreiben nichts fort: Ausnahme nur-sichtung',
  arten(gut(1, { jpEnd: undefined }), mitReleases(sichtung(), sichtung({ releaseType: 'batch' }))).join() === 'termin-fehlt-laufend:nur-sichtung')
pruefe('termin-fehlt-laufend: ein Termin ohne Sichtung daneben und keine Releases bleiben Treffer, ein Disc-Termin ändert nichts',
  arten(gut(1, { jpEnd: undefined }), mitReleases(sichtung(), rel({ releaseType: 'weekly' }))).join() === 'termin-fehlt-laufend'
  && arten(gut(1, { jpEnd: undefined }), mitReleases(sichtung(), rel({ releaseType: 'disc', platform: 'disc' }))).join() === 'termin-fehlt-laufend:nur-sichtung'
  && arten(gut(1, { jpEnd: undefined }), mitReleases()).join() === 'termin-fehlt-laufend')
pruefe('termin-fehlt-laufend: echter Bestand Beyblade X (165159): zwei Sichtungen plus alter Batch (dort Disney+) ohne Sichtung: Ausnahme nur-sichtung',
  arten(gut(1, { jpEnd: undefined }), mitReleases(sichtung(), sichtung(), rel({ releaseType: 'batch' }))).join() === 'termin-fehlt-laufend:nur-sichtung')
pruefe('sprachurteil-offen: Treffer', arten(gut(1, { streams: [{ platform: 'netflix', url: 'u' }] as Title['streams'] })).join() === 'sprachurteil-offen')
pruefe('sprachurteil-offen: ein Urteil genügt', !arten(gut(1, { streams: [{ platform: 'netflix', url: 'u', dub: false }, { platform: 'adn', url: 'v' }] as Title['streams'] })).includes('sprachurteil-offen'))
pruefe('synchro-schwach: Treffer', arten(gut(1, { dubConfidence: 'low' })).join() === 'synchro-schwach')
pruefe('synchro-schwach: normal ist kein Treffer', arten(gut(1, { dubConfidence: 'normal' })).length === 0)
pruefe('erschienen-ohne-weg: Treffer', arten(gut(1), mitReleases(rel({ platform: 'adn' }))).join() === 'erschienen-ohne-weg')
pruefe('erschienen-ohne-weg: Plattform vorhanden, künftig oder Disc kein Treffer',
  arten(gut(1), mitReleases(rel({ platform: 'netflix' }), rel({ platform: 'adn', schedule: { firstEpisodeDate: '2027-01-01' } as never }), rel({ platform: 'disc' }))).length === 0)
const adnTermin = (ueber: Partial<Release> = {}) => mitReleases(rel({ platform: 'adn', ...ueber }))
const geschaetzt = adnTermin({ schedule: { firstEpisodeDate: '2026-01-01', estimated: true } as never })
pruefe('erschienen-ohne-weg: ein geschätzter Termin ist kein Erscheinen (11-7 baut dafür auch keinen Weg), er zählt als termin-geschaetzt-ohne-weg', arten(gut(1), geschaetzt).join() === 'termin-geschaetzt-ohne-weg')
pruefe('termin-geschaetzt-ohne-weg: sicherer Termin, Weg vorhanden, künftiger Termin und Termin ohne Quelle sind kein Treffer', [
  adnTermin(), mitReleases(rel({ platform: 'netflix', schedule: { firstEpisodeDate: '2026-01-01', estimated: true } as never })),
  mitReleases(rel({ platform: 'adn', schedule: { firstEpisodeDate: '2999-01-01', estimated: true } as never })), mitReleases(rel({ platform: 'adn', sources: [], schedule: { firstEpisodeDate: '2026-01-01', estimated: true } as never })),
].every((k) => !arten(gut(1), k).includes('termin-geschaetzt-ohne-weg')))
pruefe('erschienen-ohne-weg: ein Termin ohne Quelle zählt nicht', arten(gut(1), adnTermin({ sources: [] })).length === 0)
pruefe('erschienen-ohne-weg: belegtes Nein ist Ausnahme, ohne Nein bleibt es offen', arten(gut(1), { ...adnTermin(), neinGilt: () => true }).filter((a) => a.startsWith('erschienen')).join() === 'erschienen-ohne-weg:belegtes-nein' && arten(gut(1), adnTermin()).join() === 'erschienen-ohne-weg')
pruefe('erschienen-ohne-weg: Nein nur für eine von zwei Plattformen bleibt offen', arten(gut(1), { ...mitReleases(rel({ platform: 'adn' }), rel({ platform: 'primevideo' })), neinGilt: (_i, p) => p === 'adn' }).filter((a) => a.startsWith('erschienen')).join() === 'erschienen-ohne-weg')
const mitNein = (ueber: Partial<Release>) => ({ ...adnTermin(ueber), neinGilt: () => true })
pruefe('termin-trotz-nein: Nein belegt, Termin ohne sprache → Mangel; mit omu → nur Ausnahme belegtes-nein; ohne Nein kein Treffer', arten(gut(1), mitNein({})).includes('termin-trotz-nein') && !arten(gut(1), mitNein({ sprache: 'omu' })).includes('termin-trotz-nein') && arten(gut(1), mitNein({ sprache: 'omu' })).join() === 'erschienen-ohne-weg:belegtes-nein' && !arten(gut(1), adnTermin()).includes('termin-trotz-nein'))
pruefe('termin-trotz-nein: auch „offen“ ist eine Kennzeichnung (der Termin sagt selbst „Synchro offen“), kein Mangel', !arten(gut(1), mitNein({ sprache: 'offen' })).includes('termin-trotz-nein') && arten(gut(1), mitNein({ sprache: 'offen' })).join() === 'erschienen-ohne-weg:belegtes-nein')
const beleg = (ueber: object) => ({ anilistId: 1, platform: 'primevideo', ...ueber }) as Parameters<typeof baueNeinGilt>[0][number]
const nichtVerfuegbar = baueNeinGilt([beleg({ available: false, checkedAt: '2026-08-30' })])
pruefe('neinGilt: „nicht verfügbar“ vor dem Termin ist überholt, am Termintag und danach gilt es', !nichtVerfuegbar(1, 'primevideo', '2026-09-13') && nichtVerfuegbar(1, 'primevideo', '2026-08-30') && nichtVerfuegbar(1, 'primevideo', '2026-08-01'))
const eigeneAdresse = baueNeinGilt([beleg({ dub: true, url: 'https://www.amazon.de/dp/B000000001', checkedAt: '2026-09-01' }), beleg({ dub: false, url: 'https://www.amazon.de/dp/B000000002', checkedAt: '2026-09-02' })])
pruefe('neinGilt: Nein an einer Kanal-Adresse neben einem Ja an anderer Adresse gilt über den Adress-Schlüssel', eigeneAdresse(1, 'primevideo', '2026-10-01'))
const ohneTon = baueNeinGilt([beleg({ dub: false, checkedAt: '2026-09-14' })])
pruefe('neinGilt: „ohne deutschen Ton“ gilt auch für einen späteren Termin; andere Plattform und Titel nicht', ohneTon(1, 'primevideo', '2026-10-15') && !ohneTon(1, 'netflix', '2026-10-15') && !ohneTon(2, 'primevideo', '2026-10-15'))
pruefe('folgenzahl-widerspruch: Release mit mehr Folgen', arten(gut(1), mitReleases(rel({ schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 24 } }))).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: Liste länger als Folgenzahl', arten(gut(1), kontext({ folgen: () => ({ f: Array.from({ length: 13 }, (_, i) => [i + 1, 'x'] as [number, string]) }) })).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: Disc mit mehr Folgen zählt nicht', arten(gut(1), mitReleases(rel({ releaseType: 'disc', platform: 'disc', schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 99 } }))).length === 0)
// Echte Zeilen vom 17.11.2026: Gantz (13, Prime 26, Staffel 2 hat 13), Wolf’s Rain (26, ADN 30, OVA 4), Zexal II (73, Prime 97, keine Summe passt), Super Wings (52, TV 59 nur gesichtet).
const wid = (t: Title, k: Kontext) => arten(t, k).filter((a) => a.startsWith('folgenzahl-widerspruch'))
const primeZahl = (n: number, extra = {}) => rel({ platform: 'primevideo', schedule: { firstEpisodeDate: '2026-09-10', episodeCount: n, ...extra } })
const gantz = gut(1, { episodes: 13, franchiseId: 1 })
pruefe('folgenzahl-widerspruch: Zahl = Titel + alle Serien-Staffeln des Franchise (Gantz) ist Ausnahme', wid(gantz, { ...mitReleases(primeZahl(26)), folgen: () => ({ f: Array.from({ length: 13 }, (_, i) => [i + 1, 'x'] as [number, string]) }), franchiseTeile: () => [{ format: 'TV', episodes: 13 }, { format: 'MOVIE', episodes: 1 }] }).join() === 'folgenzahl-widerspruch:anbieter-franchise')
pruefe('folgenzahl-widerspruch: Zahl = Titel + OVA (Wolf’s Rain 26 + 4) ist Ausnahme, auch für die Liste', wid(gut(1, { episodes: 26 }), { ...kontext({ folgen: () => ({ f: Array.from({ length: 30 }, (_, i) => [i + 1, 'x'] as [number, string]) }), franchiseTeile: () => [{ format: 'OVA', episodes: 4 }] }) }).join() === 'folgenzahl-widerspruch:anbieter-franchise')
pruefe('folgenzahl-widerspruch: Zexal II 97 ohne passende Summe bleibt offen', wid(gut(1, { episodes: 73 }), { ...mitReleases(primeZahl(97)), folgen: () => undefined, franchiseTeile: () => [{ format: 'TV', episodes: 224 }, { format: 'TV', episodes: 73 }, { format: 'OVA', episodes: 1 }] }).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: ein Film zählt nicht als Zugabe', wid(gut(1, { episodes: 26 }), { ...mitReleases(primeZahl(27)), folgen: () => undefined, franchiseTeile: () => [{ format: 'MOVIE', episodes: 1 }] }).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: eine erklärte und eine unerklärte Zahl bleiben offen', wid(gut(1, { episodes: 26 }), { ...mitReleases(primeZahl(27)), folgen: () => ({ f: Array.from({ length: 30 }, (_, i) => [i + 1, 'x'] as [number, string]) }), franchiseTeile: () => [{ format: 'OVA', episodes: 4 }] }).join() === 'folgenzahl-widerspruch')
pruefe('folgenzahl-widerspruch: nur gesichtete Zahl (Super Wings 59 > 52) ist Ausnahme', wid(gut(1, { episodes: 52 }), { ...mitReleases(rel({ platform: 'tv', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-07', episodeCount: 59, episodeCountAssumed: true, episodeCountNurGesichtet: true } })), folgen: () => undefined }).join() === 'folgenzahl-widerspruch:nur-gesichtet')
pruefe('folgenzahl-widerspruch: drei Zugaben als Summe erklären nichts (Grenze zwei)', wid(gut(1, { episodes: 26 }), { ...mitReleases(primeZahl(29)), folgen: () => undefined, franchiseTeile: () => [{ format: 'OVA', episodes: 1 }, { format: 'OVA', episodes: 1 }, { format: 'SPECIAL', episodes: 1 }] }).join() === 'folgenzahl-widerspruch')
const strom = (url: string, extra = {}) => [{ platform: 'netflix', url, dub: true, ...extra }] as Title['streams']
const geteilt = adresseMehrfach([gut(1, { streams: strom('x'), franchiseId: 10 }), gut(2, { streams: strom('x'), franchiseId: 20 }), gut(3, { streams: strom('x', { sharedWith: 3 }), franchiseId: 30 }), gut(4)])
pruefe('adresse-mehrfach: zwei fremde Titel, eine Adresse → Mangel, auch mit `sharedWith` (der Vermerk verdeckt nichts); Einzelne nicht', [...geteilt].map(([i, w]) => `${i}${w}`).sort().join() === '1fremd,2fremd,3fremd', [...geteilt])
const staffeln = adresseMehrfach([gut(1, { streams: strom('y'), franchiseId: 10 }), gut(2, { streams: strom('y', { sharedWith: 2 }), franchiseId: 10 })])
pruefe('adresse-mehrfach: zwei Staffeln eines Franchise → kein offener Mangel, sondern Ausnahme gleiches-franchise', [...staffeln.values()].join() === 'franchise,franchise' && arten(gut(1), kontext({ adresseMehrfach: staffeln })).join() === 'adresse-mehrfach:gleiches-franchise')
const leerWeg = (id: number) => gut(id, { streams: [{ platform: 'disneyplus', url: '' }] as Title['streams'] })
pruefe('adresse-mehrfach: leere Adresse zählt nicht als gleiche (Grenzfall: zwei Titel mit url "")', adresseMehrfach([leerWeg(1), leerWeg(2)]).size === 0)
pruefe('weg-ohne-adresse: Weg mit leerer url trifft, mit Adresse nicht', arten(leerWeg(1)).includes('weg-ohne-adresse') && !arten(gut(1)).includes('weg-ohne-adresse'))
pruefe('adresse-mehrfach: Regel nutzt die Menge', arten(gut(1), kontext({ adresseMehrfach: new Map([[1, 'fremd']]) })).join() === 'adresse-mehrfach' && arten(gut(1), kontext({ adresseMehrfach: new Map([[1, 'franchise']]) })).join() === 'adresse-mehrfach:gleiches-franchise')

/* Grenzfälle und Einheitlichkeit (Prüfer-Auflagen N4, N7) */
const regel = (art: string) => REGELN.find((r) => r.art === art)!
pruefe('Tabelle: cover und kein-weg tragen Wirkung 3; wer auto:tmdb-poster bzw. daniel', regel('cover').wirkung === 3 && regel('cover').wer === 'auto:tmdb-poster' && regel('kein-weg').wirkung === 3 && regel('kein-weg').wer === 'daniel')
pruefe('folgentitel: SPECIAL und MUSIC mit mehreren Folgen sind keine Ausnahme', ['SPECIAL', 'MUSIC', 'OVA'].every((f) => arten(gut(1, { format: f as Title['format'] }), ohneFolgen).join() === 'folgentitel'))
pruefe('kein-weg: Disc-Termin ist ein Weg (wie bei erstausgabe-ohne-weg)', !arten(gut(1, { streams: [], watchLinks: [] }), kontext({ discTitel: new Set([1]) })).includes('kein-weg') && arten(gut(1, { streams: [], watchLinks: [] }), kontext({ discTitel: new Set([2]) })).includes('kein-weg'))
const ohneWeg = (ueber: Partial<Title> = {}) => gut(1, { streams: [], watchLinks: [], ...ueber })
const kino = (tag: string, ueber: Partial<Release> = {}) => rel({ platform: 'kino', releaseType: 'movie', schedule: { firstEpisodeDate: tag }, ...ueber })
pruefe('kein-weg: Kinostart ab heute mit Quelle ist der Weg (Witch on the Holy Night), gestern oder ohne Quelle nicht', arten(ohneWeg(), mitReleases(kino('2027-01-26'))).join() === 'kein-weg:kinostart' && arten(ohneWeg(), mitReleases(kino(HEUTE))).join() === 'kein-weg:kinostart' && arten(ohneWeg(), mitReleases(kino('2026-11-15'))).join() === 'kein-weg' && arten(ohneWeg(), mitReleases(kino('2027-01-26', { sources: [] }))).join() === 'kein-weg')
pruefe('kein-weg: nur ein Kinostart, nicht Fernsehen oder Disc-Termin, nimmt die Lücke', arten(ohneWeg(), mitReleases(rel({ platform: 'tv', schedule: { firstEpisodeDate: '2027-01-26' } }))).join() === 'kein-weg')
const ohneDatum = { jpYear: undefined, jpEnd: undefined, jpStart: undefined, jpSeason: undefined }
pruefe('kein-weg: ohne Erscheinungsdatum und ohne Termin ist noch nichts da (Crown Handler 5/6)', arten(ohneWeg({ ...ohneDatum, format: 'MOVIE' })).filter((a) => a.startsWith('kein-weg')).join() === 'kein-weg:unveroeffentlicht')
pruefe('kein-weg: Jahr, Ende, Start oder irgendein Termin heben die Ausnahme auf', [{ jpYear: 1977 }, { jpEnd: '2020-01-01' }, { jpStart: '2020-01' }].every((d) => arten(ohneWeg({ ...ohneDatum, ...d })).filter((a) => a.startsWith('kein-weg')).join() === 'kein-weg') && arten(ohneWeg(ohneDatum), mitReleases(rel({ platform: 'joyn', schedule: { firstEpisodeDate: '2026-11-03', estimated: true } }))).filter((a) => a.startsWith('kein-weg')).join() === 'kein-weg')
pruefe('erschienen-ohne-weg: Erscheinungstag heute zählt, morgen nicht', arten(gut(1), mitReleases(rel({ platform: 'adn', schedule: { firstEpisodeDate: HEUTE } }))).join() === 'erschienen-ohne-weg' && arten(gut(1), mitReleases(rel({ platform: 'adn', schedule: { firstEpisodeDate: '2026-11-17' } }))).length === 0)
pruefe('erschienen-ohne-weg: Fernsehen und Kino sind keine Streamingplattform', arten(gut(1), mitReleases(rel({ platform: 'tv' }), rel({ platform: 'kino' }))).length === 0)
pruefe('termin-fehlt-laufend: Ende heute läuft noch, Ende gestern nicht', arten(gut(1, { jpEnd: HEUTE })).join() === 'termin-fehlt-laufend' && arten(gut(1, { jpEnd: '2026-11-15' })).length === 0)
/* herkunft-fremder-titel: Namenstreffer (normierter Teilstring) und Staffelzahl bei Titeln über mehrere Staffeln */
const auto = (herkunft: string) => rel({ automatisch: true, herkunft: `Automatisch übernommen aus „${herkunft}".` })
const fremd = (titel: Partial<Title>, herkunft: string) => arten(gut(1, titel), mitReleases(auto(herkunft))).includes('herkunft-fremder-titel')
pruefe('herkunft-fremder-titel: Name fehlt im Titel → trifft (ohne Staffel, nur der Name entscheidet)', fremd({ titleDe: 'Boruto: Naruto Next Generations' }, '»Naruto Shippuden«'))
pruefe('herkunft-fremder-titel: Boruto an „»Naruto Shippuden« – Staffel 4“ trifft', fremd({ titleDe: 'Boruto: Naruto Next Generations', episodes: 293 }, '»Naruto Shippuden« – Staffel 4'))
pruefe('herkunft-fremder-titel: Zexal (73 Folgen) an „»Yu-Gi-Oh!« – Staffel 5“ trifft (Name steckt drin, Staffel nicht)', fremd({ titleDe: 'Yu-Gi-Oh! Zexal', episodes: 73 }, '»Yu-Gi-Oh!« – Staffel 5'))
pruefe('herkunft-fremder-titel: Staffel mit Zahl im Namen, Staffel 1, kurzer Titel (Minami-ke, 13 Folgen) und Namensvariante treffen nicht',
  !fremd({ titleDe: 'Call of the Night: Season 2', episodes: 13 }, '»Call of the Night« – Staffel 2') && !fremd({ titleDe: 'Yu-Gi-Oh! Zexal', episodes: 73 }, '»Yu-Gi-Oh!« – Staffel 1')
  && !fremd({ titleDe: 'Minami-ke: Korekara', episodes: 13 }, '»Minami-ke« – Staffel 5') && !fremd({ titleDe: 'Chaika, die Sargprinzessin' }, '»Chaika – Die Sargprinzessin« – Staffel 1'))
pruefe('herkunft-fremder-titel: Artikelname länger als der Titel („Chaika – Die Sargprinzessin“ an „Chaika“) trifft nicht', !fremd({ titleDe: 'Chaika' }, '»Chaika – Die Sargprinzessin«'))
pruefe('herkunft-fremder-titel: Termin von Hand oder ohne Artikelnamen zählt nicht', arten(gut(1, { titleDe: 'Boruto' }), mitReleases(rel({ herkunft: '»Naruto«' }), auto('Neue Folgen im Dezember'))).length === 0)

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('Mängel-Regeln: alle Prüfungen bestanden')

/**
 * Prozess-Test: Ein Abruf ohne Auskunft (Störung, Fehltreffer, leere Antwort, älterer Ausleser) löscht nichts Belegtes
 * (`check-youtube.ts`, `fetch-justwatch-audio.ts`, `fetch-tmdb-titles.ts`, `fetch-voices.ts`, `fetch-anisearch-titel.ts`). Jedes Skript läuft als eigener Prozess auf einer Kulisse im Temp-Ordner
 * (`AK_ROOT`), mit fester Uhr, abgeschaltetem `setTimeout`-Warten und einem `fetch`, der nur die Antwort der Quelle liefert.
 * Ersetzt Quelltext-Zusicherungen in `check-logic.ts`. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = join(import.meta.dirname, '..')
const JETZT = '2026-10-23T12:00:00Z'
const HEUTE = '2026-10-23'
const ALT = '2026-01-01'
const INHALT = '2026-09-01'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

interface Lauf {
  text: string
  status: number | null
  datei: (pfad: string) => unknown
}

/** Ein Skript auf einer Kulisse: `dateien` (Pfad → Inhalt) vorher anlegen, `stub` ersetzt `fetch`; danach lässt sich jede Datei lesen. */
function lauf(skript: string, dateien: Record<string, unknown>, stub: string, args: string[], env: Record<string, string> = {}): Lauf {
  const wurzel = mkdtempSync(join(tmpdir(), 'abruf-stoerung-'))
  try {
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
      writeFileSync(join(wurzel, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
    }
    const uhr = pathToFileURL(join(REPO, 'tools', 'feste-uhr.ts')).href
    const ziel = pathToFileURL(join(REPO, 'pipeline', skript)).href
    const huelle = join(wurzel, 'huelle.mts')
    const kopf = `import { festeUhr } from '${uhr}'\nfesteUhr('${JETZT}')\nglobalThis.setTimeout = ((f) => { f(); return 0 }) as typeof setTimeout\n`
    writeFileSync(huelle, `${kopf}globalThis.fetch = ${stub}\nawait import('${ziel}')\n`)
    const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const r = spawnSync(process.execPath, [tsx, huelle, ...args], {
      cwd: wurzel,
      env: { ...process.env, AK_ROOT: wurzel, ...env },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
    /* Jede angelegte Datei, wie sie nach dem Lauf dasteht (JSON gelesen, sonst als Text). */
    const lies = (pfad: string): unknown => {
      const text = readFileSync(join(wurzel, pfad), 'utf8')
      try {
        return JSON.parse(text) as unknown
      } catch {
        return text
      }
    }
    const danach = Object.fromEntries(Object.keys(dateien).map((pfad) => [pfad, lies(pfad)]))
    return { text: `${r.stdout}${r.stderr}`, status: r.status, datei: (pfad) => danach[pfad] }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

/* ---- YouTube: Kontingentfehler (403) bei jedem Abruf ---- */
const quota = `async () => new Response(JSON.stringify({ error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })`
const video = (n: number) => `https://www.youtube.com/watch?v=VID${String(n).padStart(8, '0')}`
const ytTitel = (urls: string[]) => [{ id: 900001, streams: urls.map((url) => ({ platform: 'youtube', url })) }]
const gut = { art: 'video', gesamt: 1, inDE: 1, geprueftAm: ALT }
const YT_ARGS = ['--limit', '0']
const YT_ENV = { YOUTUBE_API_KEY: 'test' }

const yt1 = lauf('check-youtube.ts', { 'public/data/titles.json': ytTitel([video(1), video(2)]), 'data/youtube-check.json': { [video(1)]: gut } }, quota, YT_ARGS, YT_ENV)
pruefe('YouTube: der Lauf endet mit Exit 0', yt1.status === 0, yt1.text.slice(-300))
const yt1Datei = yt1.datei('data/youtube-check.json') as Record<string, Record<string, unknown>>
pruefe('YouTube: eine Störung lässt den guten Befund byte-gleich stehen', JSON.stringify(yt1Datei[video(1)]) === JSON.stringify(gut), yt1Datei[video(1)])
pruefe('YouTube: eine Störung bei neuer Adresse wird als „unklar“ abgelegt, nicht als toter Verweis', yt1Datei[video(2)]?.unklar === true && yt1Datei[video(2)]?.inDE === 0, yt1Datei[video(2)])
pruefe('YouTube: die Störung steht im Log mit ihrem Grund', /quotaExceeded/.test(yt1.text), yt1.text.slice(-300))

const viele = Array.from({ length: 20 }, (_, i) => video(100 + i))
const ytVorher = { vorher: gut }
const yt2 = lauf('check-youtube.ts', { 'public/data/titles.json': ytTitel(viele), 'data/youtube-check.json': ytVorher }, quota, YT_ARGS, YT_ENV)
pruefe('YouTube: ein Lauf voller Störungen endet mit Exit 0', yt2.status === 0, yt2.text.slice(-300))
pruefe('YouTube: 20 Störungen bei 20 Abfragen — „unplausibel, nichts geschrieben“', /20 Störungen bei 20 Abfragen — unplausibel, nichts geschrieben/.test(yt2.text), yt2.text.slice(-300))
pruefe('YouTube: ein unplausibler Lauf lässt die Datei unverändert', JSON.stringify(yt2.datei('data/youtube-check.json')) === JSON.stringify(ytVorher), yt2.datei('data/youtube-check.json'))

/* ---- JustWatch: Suche ohne Treffer ---- */
const jwTitel = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: 900001 + i, tmdbId: 1 + i, titleDe: `Film ${i + 1}`, format: 'MOVIE', streams: [], watchLinks: [] }))
const jwAngebot = { anbieter: 'Amazon Video', art: 'BUY', audio: ['de'], untertitel: [], url: 'https://watch.amazon.de/detail?gti=x' }
const jwGut = (i: number) => ({ geprueftAm: ALT, erstAm: ALT, jwId: `tm${900001 + i}`, tmdbId: 1 + i, altersangabe: '12', angebote: [jwAngebot] })
const jwDateien = (n: number, bestand: Record<string, unknown>) => ({
  'public/data/titles.json': jwTitel(n),
  'public/data/releases.json': [],
  'data/justwatch-audio.json': bestand,
  'data/tmdb-von-hand.yaml': '[]\n',
})
const jwAntwort = (edges: string) => `async () => new Response(JSON.stringify({ data: { popularTitles: { edges: ${edges} } } }), { status: 200 })`
const leer = jwAntwort('[]')
const treffer = jwAntwort(`[{ node: { id: 'tmNEU', objectType: 'MOVIE', content: { title: 'X', fullPath: '/de/film/x', externalIds: { tmdbId: 1 } }, offers: [], seasons: null } }]`)

const jw1 = lauf('fetch-justwatch-audio.ts', jwDateien(1, { 900001: jwGut(0) }), leer, [])
pruefe('JustWatch: der Lauf endet mit Exit 0 und zählt eine verfehlte Suche', jw1.status === 0 && /1 verfehlt \(alte Antwort behalten\)/.test(jw1.text), jw1.text.slice(-300))
const jw1Datei = jw1.datei('data/justwatch-audio.json') as Record<string, Record<string, unknown>>
pruefe(
  'JustWatch: eine verfehlte Suche behält Kennung und Angebote der alten Antwort',
  jw1Datei['900001']?.jwId === 'tm900001' && JSON.stringify(jw1Datei['900001']?.angebote) === JSON.stringify([jwAngebot]) && jw1Datei['900001']?.ohneTreffer === undefined,
  jw1Datei['900001'],
)
pruefe('JustWatch: … und vermerkt Prüftag und Fehlgriff', jw1Datei['900001']?.verfehltAm === HEUTE && jw1Datei['900001']?.geprueftAm === HEUTE, jw1Datei['900001'])

const jw2 = lauf('fetch-justwatch-audio.ts', jwDateien(1, { 900001: jwGut(0) }), treffer, [])
const jw2Datei = jw2.datei('data/justwatch-audio.json') as Record<string, Record<string, unknown>>
pruefe('Kontrolle JustWatch: ein Treffer ersetzt die Antwort (Kulisse und Stub greifen)', jw2.status === 0 && jw2Datei['900001']?.jwId === 'tmNEU' && jw2Datei['900001']?.verfehltAm === undefined, [jw2.text.slice(-200), jw2Datei['900001']])

const jwBestand20 = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(900001 + i), jwGut(i)]))
const jw3 = lauf('fetch-justwatch-audio.ts', jwDateien(20, jwBestand20), leer, ['--limit', '40'])
pruefe('JustWatch: 20 früher gefundene, jetzt verfehlte Titel — „Ergebnis unplausibel, nichts geschrieben“', jw3.status === 0 && /Ergebnis unplausibel \(.*\) — nichts geschrieben/.test(jw3.text), jw3.text.slice(-300))
pruefe('JustWatch: ein unplausibler Lauf lässt die Datei unverändert', JSON.stringify(jw3.datei('data/justwatch-audio.json')) === JSON.stringify(jwBestand20))

/* ---- TMDB: Suche ohne Treffer (miss) ---- */
const tmdbTitel = [
  { id: 900001, format: 'TV', titleEn: 'Mit Zuordnung' },
  { id: 900002, format: 'TV', titleEn: 'Ohne Zuordnung' },
]
const tmdbBestand = {
  900001: { tmdbId: 123, kind: 'tv', overviewDe: 'Alte Handlung', fetchedAt: INHALT, inhaltAm: INHALT },
  900002: { overviewDe: 'Handlung ohne Kennung', fetchedAt: ALT },
}
const tmdb = lauf(
  'fetch-tmdb-titles.ts',
  { 'public/data/titles.json': tmdbTitel, 'data/tmdb-von-hand.yaml': '[]\n', 'data/tmdb-titles.json': tmdbBestand },
  `async () => new Response(JSON.stringify({ results: [] }), { status: 200 })`,
  [],
  { TMDB_API_KEY: 'test' },
)
const tmdbDatei = tmdb.datei('data/tmdb-titles.json') as Record<string, Record<string, unknown>>
pruefe('TMDB: der Lauf endet mit Exit 0 und fragt beide Titel', tmdb.status === 0 && /2 in diesem Lauf/.test(tmdb.text), tmdb.text.slice(-300))
pruefe(
  'TMDB: ein Fehltreffer behält Kennung und Handlung, nur der Abrufstand rückt vor',
  tmdbDatei['900001']?.tmdbId === 123 && tmdbDatei['900001']?.overviewDe === 'Alte Handlung' && tmdbDatei['900001']?.fetchedAt === `${HEUTE}T12:00:00.000Z` && tmdbDatei['900001']?.inhaltAm === INHALT,
  tmdbDatei['900001'],
)
pruefe('TMDB: ohne gefundene Kennung ersetzt der Fehltreffer den Eintrag', tmdbDatei['900002']?.miss === true && tmdbDatei['900002']?.overviewDe === undefined, tmdbDatei['900002'])

/* ---- Sprecher: eine leere AniList-Antwort ---- */
const stimme = { character: 'A', actor: 'B', role: 'MAIN' }
const alteRollen = { titleId: 900001, updatedAt: ALT, roles: [stimme] }
const leereRollen = { titleId: 900002, updatedAt: ALT, roles: [] }
const voices = lauf(
  'fetch-voices.ts',
  {
    'public/data/titles.json': [{ id: 900001 }, { id: 900002 }, { id: 900003 }],
    'public/data/releases.json': [],
    'public/data/voices/900001.json': alteRollen,
    'public/data/voices/900002.json': leereRollen,
    'public/data/voices/900003.json': 'kein JSON',
  },
  `async () => new Response(JSON.stringify({ data: { Page: { media: [] } } }), { status: 200 })`,
  ['--force'],
)
const rollen = (id: number) => voices.datei(`public/data/voices/${id}.json`) as { updatedAt?: string; roles?: unknown[] } | string
pruefe('Sprecher: der Lauf endet mit Exit 0 und meldet einen behaltenen Titel', voices.status === 0 && /1 Titel behielten ihre belegten Rollen/.test(voices.text), voices.text.slice(-300))
pruefe('Sprecher: eine leere Antwort lässt belegte Rollen byte-gleich stehen', JSON.stringify(rollen(900001)) === JSON.stringify(alteRollen), rollen(900001))
pruefe('Sprecher: eine leere Antwort ersetzt eine Datei ohne Rollen', (rollen(900002) as { updatedAt?: string }).updatedAt === `${HEUTE}T12:00:00.000Z`, rollen(900002))
pruefe('Sprecher: eine unlesbare Datei darf die leere Fassung ersetzen', (rollen(900003) as { roles?: unknown[] }).roles?.length === 0, rollen(900003))

/* ---- aniSearch-Titel: Eintrag aus einem älteren Ausleser ---- */
const asEintrag = (stand?: number) => ({ titel: 'Name', quelle: 'sprachblock', synonyme: [], fetchedAt: '2026-10-01', ...(stand === undefined ? {} : { stand }) })
const asLauf = (stand?: number) =>
  lauf(
    'fetch-anisearch-titel.ts',
    {
      'public/data/ohne-synchro.json': [{ id: 900001, format: 'TV', jpYear: 2020 }],
      'data/anime-ids.json': { anisearch: { 900001: 12345 } },
      'data/anisearch-titel.json': { 900001: asEintrag(stand) },
    },
    `async () => { throw new Error('kein Abruf erwartet') }`,
    ['--limit', '0'],
  )
const offenBei = (stand?: number): string => {
  const r = asLauf(stand)
  return r.status === 0 ? (/(\d+) Titel offen/.exec(r.text)?.[1] ?? r.text.slice(-200)) : `Exit ${r.status}: ${r.text.slice(-200)}`
}
pruefe('aniSearch: ein Eintrag mit dem aktuellen Ausleserstand ist nicht fällig', offenBei(3) === '0', offenBei(3))
pruefe('aniSearch: ein Eintrag aus einem älteren Ausleser (Stand 2) wird wieder fällig', offenBei(2) === '1', offenBei(2))
pruefe('aniSearch: ein Eintrag ohne Stand gilt als Stand 1 und wird fällig', offenBei(undefined) === '1', offenBei(undefined))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log(`check-abruf-stoerung-lauf: ok (${faelle} Fälle, fünf Abrufskripte als Prozess auf Kulisse mit fester Uhr)`)

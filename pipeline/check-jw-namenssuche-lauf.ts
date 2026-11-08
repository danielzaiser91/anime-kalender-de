/**
 * Prozess-Test zur Verdrahtung der Namenssuche in `fetch-justwatch-audio.ts` (`sucheOhneTmdb` in `main()`): das Skript läuft als eigener Prozess auf einer
 * Kulisse im Temp-Ordner (`AK_ROOT`, feste Uhr, `fetch` als Attrappe, die jede Suche mit Namen und Zeit in `aufrufe.txt` mitschreibt).
 * Fünf Titel ohne TMDB-Kennung: 900011 Treffer (Name, Jahr, Art; zwei Suchnamen), 900012 gleicher Name anderes Jahr, 900013 zwei Treffer, 900014 Kennung
 * gehört 900015 (hat TMDB 777002), 900017 Treffer ohne Kennung, dessen JustWatch-Seite schon ein anderer Eintrag hält. 900016 hat TMDB und gehört nicht in
 * die Namenssuche. Ablauf über Tage: Tag 1 fragt, Tag 11 und Tag 21 nicht, Tag 22 wieder (21 Tage Frist, der Bau liest nur bis 28); ein verfehlter zweiter
 * Lauf behält die alte Antwort; ohne `--namen` und mit `--nur-cartoons` bleibt alles beim Alten; `--namen 2` begrenzt; zwischen zwei Suchen liegt eine
 * Pause; drei Sperren in Folge beenden den Lauf, nicht aufeinanderfolgende nicht; ein unplausibler Lauf schreibt nichts; ohne TMDB-Titel wird trotzdem gespeichert.
 * Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = join(import.meta.dirname, '..')
const tag = (n: string) => `${n}T12:00:00Z`

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const titel = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  titleEn: name,
  format: 'SPECIAL',
  episodes: 1,
  jpYear: 2021,
  deErstausgabe: { von: '2020-11-07', synchro: true },
  streams: [],
  watchLinks: [],
  ...extra,
})

const TITEL = [
  titel(900011, 'Anlass Eins', { titleDe: 'Anlass Eins', titleEn: undefined, titleRomaji: 'Anlass Ichi' }),
  titel(900012, 'Falsches Jahr'),
  titel(900013, 'Doppelt'),
  titel(900014, 'Fremd'),
  titel(900015, 'Halter', { tmdbId: 777002 }),
  titel(900016, 'Mit TMDB', { tmdbId: 777003 }),
  titel(900017, 'Abgewiesen'),
]
const HALTER_VORHER = { '900099': { geprueftAm: '2999-01-01', jwId: 'jw77', tmdbId: 5, angebote: [] } }

/** Attrappe: je Suchbegriff eine feste Trefferliste. `MODUS`: `leer` = JustWatch findet nichts, `sperre` = immer 429, `wechsel` = 429 für Namen mit „Sperre“, `ohneangebote` = Treffer ohne Angebote. */
const ATTRAPPE = `
import { appendFileSync } from 'node:fs'
const knoten = (id, typ, title, jahr, tmdb, offers) => ({ id, objectType: typ, content: { title, originalReleaseYear: jahr, fullPath: '/de/film/' + id, ageCertification: '6', externalIds: { tmdbId: tmdb } }, offers: offers ?? [{ monetizationType: 'FLATRATE', audioLanguages: ['de'], subtitleLanguages: [], standardWebURL: 'https://www.netflix.com/title/' + id, package: { clearName: 'Netflix' } }], seasons: [] })
const ANTWORTEN = {
  'Anlass Eins': [knoten('jw11', 'MOVIE', 'Anlass Eins', 2020, '777001'), knoten('jw99', 'SHOW', 'Anlass Eins Reloaded', 2020, '1')],
  'Falsches Jahr': [knoten('jw12', 'MOVIE', 'Falsches Jahr', 1992, '777004')],
  'Doppelt': [knoten('jw13a', 'MOVIE', 'Doppelt', 2020, '777005'), knoten('jw13b', 'MOVIE', 'Doppelt', 2021, '777006')],
  'Fremd': [knoten('jw14', 'MOVIE', 'Fremd', 2020, '777002')],
  'Abgewiesen': [knoten('jw77', 'MOVIE', 'Abgewiesen', 2020, null)],
}
globalThis.fetch = async (url, init) => {
  const q = JSON.parse(init.body).variables.q
  if (q !== undefined) appendFileSync(process.env.AK_ROOT + '/aufrufe.txt', Math.round(performance.now()) + '\\t' + q + '\\n')
  const modus = process.env.MODUS
  if (modus === 'fehler') return new Response('', { status: 404 })
  if (modus === 'sperre' || (modus === 'wechsel' && /Sperre/.test(q ?? ''))) return new Response('', { status: 429, headers: { 'retry-after': '0.001' } })
  const liste = modus === 'leer' ? [] : modus === 'ohneangebote' ? [knoten('jw11', 'MOVIE', q, 2020, '777001', [])] : (ANTWORTEN[q] ?? [])
  /* Wie JustWatch: ein Feld, das die Abfrage nicht nennt, kommt nicht zurück. */
  const fragtJahr = JSON.parse(init.body).query.includes('originalReleaseYear')
  const edges = liste.map((node) => ({ node: { ...node, content: { ...node.content, originalReleaseYear: fragtJahr ? node.content.originalReleaseYear : undefined } } }))
  return new Response(JSON.stringify({ data: { popularTitles: { edges } } }), { status: 200 })
}
`

interface Befund {
  jwId?: string
  tmdbId?: number
  ohneTreffer?: boolean
  ueberName?: boolean
  verfehltAm?: string
  erstAm?: string
  geprueftAm: string
  angebote: { anbieter: string }[]
}
interface Lauf {
  text: string
  status: number | null
  bestand: Record<string, Befund>
  /** Suchbegriffe in der Reihenfolge der Abrufe. */
  aufrufe: string[]
  /** Abstand zwischen zwei aufeinanderfolgenden Abrufen in ms. */
  abstaende: number[]
}

interface Kulisse {
  titel?: unknown[]
  cartoons?: unknown[]
  vorher?: Record<string, unknown>
}

/** Läufe nacheinander auf derselben Kulisse: je Lauf Uhr, Argumente und Modus. */
function laeufe(plan: { tag: string; args?: string[]; modus?: string }[], kulisse: Kulisse = {}): Lauf {
  const wurzel = mkdtempSync(join(tmpdir(), 'jw-namen-'))
  try {
    mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(kulisse.titel ?? TITEL))
    writeFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), JSON.stringify(kulisse.cartoons ?? []))
    writeFileSync(join(wurzel, 'public', 'data', 'releases.json'), '[]')
    writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
    writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(kulisse.vorher ?? HALTER_VORHER))
    const ziel = pathToFileURL(join(REPO, 'pipeline', 'fetch-justwatch-audio.ts')).href
    const uhr = pathToFileURL(join(REPO, 'tools', 'feste-uhr.ts')).href
    const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    let letzter = { text: '', status: null as number | null }
    for (const [i, lauf] of plan.entries()) {
      const huelle = join(wurzel, `huelle${i}.mts`)
      writeFileSync(huelle, `import { festeUhr } from '${uhr}'\nfesteUhr('${tag(lauf.tag)}')\n${ATTRAPPE}\nawait import('${ziel}')\n`)
      const r = spawnSync(process.execPath, [tsx, huelle, '--limit', '0', ...(lauf.args ?? ['--namen', '10'])], {
        cwd: wurzel,
        env: { ...process.env, AK_ROOT: wurzel, MODUS: lauf.modus ?? '' },
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
      })
      letzter = { text: `${r.stdout}${r.stderr}`, status: r.status }
    }
    const datei = join(wurzel, 'data', 'justwatch-audio.json')
    const aufrufe = join(wurzel, 'aufrufe.txt')
    const zeilen = existsSync(aufrufe) ? readFileSync(aufrufe, 'utf8').split('\n').filter(Boolean).map((z) => z.split('\t')) : []
    return {
      ...letzter,
      bestand: JSON.parse(readFileSync(datei, 'utf8')),
      aufrufe: zeilen.map((z) => z[1]),
      abstaende: zeilen.slice(1).map((z, i) => Number(z[0]) - Number(zeilen[i][0])),
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const tag1 = laeufe([{ tag: '2026-10-23' }])
const b = tag1.bestand
pruefe('Tag 1: Lauf endet mit Exit 0', tag1.status === 0, tag1.text.slice(-500))
pruefe('Tag 1: Treffer 900011 mit JustWatch-Kennung, JW-Kennung 777001 und Weg „über Namen“', b['900011']?.jwId === 'jw11' && b['900011']?.tmdbId === 777001 && b['900011']?.ueberName === true && !b['900011']?.ohneTreffer, b['900011'])
pruefe('Tag 1: Treffer bringt die Angebote mit', b['900011']?.angebote?.[0]?.anbieter === 'Netflix', b['900011'])
pruefe('Tag 1: gleicher Name, anderes Jahr → ohneTreffer', b['900012']?.ohneTreffer === true && !b['900012']?.jwId && b['900012']?.ueberName === true, b['900012'])
pruefe('Tag 1: zwei Treffer → ohneTreffer, nichts übernommen', b['900013']?.ohneTreffer === true && !b['900013']?.jwId, b['900013'])
pruefe('Tag 1: Kennung gehört 900015 → ohneTreffer', b['900014']?.ohneTreffer === true && !b['900014']?.jwId, b['900014'])
pruefe('Tag 1: JustWatch-Seite hält schon ein anderer Eintrag → ohneTreffer', b['900017']?.ohneTreffer === true && !b['900017']?.jwId, b['900017'])
pruefe('Tag 1: Titel mit TMDB-Kennung bleibt der Namenssuche fern', !b['900015'] && !b['900016'], [b['900015'], b['900016']])
pruefe('Tag 1: der fremde Halter bleibt unverändert', b['900099']?.jwId === 'jw77' && b['900099']?.tmdbId === 5, b['900099'])
pruefe('Tag 1: beide Namen von 900011, je ein Name der übrigen, genau einmal', tag1.aufrufe.slice().sort().join('|') === 'Abgewiesen|Anlass Eins|Anlass Ichi|Doppelt|Falsches Jahr|Fremd', tag1.aufrufe)
pruefe('Tag 1: Ergebniszeile nennt Zahlen', /Namenssuche\): 1 zugeordnet \(0 ohne Angebot\), 4 ohne Treffer, 1 mehrdeutig, 1 fremd, 1 abgewiesen, 0 verfehlt, 0 Fehler\./.test(tag1.text), tag1.text.slice(-900))
pruefe('Tag 1: mehrdeutiger Titel steht mit Namen im Log', /mehrdeutig, nichts übernommen: Doppelt \(900013, 2 Treffer\)/.test(tag1.text), tag1.text.slice(-900))
pruefe('Tag 1: zwischen zwei Abrufen liegt mindestens eine Sekunde Pause', tag1.abstaende.length === 5 && Math.min(...tag1.abstaende) >= 900, tag1.abstaende)

const ohne = laeufe([{ tag: '2026-10-23', args: [] }])
pruefe('Ohne --namen: kein Titel ohne TMDB-Kennung wird gefragt, keine Namenssuche im Log', ohne.status === 0 && !ohne.bestand['900011'] && !ohne.aufrufe.length && !/Namenssuche/.test(ohne.text), [ohne.aufrufe, ohne.text.slice(-300)])

const nurCartoons = laeufe([{ tag: '2026-10-23', args: ['--nur-cartoons', '--namen', '10'] }], { cartoons: [titel(900031, 'Anlass Eins')] })
pruefe('Mit --nur-cartoons keine Namenssuche, auch wenn ein Cartoon ohne TMDB-Kennung da ist', nurCartoons.status === 0 && !nurCartoons.aufrufe.length, nurCartoons.aufrufe)

const zwei = laeufe([{ tag: '2026-10-23', args: ['--namen', '2'] }])
pruefe('--namen 2: nur die zwei ältesten Titel (900011 mit zwei Namen, 900012), nicht mehr', zwei.aufrufe.join('|') === 'Anlass Eins|Anlass Ichi|Falsches Jahr' && !zwei.bestand['900013'], zwei.aufrufe)

const nurNamen = laeufe([{ tag: '2026-10-23' }], { titel: [TITEL[0]] })
pruefe('Ohne Titel mit TMDB-Kennung (früher Ausstieg des Hauptlaufs) wird trotzdem gespeichert', nurNamen.bestand['900011']?.jwId === 'jw11', nurNamen.bestand['900011'])

const tag11 = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-02' }])
pruefe('Tag 11: Befunde jünger als 21 Tage → keine neue Suche', tag11.aufrufe.length === 6 && tag11.bestand['900011']?.geprueftAm === '2026-10-23', [tag11.aufrufe, tag11.bestand['900011']])

const tag21 = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-13' }])
pruefe('Tag 21 danach: noch nicht fällig (Grenze genau 21 Tage)', tag21.aufrufe.length === 6, tag21.aufrufe.length)

const tag22 = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-14' }])
pruefe('Tag 22 danach: alle fünf wieder fällig (12 Suchen), Befund neu datiert, erstAm bleibt', tag22.aufrufe.length === 12 && tag22.bestand['900011']?.geprueftAm === '2026-11-14' && tag22.bestand['900011']?.erstAm === '2026-10-23', [tag22.aufrufe.length, tag22.bestand['900011']])

const verfehlt = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-14', modus: 'leer' }])
pruefe('Verfehlte Suche löscht die alte Antwort nicht', verfehlt.bestand['900011']?.jwId === 'jw11' && verfehlt.bestand['900011']?.verfehltAm === '2026-11-14', verfehlt.bestand['900011'])

const sperre = laeufe([{ tag: '2026-10-23', modus: 'sperre' }])
pruefe('Drei Sperren in Folge beenden den Lauf, Exit 0', sperre.status === 0 && /3 Sperren in Folge/.test(sperre.text), sperre.text.slice(-600))
pruefe('Sperre: nur die ersten drei Titel werden gefragt', new Set(sperre.aufrufe).size === 3, [...new Set(sperre.aufrufe)])

const fehlerLauf = laeufe([{ tag: '2026-10-23', modus: 'fehler' }])
pruefe('Andere Fehler (404) beenden den Lauf nicht: alle fünf Titel werden gefragt, nichts zugeordnet', fehlerLauf.status === 0 && new Set(fehlerLauf.aufrufe).size === 5 && !/Sperren in Folge/.test(fehlerLauf.text) && !fehlerLauf.bestand['900011'], [fehlerLauf.status, [...new Set(fehlerLauf.aufrufe)]])

const WECHSEL = ['Sperre A', 'Ok B', 'Sperre C', 'Ok D', 'Sperre E', 'Ok F'].map((n, i) => titel(900041 + i, n))
const wechsel = laeufe([{ tag: '2026-10-23', modus: 'wechsel' }], { titel: WECHSEL })
pruefe('Nicht aufeinanderfolgende Sperren beenden den Lauf nicht: alle sechs Titel werden gefragt', wechsel.status === 0 && new Set(wechsel.aufrufe).size === 6 && !/Sperren in Folge/.test(wechsel.text), [wechsel.status, [...new Set(wechsel.aufrufe)]])

const VIELE = Array.from({ length: 21 }, (_, i) => titel(900101 + i, 'Anlass Eins'))
const unplausibel = laeufe([{ tag: '2026-10-23', args: ['--namen', '30'], modus: 'ohneangebote' }], { titel: VIELE, vorher: {} })
pruefe('21 Treffer ohne Angebot sind unplausibel: nichts geschrieben', unplausibel.status === 0 && /Ergebnis unplausibel — nichts geschrieben/.test(unplausibel.text) && !Object.keys(unplausibel.bestand).some((k) => k.startsWith('9001')), [unplausibel.text.slice(-400), Object.keys(unplausibel.bestand).length])

if (fehler) {
  console.error(`${fehler} von ${faelle} Prüfungen fehlgeschlagen`)
  process.exit(1)
}
console.log(`check-jw-namenssuche-lauf: ok (${faelle} Prüfungen, Prozess auf Kulisse mit Fetch-Attrappe: Treffer, Jahr, mehrdeutig, fremd, abgewiesen, Pause, 21-Tage-Frist, verfehlt, Sperren, Plausibilität, andere Fehler)`)

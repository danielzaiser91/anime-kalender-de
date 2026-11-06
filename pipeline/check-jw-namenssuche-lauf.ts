/**
 * Prozess-Test zur Verdrahtung der Namenssuche in `fetch-justwatch-audio.ts` (`sucheOhneTmdb` in `main()`): das Skript läuft als eigener Prozess auf einer
 * Kulisse im Temp-Ordner (`AK_ROOT`, feste Uhr, `fetch` als Attrappe, die jede Suche mit Namen in `aufrufe.txt` mitschreibt).
 * Vier Titel ohne TMDB-Kennung: 900011 Treffer (Name, Jahr, Art), 900012 gleicher Name anderes Jahr, 900013 zwei Treffer, 900014 Kennung gehört
 * 900015 (hat TMDB 777002). 900016 hat TMDB und gehört nicht in die Namenssuche. Ablauf über Tage: Tag 1 fragt, Tag 11 nicht, Tag 23 wieder (21 Tage
 * Frist, der Bau liest nur bis 28); ein verfehlter zweiter Lauf behält die alte Antwort; ohne `--namen` bleibt alles beim Alten; drei Sperren in Folge beenden den Lauf.
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
  titel(900011, 'Anlass Eins'),
  titel(900012, 'Falsches Jahr'),
  titel(900013, 'Doppelt'),
  titel(900014, 'Fremd'),
  titel(900015, 'Halter', { tmdbId: 777002 }),
  titel(900016, 'Mit TMDB', { tmdbId: 777003 }),
]

/** Attrappe: je Suchbegriff eine feste Trefferliste; `MODUS=leer` = JustWatch findet nichts, `MODUS=sperre` = immer 429. */
const ATTRAPPE = `
import { appendFileSync } from 'node:fs'
const knoten = (id, typ, title, jahr, tmdb) => ({ id, objectType: typ, content: { title, originalReleaseYear: jahr, fullPath: '/de/film/' + id, ageCertification: '6', externalIds: { tmdbId: tmdb } }, offers: [{ monetizationType: 'FLATRATE', audioLanguages: ['de'], subtitleLanguages: [], standardWebURL: 'https://www.netflix.com/title/' + id, package: { clearName: 'Netflix' } }], seasons: [] })
const ANTWORTEN = {
  'Anlass Eins': [knoten('jw11', 'MOVIE', 'Anlass Eins', 2020, '777001'), knoten('jw99', 'SHOW', 'Anlass Eins Reloaded', 2020, '1')],
  'Falsches Jahr': [knoten('jw12', 'MOVIE', 'Falsches Jahr', 1992, '777004')],
  'Doppelt': [knoten('jw13a', 'MOVIE', 'Doppelt', 2020, '777005'), knoten('jw13b', 'MOVIE', 'Doppelt', 2021, '777006')],
  'Fremd': [knoten('jw14', 'MOVIE', 'Fremd', 2020, '777002')],
}
globalThis.fetch = async (url, init) => {
  const q = JSON.parse(init.body).variables.q
  if (q !== undefined) appendFileSync(process.env.AK_ROOT + '/aufrufe.txt', q + '\\n')
  if (process.env.MODUS === 'sperre') return new Response('', { status: 429, headers: { 'retry-after': '0.001' } })
  const liste = process.env.MODUS === 'leer' ? [] : (ANTWORTEN[q] ?? [])
  return new Response(JSON.stringify({ data: { popularTitles: { edges: liste.map((node) => ({ node })) } } }), { status: 200 })
}
`

interface Befund {
  jwId?: string
  tmdbId?: number
  ohneTreffer?: boolean
  ueberName?: boolean
  verfehltAm?: string
  geprueftAm: string
  angebote: { anbieter: string }[]
}
interface Lauf {
  text: string
  status: number | null
  bestand: Record<string, Befund>
  aufrufe: string[]
}

/** Läufe nacheinander auf derselben Kulisse: je Lauf Uhr, Argumente und Modus. */
function laeufe(plan: { tag: string; args?: string[]; modus?: string }[], titelListe: unknown[] = TITEL): Lauf {
  const wurzel = mkdtempSync(join(tmpdir(), 'jw-namen-'))
  try {
    mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titelListe))
    writeFileSync(join(wurzel, 'public', 'data', 'releases.json'), '[]')
    writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
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
    return {
      ...letzter,
      bestand: existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : {},
      aufrufe: existsSync(aufrufe) ? readFileSync(aufrufe, 'utf8').split('\n').filter(Boolean) : [],
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
pruefe('Tag 1: Titel mit TMDB-Kennung bleibt der Namenssuche fern', !b['900015'] && !b['900016'], [b['900015'], b['900016']])
pruefe('Tag 1: jeder der vier Titel wurde genau einmal gesucht', tag1.aufrufe.slice().sort().join('|') === 'Anlass Eins|Doppelt|Falsches Jahr|Fremd', tag1.aufrufe)
pruefe('Tag 1: Ergebniszeile nennt Zahlen', /Namenssuche\): 1 zugeordnet \(0 ohne Angebot\), 3 ohne Treffer, 1 mehrdeutig, 1 fremd, 0 abgewiesen, 0 verfehlt, 0 Fehler\./.test(tag1.text), tag1.text.slice(-900))
pruefe('Tag 1: mehrdeutiger Titel steht mit Namen im Log', /mehrdeutig, nichts übernommen: Doppelt \(900013, 2 Treffer\)/.test(tag1.text), tag1.text.slice(-900))

const ohne = laeufe([{ tag: '2026-10-23', args: [] }])
pruefe('Ohne --namen: kein Titel ohne TMDB-Kennung wird gefragt', ohne.status === 0 && !ohne.bestand['900011'] && !ohne.aufrufe.length, ohne.aufrufe)

const tag11 = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-02' }])
pruefe('Tag 11: Befunde jünger als 21 Tage → keine neue Suche', tag11.aufrufe.length === 4 && tag11.bestand['900011']?.geprueftAm === '2026-10-23', [tag11.aufrufe, tag11.bestand['900011']])

const tag21 = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-13' }])
pruefe('Tag 21 danach: noch nicht fällig (Grenze genau 21 Tage)', tag21.aufrufe.length === 4, tag21.aufrufe.length)

const tag22 = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-14' }])
pruefe('Tag 22 danach: alle vier wieder fällig (8 Suchen), Befund neu datiert', tag22.aufrufe.length === 8 && tag22.bestand['900011']?.geprueftAm === '2026-11-14', [tag22.aufrufe.length, tag22.bestand['900011']])

const verfehlt = laeufe([{ tag: '2026-10-23' }, { tag: '2026-11-14', modus: 'leer' }])
pruefe('Verfehlte Suche löscht die alte Antwort nicht', verfehlt.bestand['900011']?.jwId === 'jw11' && verfehlt.bestand['900011']?.verfehltAm === '2026-11-14', verfehlt.bestand['900011'])

const sperre = laeufe([{ tag: '2026-10-23', modus: 'sperre' }])
pruefe('Drei Sperren in Folge beenden den Lauf, Exit 0', sperre.status === 0 && /3 Sperren in Folge/.test(sperre.text), sperre.text.slice(-600))
pruefe('Sperre: der vierte Titel wird nicht mehr gefragt', new Set(sperre.aufrufe).size === 3, [...new Set(sperre.aufrufe)])

if (fehler) {
  console.error(`${fehler} von ${faelle} Prüfungen fehlgeschlagen`)
  process.exit(1)
}
console.log(`check-jw-namenssuche-lauf: ok (${faelle} Prüfungen, Prozess auf Kulisse mit Fetch-Attrappe: Treffer, Jahr, mehrdeutig, fremd, 21-Tage-Frist, verfehlt, Sperre)`)

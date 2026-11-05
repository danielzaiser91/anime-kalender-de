/**
 * Prozess-Test zur Verdrahtung der Kennungssperre in `fetch-justwatch-audio.ts` (`nimmTreffer` in `main()`): Das Skript läuft als eigener Prozess auf einer
 * Kulisse im Temp-Ordner (`AK_ROOT`, feste Uhr, `fetch` als Attrappe, die für jede Suche beide Reihen mit derselben JustWatch-Kennung `JW1` liefert).
 * Der Halter (Schlüssel 900001, TMDB 1) hält `JW1` schon. Titel 900002 (TMDB 2, Fancy-Nancy-Fall) darf sie nicht bekommen und bleibt `ohneTreffer`;
 * Titel 900003 (TMDB 1) ist dieselbe Reihe und wird angenommen. Zweiter Lauf (Tag 2): der Befund 900002 bleibt `ohneTreffer`, `erstAm` bleibt. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = join(import.meta.dirname, '..')
const TAG1 = '2026-10-23T12:00:00Z'
const TAG2 = '2026-10-24T12:00:00Z'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const film = (id: number, tmdbId: number) => ({
  id,
  tmdbId,
  titleEn: `Reihe ${tmdbId} Nr ${id}`,
  format: 'MOVIE',
  streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${id}`, dub: true }],
  watchLinks: [],
})

/** Attrappe: jede Suche findet beide Reihen unter derselben JustWatch-Kennung. */
const ATTRAPPE = `
const knoten = (tmdb) => ({ id: 'JW1', content: { fullPath: '/de/serie/x', ageCertification: '6', externalIds: { tmdbId: tmdb } }, offers: [], seasons: [] })
globalThis.fetch = async () => new Response(JSON.stringify({ data: { popularTitles: { edges: [{ node: knoten('2') }, { node: knoten('1') }] } } }), { status: 200 })
`

interface Lauf {
  text: string
  status: number | null
  bestand: Record<string, { jwId?: string; ohneTreffer?: boolean; tmdbId?: number; erstAm?: string }>
}

/** Ein oder mehrere Läufe nacheinander auf derselben Kulisse (Uhr je Lauf); Rückgabe: Ausgabe des letzten Laufs und der Bestand danach. */
function laeufe(uhren: string[]): Lauf {
  const wurzel = mkdtempSync(join(tmpdir(), 'jw-fremd-'))
  try {
    mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify([film(900002, 2), film(900003, 1)]))
    writeFileSync(join(wurzel, 'public', 'data', 'releases.json'), '[]')
    const halter = { geprueftAm: '2026-10-23', jwId: 'JW1', tmdbId: 1, altersangabe: '6', angebote: [] }
    writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify({ '900001': halter }))
    writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
    const ziel = pathToFileURL(join(REPO, 'pipeline', 'fetch-justwatch-audio.ts')).href
    const uhr = pathToFileURL(join(REPO, 'tools', 'feste-uhr.ts')).href
    const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    let letzter = { text: '', status: null as number | null }
    for (const [i, iso] of uhren.entries()) {
      const huelle = join(wurzel, `huelle${i}.mts`)
      writeFileSync(huelle, `import { festeUhr } from '${uhr}'\nfesteUhr('${iso}')\n${ATTRAPPE}\nawait import('${ziel}')\n`)
      const r = spawnSync(process.execPath, [tsx, huelle, '--limit', '5', '--alter', '0'], {
        cwd: wurzel,
        env: { ...process.env, AK_ROOT: wurzel },
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
      })
      letzter = { text: `${r.stdout}${r.stderr}`, status: r.status }
    }
    return { ...letzter, bestand: JSON.parse(readFileSync(join(wurzel, 'data', 'justwatch-audio.json'), 'utf8')) }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const tag1 = laeufe([TAG1])
pruefe('Tag 1: Lauf endet mit Exit 0', tag1.status === 0, tag1.text.slice(-500))
pruefe('Tag 1: Fremdtitel (TMDB 2) bekommt JW1 nicht und steht als ohneTreffer', tag1.bestand['900002']?.ohneTreffer === true && !tag1.bestand['900002']?.jwId, tag1.bestand['900002'])
pruefe('Tag 1: der Befund trägt die TMDB-Kennung des Fremdtitels', tag1.bestand['900002']?.tmdbId === 2, tag1.bestand['900002'])
pruefe('Tag 1: gleiche Reihe (TMDB 1) wird angenommen', tag1.bestand['900003']?.jwId === 'JW1' && !tag1.bestand['900003']?.ohneTreffer, tag1.bestand['900003'])
pruefe('Tag 1: der Halter bleibt unverändert', tag1.bestand['900001']?.jwId === 'JW1' && tag1.bestand['900001']?.tmdbId === 1, tag1.bestand['900001'])
pruefe('Tag 1: Warnzeile nennt den abgewiesenen Titel samt Halter', /WARNUNG JustWatch: 1 Treffer abgewiesen.*\(900002, Halter 900001\)/.test(tag1.text), tag1.text.slice(-500))

const tag2 = laeufe([TAG1, TAG2])
pruefe('Tag 2: Lauf endet mit Exit 0', tag2.status === 0, tag2.text.slice(-500))
pruefe('Tag 2: Fremdtitel bleibt ohneTreffer, erstAm bleibt der von Tag 1', tag2.bestand['900002']?.ohneTreffer === true && tag2.bestand['900002']?.erstAm === '2026-10-23', tag2.bestand['900002'])
pruefe('Tag 2: Fremdtitel wird erneut abgewiesen (Warnzeile)', /Treffer abgewiesen.*900002/.test(tag2.text), tag2.text.slice(-500))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-kennung-fremd-lauf: ok (8 Prüfungen, Prozess auf Kulisse mit Fetch-Attrappe, 2 Tage)')

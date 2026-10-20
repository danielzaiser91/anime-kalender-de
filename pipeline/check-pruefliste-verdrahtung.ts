/**
 * Zusicherung (20.10.2026): Die Verdrahtung. `schreibeDatensatz` (Phase 13) ruft `bereinigePruefliste(slim)` selbst auf; fiele der Aufruf weg
 * oder bekäme er eine falsche Liste, bliebe ein Weg mit Bereich auf der Prüfliste und `check:bestand` brächte den Bestandsbau zu Fall.
 * Läuft die echte Phase gegen eine Kulisse unter `os.tmpdir()` (`AK_ROOT`), nie gegen das Repo; Kennungen ab 900000.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-pruefliste-verdrahtung.ts`
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DataMeta, Title } from '../shared/types.ts'

const URL_MIT = 'https://www.crunchyroll.com/de/series/GTESTMIT/mit'
const URL_OHNE = 'https://www.crunchyroll.com/de/series/GTESTOHNE/ohne'
const REPO = join(import.meta.dirname, '..')
/** Leere Dateien in data/, die die Phasen beim Laden ohne Rückfall lesen. */
const STUBS = ['offizielle-meldungen.yaml', 'ankuendigungen.yaml', 'ohne-synchro-von-hand.yaml', 'anisearch-ids-hand.yaml', 'folgen-hinweise.yaml', 'fanservice-urteil.yaml', 'synchron-forum-treffer.yaml', 'kino-ankuendigungen.yaml']

const start = process.cwd()
const wurzel = mkdtempSync(join(tmpdir(), 'pruefliste-verdrahtung-'))
process.env.AK_ROOT = wurzel

const titel = (id: number, streams: unknown[]) => ({ id, franchiseId: 900097, format: 'TV', titleDe: `T${id}`, jpYear: 2026, episodes: 12, streams }) as unknown as Title
const zeile = (titleId: number, url: string) => ({ titleId, titel: 'E', url, grund: 'g' })

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

try {
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'tools'))
  copyFileSync(join(REPO, 'tools', 'kennungen-erzeugen.mjs'), join(wurzel, 'tools', 'kennungen-erzeugen.mjs'))
  process.chdir(wurzel) // Phase 13-6 startet tools/kennungen-erzeugen.mjs mit relativen Pfaden
  const mitBereich = titel(900010, [{ platform: 'crunchyroll', url: URL_MIT, dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }])
  const ohneBereich = titel(900011, [{ platform: 'crunchyroll', url: URL_OHNE, dub: true }])
  const { PRUEFLISTE } = await import('./bau/09-7-cr-teilseiten.ts')
  const liste = [zeile(900010, URL_MIT), zeile(900011, URL_OHNE), zeile(900999, URL_OHNE)]
  writeFileSync(join(wurzel, PRUEFLISTE), JSON.stringify(liste))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  for (const d of STUBS) writeFileSync(join(wurzel, 'data', d), '')

  const { schreibeDatensatz } = await import('./bau/13-schreiben.ts')
  schreibeDatensatz({
    allTitles: [mitBereich, ohneBereich],
    releases: [],
    kanalJeAdresse: new Map(),
    anisearch: {},
    tmdbTitles: {},
    mitStimmen: new Set(),
    verschoben: [],
    verweiseEntfernt: [],
    titles: new Map([mitBereich, ohneBereich].map((t) => [t.id, t])),
    jpStartAnzeige: new Map(),
    events: [],
    meta: { generatedAt: '2026-10-20T00:00:00Z', titleCount: 2, belegtCount: 0, releaseCount: 0, eventCount: 0, genres: [], keywords: [], platforms: [], providers: [], years: [], attribution: [] } as unknown as DataMeta,
  })

  const danach = (JSON.parse(readFileSync(join(wurzel, PRUEFLISTE), 'utf8')) as { titleId: number; url: string }[]).map((p) => `${p.titleId}|${p.url}`)
  pruefe('Phase 13 bereinigt die Prüfliste: Weg mit Bereich und Titel ohne Ausgabe fallen weg, der offene Weg bleibt', JSON.stringify(danach) === JSON.stringify([`900011|${URL_OHNE}`]), danach)
} finally {
  process.chdir(start)
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt > 0) process.exit(1)
console.log('Verdrahtung Prüfliste: Phase 13 ruft bereinigePruefliste mit der Auslieferung auf.')

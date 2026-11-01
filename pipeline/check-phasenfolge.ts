/**
 * Zusicherung: **Die Phasenfolge `bauePhasenfolge` (bau/phasenfolge.ts) meldet eine Bilanz und bricht ab, wenn eine Phase
 * ihre Eingabe leer zurückgibt** (Bauer 2016, 25.10.2026: der Weg von `baueReleases` bis zum Schreibschritt war nur typgeprüft).
 * 1. Tabelle der Regel `bilanzFehler` (Werte hier fest eingetragen, auch Grenzfall 1 und fehlende Termine vor der Terminphase).
 * 2. Prozess: die echte Folge gegen einen Wegwerf-Ordner (`AK_ROOT`) mit einem Titel und einem kuratierten Termin liefert
 *    Titel, Releases und Termine und druckt die Bilanzzeilen; zeigt der kuratierte Eintrag auf einen unbekannten Titel,
 *    endet der Prozess mit der Meldung der Phase 05.
 *
 * Aufruf: npx tsx pipeline/check-phasenfolge.ts
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { bilanzFehler, bilanzZeile, type Bilanz } from './bau/phasen-bilanz.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info?: unknown): void {
  if (!ok) {
    fehler++
    console.error(`✖ ${name}: ${JSON.stringify(info)}`)
  }
}

const b = (titel: number, releases: number, events: number | undefined, kuratiert: number): Bilanz => ({ phase: 'x', titel, releases, events, kuratiert })
const TABELLE: [string, Bilanz, string | null][] = [
  ['alles gefüllt', b(3, 5, 7, 2), null],
  ['genau 1 überall', b(1, 1, 1, 1), null],
  ['keine Titel', b(0, 5, 7, 2), 'keine Titel'],
  ['kuratiert, aber keine Releases', b(3, 0, undefined, 2), '2 kuratierte Einträge, aber keine Releases'],
  ['nichts kuratiert, keine Releases', b(3, 0, undefined, 0), null],
  ['Releases ohne Termine', b(3, 5, 0, 2), '5 Releases, aber keine Termine'],
  ['genau 1 Release ohne Termine', b(3, 1, 0, 1), '1 Releases, aber keine Termine'],
  ['Termine vor der Terminphase noch offen', b(3, 5, undefined, 2), null],
]
for (const [name, bilanz, soll] of TABELLE) pruefe(`bilanzFehler: ${name}`, bilanzFehler(bilanz) === soll, bilanzFehler(bilanz))
pruefe('bilanzZeile: Termine offen als Strich', bilanzZeile(b(3, 5, undefined, 2)) === 'Bilanz x: 3 Titel, 5 Releases, - Termine (2 kuratiert)', bilanzZeile(b(3, 5, undefined, 2)))

const medium = {
  id: 900001,
  idMal: 900101,
  title: { romaji: 'Phasenfolge Probe', english: null, native: null },
  format: 'TV',
  status: 'RELEASING',
  episodes: 12,
  duration: 24,
  season: 'FALL',
  seasonYear: 2026,
  startDate: { year: 2026, month: 10, day: 3 },
  genres: ['Action'],
  tags: [],
  externalLinks: [],
  studios: { nodes: [] },
  coverImage: { large: null, extraLarge: null },
  bannerImage: null,
  averageScore: null,
  countryOfOrigin: 'JP',
  isAdult: false,
  description: null,
}
const KURATIERT =
  `- slug: phasenfolge-probe
  anilistId: 900001
  search: "Phasenfolge Probe"
  platform: crunchyroll
  releaseType: weekly
  schedule:
    firstEpisodeDate: "2026-10-03"
    estimated: true
  sources:
    - https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-anime-lineup-herbst-2026
`
/** Ohne `schedule` überspringt `baueReleases` den Eintrag: Eingabe nicht leer, Ausgabe leer. */
const OHNE_TERMIN = KURATIERT.replace('  schedule:', '  zeitplan:').replace('    firstEpisodeDate:', '    erster:')

/** Handdateien, die der Bau voraussetzt (ohne sie bricht er mit ENOENT ab). */
const HAND = ['kino-ankuendigungen.yaml', 'ohne-synchro-von-hand.yaml', 'ankuendigungen.yaml', 'anisearch-ids-hand.yaml', 'fanservice-urteil.yaml', 'shop-wege-falsches-ziel.yaml']
const wurzel = mkdtempSync(join(tmpdir(), 'phasenfolge-'))
function fahre(name: string, kuratiertYaml: string) {
  const ordner = join(wurzel, name)
  mkdirSync(join(ordner, 'data', 'cache'), { recursive: true })
  mkdirSync(join(ordner, 'data', 'curated'), { recursive: true })
  for (const datei of HAND) copyFileSync(join(import.meta.dirname, '..', 'data', datei), join(ordner, 'data', datei))
  writeFileSync(join(ordner, 'data', 'cache', 'anilist-media.json'), JSON.stringify({ '900101': medium }))
  writeFileSync(join(ordner, 'data', 'curated', 'probe.yaml'), kuratiertYaml)
  const bau = pathToFileURL(join(import.meta.dirname, 'bau')).href
  const skript = join(ordner, 'lauf.mts')
  writeFileSync(
    skript,
    `import { ladeQuellen } from '${bau}/01-quellen.ts'
import { bauePhasenfolge } from '${bau}/phasenfolge.ts'
const e = bauePhasenfolge(ladeQuellen())
console.log('ERGEBNIS ' + JSON.stringify({ titel: e.titles.size, releases: e.releases.length, events: e.events.length }))
`,
  )
  return spawnSync(process.execPath, ['--import', 'tsx', skript], {
    env: { ...process.env, AK_ROOT: ordner, AK_PHASE_ZUSTAND: '', AK_PHASE_TITEL: '' },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
}

try {
  const gut = fahre('gut', KURATIERT)
  const zeile = gut.stdout.split('\n').find((z) => z.startsWith('ERGEBNIS '))
  const ergebnis = zeile ? JSON.parse(zeile.slice(9)) : undefined
  pruefe('Folge mit Titel und Termin: Exit 0', gut.status === 0, { status: gut.status, stderr: gut.stderr.slice(-400) })
  pruefe('Folge liefert Titel, Releases und Termine', ergebnis?.titel === 1 && ergebnis.releases === 1 && ergebnis.events > 0, ergebnis)
  pruefe('Bilanzzeile 05 gedruckt', gut.stdout.includes('Bilanz 05-releases: 1 Titel, 1 Releases, - Termine (1 kuratiert)'), gut.stdout.slice(-600))
  pruefe('Bilanzzeile 10 gedruckt', /Bilanz 10-komplettabwurf: 1 Titel, 1 Releases, [1-9]\d* Termine \(1 kuratiert\)/.test(gut.stdout), gut.stdout.slice(-600))

  const leer = fahre('leer', OHNE_TERMIN)
  pruefe('Kuratierter Eintrag ohne Titel: Prozess endet mit Fehler', leer.status !== 0 && !leer.stdout.includes('ERGEBNIS'), { status: leer.status })
  pruefe('… mit der Meldung der Phase 05', leer.stderr.includes('Phase 05-releases lieferte leer: 1 kuratierte Einträge, aber keine Releases'), leer.stderr.slice(-500))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) process.exit(1)
console.log('✔ Phasenfolge: 8 Tabellenfälle, Strichzeile, Lauf mit Titel/Termin (Bilanz 05 und 10), Lauf mit leerer Phase 05 bricht ab')

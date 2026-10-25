/**
 * Zusicherung zur Verdrahtung: `schreibeWochenDatei()` (Bau-Phase `13-8-wochen-datei.ts`) schreibt neben `woche.json` die `woche-kacheln.json`, und ein
 * Widerspruch zwischen beiden bricht den Bau ab. Läuft als eigener Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`), nie gegen `public/data`.
 * Die Fixture trägt für jeden Tag von 2026 bis 2030 einen Termin, damit die Woche des Laufs (heute) sicher Termine hat, ohne eine Uhr im Test.
 * Aufruf: `npm run check:logic` (steckt darin) oder `tsx pipeline/check-wochen-kacheln-lauf.ts`
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = resolve(fileURLToPath(new URL('..', import.meta.url)))
const arbeit = mkdtempSync(join(tmpdir(), 'wochen-kacheln-'))
let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function tage(): string[] {
  const liste: string[] = []
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2030, 11, 31); t += 86400000) liste.push(new Date(t).toISOString().slice(0, 10))
  return liste
}

function lauf(argument = ''): { status: number | null; fehler: string } {
  const skript = join(arbeit, 'lauf.ts')
  const baustein = pathToFileURL(join(wurzel, 'pipeline', 'bau', '13-8-wochen-datei.ts')).href
  writeFileSync(skript, `import { schreibeWochenDatei } from '${baustein}'\nschreibeWochenDatei(${argument})\n`)
  const tsx = join(wurzel, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  /* Die Sperre von check:logic (`bestand-sperre.cjs`) gilt dem echten Bestand in `public/data`; der Wegwerf-Ordner liegt im Temp-Ordner. */
  const umgebung = { ...process.env, AK_ROOT: arbeit, BESTAND_ERLAUBT: '', BESTAND_SPUR: '' }
  const r = spawnSync(process.execPath, [tsx, skript], { cwd: arbeit, encoding: 'utf8', env: umgebung, windowsHide: true })
  return { status: r.status, fehler: r.stderr.slice(-300) }
}

const lies = (name: string) => JSON.parse(readFileSync(join(arbeit, 'public', 'data', name), 'utf8')) as Record<string, unknown[]>
try {
  mkdirSync(join(arbeit, 'public', 'data'), { recursive: true })
  mkdirSync(join(arbeit, 'data'), { recursive: true })
  /* `grundlagen.ts` liest diese Handlisten beim Import; leer genügt. */
  for (const name of ['kino-ankuendigungen.yaml', 'anisearch-ids-hand.yaml']) writeFileSync(join(arbeit, 'data', name), '[]\n')
  writeFileSync(join(arbeit, 'data', 'ankuendigungen.yaml'), 'quellen: {}\neintraege: []\n')
  const schreibe = (name: string, inhalt: unknown) => writeFileSync(join(arbeit, 'public', 'data', name), JSON.stringify(inhalt))
  schreibe('titles-core.json', [{ id: 900001, slug: 'x', titleDe: 'Name', sources: ['q'], genres: ['Action'] }])
  schreibe('releases.json', [{ slug: 'r', titleId: 900001, name: 'R', platform: 'tv', releaseType: 'weekly', year: 2026, sources: ['q'], platformUrl: 'p', schedule: {} }])
  schreibe('events.json', tage().map((date) => ({ id: `r-${date}`, releaseSlug: 'r', titleId: 900001, date, name: 'R', platform: 'tv', releaseType: 'weekly' })))

  console.log('\nschreibeWochenDatei als Prozess:')
  const erster = lauf()
  pruefe('der Lauf endet ohne Fehler', erster.status === 0, erster)
  pruefe('woche-kacheln.json ist geschrieben', existsSync(join(arbeit, 'public', 'data', 'woche-kacheln.json')))
  const woche = lies('woche.json') as unknown as { titles: Record<string, unknown>[]; events: unknown[] }
  const kachel = lies('woche-kacheln.json') as unknown as { titles: Record<string, unknown>[]; releases: Record<string, unknown>[]; events: unknown[] }
  pruefe('die Woche hat sieben Termine', woche.events.length === 7 && kachel.events.length === 7, [woche.events.length, kachel.events.length])
  pruefe('woche.json behält den Titelnamen, die Kachel-Datei nicht', woche.titles[0]?.titleDe === 'Name' && !('titleDe' in (kachel.titles[0] ?? {})))
  pruefe('die Kachel-Datei behält Kennung und Genres', kachel.titles[0]?.id === 900001 && JSON.stringify(kachel.titles[0]?.genres) === '["Action"]')
  pruefe('die Kachel-Datei verliert die Quellen des Releases', !('sources' in (kachel.releases[0] ?? {})) && !('platformUrl' in (kachel.releases[0] ?? {})))
  const zweiter = lauf()
  pruefe('ein zweiter Lauf ergibt dieselbe Datei', zweiter.status === 0 && JSON.stringify(lies('woche-kacheln.json')) === JSON.stringify(kachel))

  /* Eine Kachel-Datei, die der Wochen-Datei widerspricht, bricht den Bau ab und wird nicht geschrieben. */
  rmSync(join(arbeit, 'public', 'data', 'woche-kacheln.json'))
  const kaputt = lauf("(woche) => ({ ...woche, von: '1999-01-04' })")
  pruefe('ein Widerspruch beendet den Lauf mit Exit 1', kaputt.status === 1, kaputt)
  pruefe('der Widerspruch ist benannt', kaputt.fehler.includes('andere Woche als die Wochen-Datei'), kaputt.fehler)
  pruefe('die widersprüchliche Kachel-Datei wird nicht geschrieben', !existsSync(join(arbeit, 'public', 'data', 'woche-kacheln.json')))
} finally {
  rmSync(arbeit, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) zum Lauf verletzt.` : '\nWochen-Kacheln (Lauf): alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)

/**
 * Zusicherung (15.10.2026): `termine-pruefen.ts` hängt das Bild der Wochenprogramm-Ankündigung an einen Vermerk. Das Skript läuft beim Import los und
 * liest feste Pfade, deshalb läuft es hier als eigener Prozess in einer Kopie (Pipeline und `shared` mit Fixture-Daten, kein Netz, kein echter Bestand):
 * ein Sommertermin (19:25) und ein Wintertermin kurz nach Mitternacht (00:30, MEZ) bekommen je ihr Bild; ein Vermerk ohne Zeile in der Liste bleibt ohne.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-termine-woche-lauf.ts`
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(fileURLToPath(new URL('..', import.meta.url)))
const arbeit = mkdtempSync(join(tmpdir(), 'termine-woche-'))
let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(join(arbeit, pfad, '..'), { recursive: true })
  writeFileSync(join(arbeit, pfad), JSON.stringify(inhalt))
}

try {
  mkdirSync(join(arbeit, 'pipeline'), { recursive: true })
  cpSync(join(wurzel, 'pipeline', 'termine-pruefen.ts'), join(arbeit, 'pipeline', 'termine-pruefen.ts'))
  cpSync(join(wurzel, 'pipeline', 'lib'), join(arbeit, 'pipeline', 'lib'), { recursive: true })
  cpSync(join(wurzel, 'shared'), join(arbeit, 'shared'), { recursive: true })
  mkdirSync(join(arbeit, 'pipeline', 'bau'), { recursive: true })
  cpSync(join(wurzel, 'pipeline', 'bau', 'widerlegung-staffel.ts'), join(arbeit, 'pipeline', 'bau', 'widerlegung-staffel.ts'))
  cpSync(join(wurzel, 'package.json'), join(arbeit, 'package.json'))
  mkdirSync(join(arbeit, 'daniel-zum-abarbeiten', 'listen'), { recursive: true })
  symlinkSync(join(wurzel, 'node_modules'), join(arbeit, 'node_modules'), 'junction')

  const ereignis = (id: string, date: string, time: string, estimated = true) => ({ id, releaseSlug: id, titleId: 1, name: id, platform: 'crunchyroll', date, time, episode: 12, estimated })
  const release = (slug: string, kennung: string) => ({ slug, platformUrl: `https://www.crunchyroll.com/de/series/${kennung}/` })
  schreibe('public/data/events.json', [ereignis('sommer', '2026-10-14', '19:25'), ereignis('winter', '2026-11-03', '00:30', false), ereignis('ohne', '2026-10-14', '19:25')])
  schreibe('public/data/releases.json', [release('sommer', 'GSOMMER'), release('winter', 'GWINTER'), release('ohne', 'GOHNE')])
  schreibe('data/crunchyroll.json', { scrapedAt: '2026-11-04T12:00:00Z', window: { from: '2026-10-01', to: '2026-11-30' }, german: {}, slots: [] })
  const zeile = (seriesId: string, datum: string) => ({ seriesId, titel: seriesId, von: 12, bis: 12, datum, zeit: '19:25', artikel: 'https://x/', erstmalsAm: '2026-10-10T10:00:00.000Z', bild: `${seriesId}.webp`, bildAm: '2026-10-10T10:05:00.000Z' })
  /* Ein nicht geschätzter Termin wird nur geprüft, wenn das Wochenprogramm ihn übernommen hat. */
  schreibe('data/crunchyroll-woche.json', { uebernommen: [{ seriesId: 'GWINTER', episode: 12, date: '2026-11-03' }] })
  schreibe('data/crunchyroll-woche-belege.json', { a: zeile('GSOMMER', '2026-10-14'), b: zeile('GWINTER', '2026-11-03') })

  /* Die Sperre von check:logic (`bestand-sperre.cjs`) gilt dem echten Bestand in `public/data`; die Fixture-Kopie liegt im Temp-Ordner, den die Sperre zulässt. */
  const umgebung = { ...process.env, BESTAND_ERLAUBT: '', BESTAND_SPUR: '' }
  const lauf = spawnSync(process.execPath, [join(arbeit, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'pipeline/termine-pruefen.ts', '--jetzt', '2026-11-04T12:00:00Z'], { cwd: arbeit, encoding: 'utf8', env: umgebung })
  const dateiPfad = join(arbeit, 'data', 'termine-verpasst.json')
  const vermerke = existsSync(dateiPfad) ? (JSON.parse(readFileSync(dateiPfad, 'utf8')) as { id: string; erwartetAm: string; tagGeschaetzt?: boolean; wocheBeleg?: { bild: string } }[]) : []
  const je = (id: string) => vermerke.find((v) => v.id === id)
  console.log('\ntermine-pruefen.ts als Prozess:')
  pruefe('der Lauf endet ohne Fehler und vermerkt alle drei Termine', lauf.status === 0 && vermerke.length === 3, { status: lauf.status, fehler: lauf.stderr.slice(-300), vermerke: vermerke.length })
  pruefe('Sommertermin 19:25 (MESZ) = 17:25 UTC trägt das Bild seiner Zeile', je('sommer')?.erwartetAm === '2026-10-14T17:25:00.000Z' && je('sommer')?.wocheBeleg?.bild === 'GSOMMER.webp', je('sommer'))
  pruefe('Wintertermin 00:30 (MEZ) = 23:30 UTC am Vortag trägt das Bild der Zeile vom 03.11.', je('winter')?.erwartetAm === '2026-11-02T23:30:00.000Z' && je('winter')?.wocheBeleg?.bild === 'GWINTER.webp', je('winter'))
  pruefe('der Vermerk hält den Plan-Stand fest: geschätzter Termin = tagGeschaetzt true, belegter (Winter) = false', je('sommer')?.tagGeschaetzt === true && je('winter')?.tagGeschaetzt === false && je('ohne')?.tagGeschaetzt === true, vermerke.map((v) => [v.id, v.tagGeschaetzt]))
  pruefe('ohne Zeile in der Liste bleibt der Vermerk ohne Bild', je('ohne') !== undefined && je('ohne')?.wocheBeleg === undefined, je('ohne'))
} finally {
  rmSync(arbeit, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}

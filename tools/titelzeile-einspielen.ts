/**
 * **Titelzeilen einspielen: Export, lokal bauen, einfügen** (14.10.2026). Ersetzt das Einspiel-SQL, das die Titelzeilen
 * in der Datenbank zusammensetzte (an der echten D1 9,1 Mio. gelesene Zeilen). Ablauf, Messung und Rückweg:
 * docs/wissen/betrieb.md, Abschnitt „Titelzeile einspielen: Export, lokal bauen, einfügen“.
 *
 * Aufruf aus dem Repo-Wurzelordner; `<ordner>` hält die Exportseiten zwischen den Läufen (je Anbieter ein eigener):
 *   npx tsx tools/titelzeile-einspielen.ts <plattform> <ordner> --remote
 *   npx tsx tools/titelzeile-einspielen.ts <plattform> <ordner> --local [--persist-to <absoluter-pfad>]
 * Jeder Lauf exportiert, was seit dem letzten Lauf in `pruefung`/`prime_folge` dazukam (`id` über der letzten
 * exportierten Nummer; beim ersten Lauf alles), liest die Titelzeilen des Anbieters neu, baut daraus und schreibt
 * `<ordner>/einspielen-<lauf>.sql`. Die Datei spielt man aus `worker/` ein:
 *   npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=<datei>
 * Danach erneut aufrufen (holt Nachzügler), bis er „nichts mehr zu tun“ meldet: dann steht jede exportierte Folge in
 * einer Titelzeile, gleich oder jünger (`fuehreZusammen` schriebe sonst).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { TITELZEILE_TAUGLICH } from '../worker/src/titelzeile-speichern.ts'
import { einspielAnweisungen, exportSql, SEITE, type PruefZeile, type RohZeile, type Tabelle, type Vorhanden } from './titelzeile-einspielen-bau.ts'

type Antwort = { results: Record<string, unknown>[]; meta?: { rows_read?: number } }

/** Relativ zu `worker/`, dem Arbeitsordner der Abfragen (dort liegt `wrangler.toml`). */
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js'

/** Eine Abfrage über `wrangler d1 execute --command` (die Datei-Variante liefert bei `--remote` keine Zeilen zurück). */
function abfrage(sql: string, ziel: string[]): Antwort {
  const args = [WRANGLER, 'd1', 'execute', 'anime-kalender', '--config', 'wrangler.toml', '--json', ...ziel, '--command', sql]
  const r = spawnSync(process.execPath, args, { cwd: 'worker', encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`wrangler: ${r.stderr || r.stdout}`)
  return (JSON.parse(r.stdout) as Antwort[])[0]!
}

/** Die schon exportierten Seiten einer Tabelle (Dateien `<tabelle>-<ab>.json`). */
function geladen<Z>(ordner: string, tabelle: Tabelle): Z[] {
  const dateien = readdirSync(ordner).filter((d) => new RegExp(`^${tabelle}-\\d+\\.json$`).test(d))
  return dateien.flatMap((d) => JSON.parse(readFileSync(`${ordner}/${d}`, 'utf8')) as Z[])
}

/**
 * Exportiert ab der letzten Nummer Seite für Seite; gibt die neuen Zeilen und die gelesenen D1-Zeilen zurück. Die
 * höchste `id` der Tabelle vor dem Export merkt sich `<tabelle>-bis.json`: Der nächste Lauf beginnt dort, auch wenn die
 * letzte Zeile des Anbieters weit davor liegt (ohne Index auf `plattform` läse er sonst alle Zeilen anderer Anbieter dahinter).
 */
function exportiere(ordner: string, tabelle: 'pruefung' | 'prime_folge', plattform: string, ziel: string[]) {
  const marke = `${ordner}/${tabelle}-bis.json`
  const bisher = existsSync(marke) ? Number(JSON.parse(readFileSync(marke, 'utf8'))) : 0
  let ab = Math.max(bisher, ...geladen<{ id: number }>(ordner, tabelle).map((z) => z.id))
  const hoechste = abfrage(`SELECT IFNULL(MAX(id), 0) AS id FROM ${tabelle}`, ziel)
  let gelesen = hoechste.meta?.rows_read ?? 0
  let neu = 0
  for (;;) {
    const a = abfrage(exportSql(tabelle, plattform, ab), ziel)
    gelesen += a.meta?.rows_read ?? 0
    if (a.results.length) writeFileSync(`${ordner}/${tabelle}-${ab}.json`, JSON.stringify(a.results))
    neu += a.results.length
    if (a.results.length < SEITE) break
    ab = Number(a.results.at(-1)!.id)
  }
  writeFileSync(marke, JSON.stringify(Math.max(ab, Number(hoechste.results[0]!.id))))
  return { neu, gelesen }
}

function main() {
  const [plattform, ordner, ...ziel] = process.argv.slice(2)
  if (!plattform || !ordner || !['--remote', '--local'].includes(ziel[0] ?? '')) {
    throw new Error('Aufruf: npx tsx tools/titelzeile-einspielen.ts <plattform> <ordner> --remote | --local [--persist-to <pfad>]')
  }
  if (!TITELZEILE_TAUGLICH.includes(plattform)) throw new Error(`${plattform} passt nicht ins Format der Titelzeile (TITELZEILE_TAUGLICH)`)
  if (!existsSync(ordner)) mkdirSync(ordner, { recursive: true })
  const lauf = readdirSync(ordner).filter((d) => /^titel_zeile-\d+\.json$/.test(d)).length + 1
  const p = exportiere(ordner, 'pruefung', plattform, ziel)
  const r = exportiere(ordner, 'prime_folge', plattform, ziel)
  const t = abfrage(exportSql('titel_zeile', plattform), ziel)
  writeFileSync(`${ordner}/titel_zeile-${lauf}.json`, JSON.stringify(t.results))
  const sql = einspielAnweisungen(plattform, geladen<PruefZeile>(ordner, 'pruefung'), geladen<RohZeile>(ordner, 'prime_folge'), t.results as Vorhanden[])
  /* Lokal meldet wrangler kein `rows_read` (4.120.0); gezählt wird nur an der echten D1. */
  const gelesen = ziel[0] === '--remote' ? `gelesen ${p.gelesen + r.gelesen + (t.meta?.rows_read ?? 0)} Zeilen` : 'gelesene Zeilen nur mit --remote'
  console.log(`Lauf ${lauf}: neu exportiert pruefung ${p.neu}, prime_folge ${r.neu}; Titelzeilen da ${t.results.length}; ${gelesen}`)
  if (!sql.length) return console.log('nichts mehr zu tun: jede exportierte Folge steht in einer Titelzeile (gleich oder jünger)')
  const datei = `${ordner}/einspielen-${lauf}.sql`
  writeFileSync(datei, sql.join('\n') + '\n')
  const neueZeilen = sql.filter((s) => s.startsWith('INSERT')).length
  console.log(`${datei}: ${sql.length} Anweisungen (${neueZeilen} neue Titelzeilen), längste ${Math.max(...sql.map((s) => Buffer.byteLength(s)))} Byte`)
  console.log('Einspielen aus worker/: npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=<datei>, danach erneut aufrufen')
}

main()

/**
 * **Titelzeilen einspielen: Export, lokal bauen, einfügen** (14.10.2026). Ersetzt das Einspiel-SQL, das die Titelzeilen
 * in der Datenbank zusammensetzte (an der echten D1 9,1 Mio. gelesene Zeilen). Ablauf, Messung und Rückweg:
 * docs/wissen/betrieb.md, Abschnitt „Titelzeile einspielen: Export, lokal bauen, einfügen“.
 *
 * Aufruf aus dem Repo-Wurzelordner; `<ordner>` hält die Exportseiten zwischen den Läufen (je Anbieter ein eigener):
 *   npx tsx tools/worker-titelzeile-einspielen.ts <plattform> <ordner> --remote
 *   npx tsx tools/worker-titelzeile-einspielen.ts <plattform> <ordner> --local [--persist-to <absoluter-pfad>]
 * Jeder Lauf exportiert, was seit dem letzten Lauf in `pruefung`/`prime_folge` dazukam (`id` über der letzten
 * exportierten Nummer; beim ersten Lauf alles). Mit `--remote` holt er zuerst je Tabelle eine Probeseite und rechnet aus
 * ihrem `rows_read` den Export hoch; ab `SCHWELLE` (0,25 Mio.) bricht er ab. Dann liest er die Titelzeilen des
 * Anbieters neu, baut daraus und schreibt
 * `<ordner>/einspielen-<lauf>.sql`. Die Datei spielt man aus `worker/` ein:
 *   npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=<datei>
 * Danach erneut aufrufen (holt Nachzügler), bis er „nichts mehr zu tun“ meldet: dann steht jede exportierte Folge in
 * einer Titelzeile, gleich oder jünger (`fuehreZusammen` schriebe sonst).
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { TITELZEILE_TAUGLICH } from '../worker/src/titelzeile-speichern.ts'
import { einspielLauf, type Antwort } from './worker-titelzeile-einspielen-lauf.ts'

/** Relativ zu `worker/`, dem Arbeitsordner der Abfragen (dort liegt `wrangler.toml`). */
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js'

/** Eine Abfrage über `wrangler d1 execute --command` (die Datei-Variante liefert bei `--remote` keine Zeilen zurück). */
function abfrage(sql: string, ziel: string[]): Antwort {
  const args = [WRANGLER, 'd1', 'execute', 'anime-kalender', '--config', 'wrangler.toml', '--json', ...ziel, '--command', sql]
  const r = spawnSync(process.execPath, args, { cwd: 'worker', encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`wrangler: ${r.stderr || r.stdout}`)
  return (JSON.parse(r.stdout) as Antwort[])[0]!
}

function main() {
  const [plattform, ordner, ...ziel] = process.argv.slice(2)
  if (!plattform || !ordner || !['--remote', '--local'].includes(ziel[0] ?? '')) {
    throw new Error('Aufruf: npx tsx tools/worker-titelzeile-einspielen.ts <plattform> <ordner> --remote | --local [--persist-to <pfad>]')
  }
  if (!TITELZEILE_TAUGLICH.includes(plattform)) throw new Error(`${plattform} passt nicht ins Format der Titelzeile (TITELZEILE_TAUGLICH)`)
  /* Lokal meldet wrangler kein `rows_read` (4.120.0); gezählt und hochgerechnet wird nur an der echten D1. */
  const remote = ziel[0] === '--remote'
  const { lauf, sql, neu, titelzeilen, gelesen: summe, probelauf } = einspielLauf(plattform, ordner, (s) => abfrage(s, ziel), remote)
  const gelesen = remote ? `gelesen ${summe} Zeilen (Probeseiten: Faktor ${probelauf.faktor}, Hochrechnung ${probelauf.hochrechnung})` : 'gelesene Zeilen nur mit --remote'
  console.log(`Lauf ${lauf}: neu exportiert pruefung ${neu.pruefung}, prime_folge ${neu.prime_folge}; Titelzeilen da ${titelzeilen}; ${gelesen}`)
  if (!sql.length) return console.log('nichts mehr zu tun: jede exportierte Folge steht in einer Titelzeile (gleich oder jünger)')
  const datei = `${ordner}/einspielen-${lauf}.sql`
  writeFileSync(datei, sql.join('\n') + '\n')
  const neueZeilen = sql.filter((s) => s.startsWith('INSERT')).length
  console.log(`${datei}: ${sql.length} Anweisungen (${neueZeilen} neue Titelzeilen), längste ${Math.max(...sql.map((s) => Buffer.byteLength(s)))} Byte`)
  console.log('Einspielen aus worker/: npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=<datei>, danach erneut aufrufen')
}

main()

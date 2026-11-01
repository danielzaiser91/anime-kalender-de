/**
 * Auswertungen und Einmal-SQL laufen an einer SQLite-Kopie der Meldungsdaten, nie an der echten D1 (docs/wissen/betrieb.md,
 * Abschnitt „Auswertungen an der Kopie“).
 *
 *   node tools/meldungskopie.mjs holen                  jüngste Kopie vom Lauf meldungskopie.yml laden
 *   node tools/meldungskopie.mjs abfrage "SELECT …"     eine Abfrage (Zeilen als JSON) oder Einmal-SQL (Wirkung als Differenz)
 *   node tools/meldungskopie.mjs abfrage --datei x.sql  dasselbe aus einer Datei
 *   node tools/meldungskopie.mjs ziehen                 nur im Lauf meldungskopie.yml (liest die echte D1)
 *
 * `--kopie <datei>` oder `MELDUNGSKOPIE` ersetzt den Standardort data/cache/meldungskopie/meldungen.sqlite, `--max <n>` begrenzt die Ausgabe (200).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fuehreAus, fusszeile } from './meldungskopie-abfrage.mjs'
import { ARTEFAKT_DATEI, DATEINAME, holen } from './meldungskopie-holen.mjs'
import { wranglerAus, ziehen } from './meldungskopie-ziehen.mjs'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wert = (a, name) => (a.includes(name) ? a[a.indexOf(name) + 1] : undefined)
const kopie = (a) => resolve(wert(a, '--kopie') ?? process.env.MELDUNGSKOPIE ?? `${WURZEL}/data/cache/meldungskopie/${DATEINAME}`)
const gh = (args) => execFileSync(process.env.GH_BIN || 'gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const wrangler = wranglerAus(WURZEL)

function abfrage(a) {
  const datei = wert(a, '--datei')
  const sql = datei ? readFileSync(datei, 'utf8') : a[1]
  if (!sql) throw new Error('abfrage braucht eine SQL-Anweisung oder --datei <x.sql>')
  const max = Number(wert(a, '--max') ?? 200)
  const e = fuehreAus(kopie(a), sql, new Date(), max)
  if (e.art === 'zeilen') for (const z of e.zeilen) console.log(JSON.stringify(z))
  if (e.art === 'zeilen' && e.gesamt > max) console.error(`… ${e.gesamt - max} weitere Zeilen (--max ${max})`)
  console.error(fusszeile(e))
}

function main(a) {
  if (a[0] === 'holen') {
    mkdirSync(dirname(kopie(a)), { recursive: true })
    const e = holen({ gh, ziel: kopie(a) })
    console.log(`${e.art === 'aktuell' ? 'Kopie ist aktuell' : `Kopie geholt (Lauf ${e.lauf})`}, Stand ${e.stand}: ${kopie(a)}`)
  } else if (a[0] === 'abfrage') {
    abfrage(a)
  } else if (a[0] === 'ziehen') {
    console.log(`Kopie gebaut: ${JSON.stringify(ziehen({ wrangler, ziel: resolve(wert(a, '--ziel') ?? ARTEFAKT_DATEI) }))}`)
  } else {
    console.error('Aufruf: meldungskopie.mjs holen | abfrage "<sql>" | abfrage --datei <x.sql> | ziehen --ziel <datei>')
    process.exit(2)
  }
}

try {
  main(process.argv.slice(2))
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

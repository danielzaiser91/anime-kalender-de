/**
 * Wächter für `check:logic`: Eine Prüfdatei, die in keiner Liste steht, läuft nie und fällt nicht auf.
 * Geprüft werden die Ordner der Liste (`tools/check-logic-liste.txt`, heute pipeline/ und tools/), nicht rekursiv:
 * jede `check-*.ts` und jede `*.test.mjs|ts` muss laufen über
 *  - `tools/check-logic-liste.txt` oder `tools/check-bestand-liste.txt`,
 *  - `tools/*.test.mjs` (läuft vollständig über `tools/tests-alle.mjs`, also `check:workflows`),
 *  - einen Pfad in einem Skript von `package.json` oder
 *  - `tools/check-logic-liste-ausnahmen.txt` (eine Datei je Zeile, `#` beginnt einen Kommentar; Grund dahinter).
 * Eine Ausnahme, die nicht mehr nötig ist (Datei fehlt oder läuft anderswo), ist selbst ein Fehler.
 * Aufruf: `node tools/check-logic-vollstaendig.mjs`; `check-logic-alle.mjs` ruft es vor `check:logic` auf.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRUEFDATEI = /^check-.+\.ts$|\.test\.(mjs|ts)$/

const zeilen = (text) => text.split(/\r?\n/).map((z) => z.replace(/#.*/, '').trim()).filter(Boolean)
const maskiere = (pfad) => pfad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Läuft die Datei über einen Pfad in einem `package.json`-Skript? Das Zeichen dahinter darf nicht Teil eines längeren Namens sein. */
const imSkript = (pfad, skripte) => new RegExp(`${maskiere(pfad)}(?![\\w.-])`).test(skripte)

/** Wo läuft die Datei schon? Leer, wenn nirgends. */
function laeuftDurch(pfad, { listen, skripte }) {
  if (listen.has(pfad)) return 'Liste'
  if (/^tools\/[^/]+\.test\.mjs$/.test(pfad)) return 'tests-alle'
  return imSkript(pfad, skripte) ? 'package.json' : ''
}

/**
 * Eingabe: `dateien` (Pfade der Prüfdateien), `listen` (Set aller Listen-Einträge), `skripte` (Text der package.json-Skripte),
 * `ausnahmen` (Pfade). Ausgabe: Fehlertexte, leer = in Ordnung.
 */
export function unverdrahtet({ dateien, listen, skripte, ausnahmen }) {
  const fehler = []
  for (const pfad of dateien) {
    if (!laeuftDurch(pfad, { listen, skripte }) && !ausnahmen.includes(pfad)) {
      fehler.push(`${pfad} steht in keiner Prüfliste: in tools/check-logic-liste.txt aufnehmen (sortiert) oder mit Grund in tools/check-logic-liste-ausnahmen.txt.`)
    }
  }
  for (const pfad of ausnahmen) {
    if (!dateien.includes(pfad)) fehler.push(`Ausnahme ${pfad}: Datei gibt es nicht (mehr) oder sie ist keine Prüfdatei: streichen.`)
    else if (laeuftDurch(pfad, { listen, skripte })) fehler.push(`Ausnahme ${pfad}: läuft inzwischen anderswo (${laeuftDurch(pfad, { listen, skripte })}): streichen.`)
  }
  return fehler
}

/** Liest Listen, Ordner und package.json unter `wurzel` und ruft `unverdrahtet` auf. */
export function pruefeVollstaendig(wurzel) {
  const lies = (datei) => (existsSync(join(wurzel, datei)) ? readFileSync(join(wurzel, datei), 'utf8') : '')
  const logik = zeilen(lies('tools/check-logic-liste.txt'))
  const listen = new Set([...logik, ...zeilen(lies('tools/check-bestand-liste.txt'))])
  const ordner = [...new Set(logik.map((p) => dirname(p)))]
  const dateien = ordner.flatMap((o) => readdirSync(join(wurzel, o)).filter((f) => PRUEFDATEI.test(f)).map((f) => `${o}/${f}`)).sort()
  const skripte = Object.values(JSON.parse(lies('package.json')).scripts).join('\n')
  return unverdrahtet({ dateien, listen, skripte, ausnahmen: zeilen(lies('tools/check-logic-liste-ausnahmen.txt')) })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fehler = pruefeVollstaendig(join(dirname(fileURLToPath(import.meta.url)), '..'))
  for (const f of fehler) console.error(`check:logic: ${f}`)
  if (fehler.length) process.exit(1)
  console.log('check-logic-vollstaendig: alle Prüfdateien verdrahtet.')
}

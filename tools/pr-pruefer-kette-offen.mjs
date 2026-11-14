/**
 * Sah der CI-Prüfer eine unfertige PR-Prüfkette? Aufruf im Schritt „Protokoll und Freigabe“ (pr-pruefer.yml):
 *   node tools/pr-pruefer-kette-offen.mjs [--nur-lauf] <kettenlog.txt>     Exit 0 = Kette war offen (mit --nur-lauf: lief noch), sonst 1 (auch bei fehlender Datei)
 * Nur Node-Bordmittel. Hintergrund: Nach der Wartezeit von tools/pr-kettenlog.mjs steht in kettenlog.txt „NOCH NICHT
 * ABGESCHLOSSEN“, wenn der Kettenlauf des Kopfes noch läuft; ein „aendern“ daraus ist kein Urteil über den PR.
 * Der Neustart nach Kettenende steht in tools/pr-pruefer-nach-kette.mjs.
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { BASIS_OFFEN_ZEILE } from './pr-pruefer-basis-offen.mjs'

/** Marke im Kommentar „nicht beurteilt“; der Neustart nach Kettenende sucht sie. */
export const MARKE_KETTE_OFFEN = '<!-- pruefer-kette-offen -->'

/** Der Kettenlauf-Satz aus pr-kettenlog.mjs (`kopfZeilen`), nicht ein beliebiges „läuft noch“ eines Jobs im fertigen Lauf. */
const OFFEN = /^Lauf \d+ der PR-Prüfkette für \S+: NOCH NICHT ABGESCHLOSSEN/
const BASIS_ZEILE = new RegExp(`^${BASIS_OFFEN_ZEILE}\\d+ ist noch offen und die Kette ist rot`)
// Nur der Kopf der Datei (HINWEIS, Lauf-Satz): alles danach sind Ausgaben des PR-Codes und könnte den Satz vortäuschen.
const KOPF_ZEILEN = 3

const kopf = (text) => String(text ?? '').split('\n').slice(0, KOPF_ZEILEN)

/** Ja, wenn die Übersicht den Kettenlauf als nicht abgeschlossen ausweist (dann startet der Prüfer gar nicht erst). */
export function kettenLaeuft(text) {
  return kopf(text).some((z) => OFFEN.test(z))
}

/** Ja, wenn die Kette läuft oder die Übersicht einen noch offenen Basis-PR meldet (tools/pr-pruefer-basis-offen.mjs). */
export function kettenOffen(text) {
  return kettenLaeuft(text) || kopf(text).some((z) => BASIS_ZEILE.test(z))
}

export function main(argv = process.argv.slice(2)) {
  const nurLauf = argv[0] === '--nur-lauf'
  let text = ''
  try {
    text = fs.readFileSync(nurLauf ? argv[1] : argv[0], 'utf8')
  } catch {
    return 1
  }
  return (nurLauf ? kettenLaeuft(text) : kettenOffen(text)) ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())

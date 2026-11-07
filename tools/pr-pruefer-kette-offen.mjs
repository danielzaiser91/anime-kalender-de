/**
 * Sah der CI-Prüfer eine unfertige PR-Prüfkette? Aufruf im Schritt „Protokoll und Freigabe“ (pr-pruefer.yml):
 *   node tools/pr-pruefer-kette-offen.mjs <kettenlog.txt>     Exit 0 = Kette war offen, sonst 1 (auch bei fehlender Datei)
 * Nur Node-Bordmittel. Hintergrund: Nach der Wartezeit von tools/pr-kettenlog.mjs steht in kettenlog.txt „NOCH NICHT
 * ABGESCHLOSSEN“, wenn der Kettenlauf des Kopfes noch läuft; ein „aendern“ daraus ist kein Urteil über den PR.
 * Der Neustart nach Kettenende steht in tools/pr-pruefer-nach-kette.mjs.
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Marke im Kommentar „nicht beurteilt“; der Neustart nach Kettenende sucht sie. */
export const MARKE_KETTE_OFFEN = '<!-- pruefer-kette-offen -->'

/** Der Kettenlauf-Satz aus pr-kettenlog.mjs (`kopfZeilen`), nicht ein beliebiges „läuft noch“ eines Jobs im fertigen Lauf. */
const OFFEN = /^Lauf \d+ der PR-Prüfkette für \S+: NOCH NICHT ABGESCHLOSSEN/
// Nur der Kopf der Datei (HINWEIS, Lauf-Satz): alles danach sind Ausgaben des PR-Codes und könnte den Satz vortäuschen.
const KOPF_ZEILEN = 3

/** Ja, wenn die Übersicht den Kettenlauf als nicht abgeschlossen ausweist. */
export function kettenOffen(text) {
  return String(text ?? '').split('\n').slice(0, KOPF_ZEILEN).some((z) => OFFEN.test(z))
}

export function main(argv = process.argv.slice(2)) {
  let text = ''
  try {
    text = fs.readFileSync(argv[0], 'utf8')
  } catch {
    return 1
  }
  return kettenOffen(text) ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())

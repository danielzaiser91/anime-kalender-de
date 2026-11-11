/**
 * Stapel-PR mit noch offenem Basis-PR: Die Kette ist dann oft nur deshalb rot, weil die Basis fehlt (PR 3436 auf 3435: der CI-Prüfer
 * urteilte „aendern“, nach dem Merge der Basis blieb der Merge gesperrt). Dieses Modul liefert
 *  - `basisNummer`: die Nummer aus „mergen nach #N“ / „erst nach #N“ in der PR-Beschreibung,
 *  - `basisZeile`: die Kopfzeile für kettenlog.txt (gesetzt in tools/pr-kettenlog.mjs), die tools/pr-pruefer-kette-offen.mjs als
 *    „nicht beurteilt“ wertet; der Neustart nach grüner Kette steht in tools/pr-pruefer-nach-kette.mjs.
 * Nur Node-Bordmittel.
 */
// „#“ oder „PR“ ist Pflicht: „erst nach 5 Minuten“ ist kein Hinweis.
const BASIS = /(?:mergen|erst)\s+nach\s+(?:PR\s*#?|#)(\d+)/i

/** Text ohne Codeblöcke, Inline-Code und Zitatzeilen: dort steht oft ein Beispielhinweis, kein echter. */
function ohneZitate(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?(```|$)/g, '')
    .replace(/`[^`\n]*`/g, '')
    .split('\n')
    .filter((z) => !z.trimStart().startsWith('>'))
    .join('\n')
}

/** Zeilenanfang der Kopfzeile in kettenlog.txt; die Marke im Kommentar bleibt die der unfertigen Kette. */
export const BASIS_OFFEN_ZEILE = 'BASIS OFFEN: PR #'

/** Nummer des Basis-PR aus der Beschreibung oder null. */
export function basisNummer(text) {
  const m = BASIS.exec(ohneZitate(text))
  return m ? Number(m[1]) : null
}

/** Kopfzeile für kettenlog.txt: nur bei abgeschlossener, nicht grüner Kette und offener Basis, sonst ''. */
export function basisZeile({ beschreibung, lauf, basisStand }) {
  const nr = basisNummer(beschreibung)
  if (!nr || basisStand !== 'open') return ''
  if (!lauf || lauf.status !== 'completed' || lauf.conclusion === 'success') return ''
  return `${BASIS_OFFEN_ZEILE}${nr} ist noch offen und die Kette ist rot: nicht beurteilt, Basis offen.`
}

/**
 * Klartext für eine rote Basis von `tools/bau-vergleich.mjs` (Exit 2): Das Protokoll (`_protokoll.txt`) hat die Form
 * `exit <N>`, die Standardausgabe, `--- stderr` und die Standardfehlerausgabe. Gemeldet werden die letzten Zeilen der
 * Fehlerausgabe ohne Warnungen (`[pipeline] ⚠`), Leerzeilen und Stack-Zeilen (`    at …`): bei einer Prüfung ihr Befund
 * („✖ …“), bei einem Absturz Fehlerart und Meldung. 13.10.2026: Eine Stunde Suche, weil nur „scheitert selbst“ dastand.
 */

const MAX_ZEILEN = 10
const MAX_BREITE = 200

/** Die aussagekräftigen Zeilen eines Protokolls; ohne Fehlerausgabe die letzten Zeilen der Standardausgabe. */
export function fehlerZeilen(protokoll) {
  const [kopf, ...rest] = protokoll.split(/\r?\n--- stderr\r?\n/)
  const fehler = rest.join('\n')
  const echt = (z) => z.trim() !== '' && !z.startsWith('[pipeline] ⚠') && !/^\s+at /.test(z)
  const quelle = fehler.split(/\r?\n/).some(echt) ? fehler : kopf.split(/\r?\n/).slice(1).join('\n')
  return quelle.split(/\r?\n/).filter(echt).slice(-MAX_ZEILEN).map((z) => (z.length > MAX_BREITE ? `${z.slice(0, MAX_BREITE - 1)}…` : z))
}

/** Meldung für Exit 2: Kopfzeile des Protokolls (`exit 1`) und die aussagekräftigen Zeilen, eingerückt. */
export function basisRotMeldung(protokoll, basisKurz, ordner) {
  const zeilen = fehlerZeilen(protokoll).map((z) => `  | ${z}`)
  const kopf = `Der Bau der Basis ${basisKurz} scheitert selbst (${protokoll.split(/\r?\n/)[0]}) — Protokoll: ${ordner}/_protokoll.txt`
  return [kopf, ...zeilen].join('\n')
}

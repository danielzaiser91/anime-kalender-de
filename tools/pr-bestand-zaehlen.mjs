/**
 * Zählen der Verstöße je Bestandsprüfung für `tools/pr-bestand-vergleich.mjs` (25.10.2026): Eine Prüfung, die auf der Basis (main) schon rot ist,
 * gilt für den PR nur als geerbt, solange sie dort nicht mehr Verstöße meldet als auf der Basis; ein zusätzlicher Verstoß macht den PR rot.
 * Die Prüfungen haben kein gemeinsames Ausgabeformat: gezählt werden die nichtleeren Ausgabezeilen ohne npm-Kopf und Erfolgszeilen.
 */

/** Zeilen, die kein Verstoß sind: npm-Kopf und -Fehlerzeilen, Erfolgsmarker. */
const KEIN_VERSTOSS = /^(>|npm (error|ERR!|warn)|[✓✔]|OK$)/

/** Zahl der Verstoßzeilen einer Prüfausgabe. */
export function zaehleVerstoesse(ausgabe) {
  return ausgabe
    .split(/\r?\n/)
    .filter((z) => z.trim() !== '' && !KEIN_VERSTOSS.test(z.trim())).length
}

/** Zerlegt die Ausgabe von `check-logic-alle.mjs` in die Ausgaben je Prüfdatei (eine Kopfzeile `[name i/n] <datei>` leitet jede ein). */
export function teileListenAusgabe(ausgabe) {
  const teile = new Map()
  let datei = null
  for (const zeile of ausgabe.split(/\r?\n/)) {
    // Der Schlussbericht des Pools (rote Liste, wiederholte letzte Zeilen) gehört zu keiner Prüfung.
    if (/^(Der Lauf hat getrackte|.+: \d+ von \d+ Prüfungen (rot:|grün))/.test(zeile)) break
    const kopf = /^\[\S+ \d+\/\d+\] (.+)$/.exec(zeile)
    if (kopf) {
      datei = kopf[1]
      teile.set(datei, [])
    } else if (datei) teile.get(datei).push(zeile)
  }
  return new Map([...teile].map(([d, zeilen]) => [d, zeilen.join('\n')]))
}

/** Trennt die roten Prüfungen des PR (Name → Verstöße) in geerbte (Basis mindestens so rot) und neue (auf der Basis nicht rot oder dort weniger Verstöße). */
export function trenneGeerbtUndNeu(prRot, basisRot) {
  const geerbt = []
  const neu = []
  for (const [name, zahl] of prRot) {
    const basis = basisRot.get(name)
    if (basis !== undefined && zahl <= basis) geerbt.push(name)
    else neu.push(name)
  }
  return { geerbt, neu }
}

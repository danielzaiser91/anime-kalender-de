/**
 * Zählen der Verstöße je Bestandsprüfung für `tools/pr-bestand-vergleich.mjs` (25.10.2026): Eine Prüfung, die auf der Basis (main) schon rot ist,
 * gilt für den PR nur als geerbt, solange sie dort nicht mehr Verstöße meldet als auf der Basis; ein zusätzlicher Verstoß macht den PR rot.
 * Jede Bestandsprüfung gibt am Ende genau eine Zeile `VERSTÖSSE: <n>` aus; nur sie wird gelesen, fehlt sie, ist das ein Fehler (nie 0 annehmen).
 */

const VERSTOESSE_ZEILE = /^VERSTÖSSE: (\d+)[ \t]*$/gm

/** Zahl aus der Zeile `VERSTÖSSE: <n>` einer Prüfausgabe; wirft, wenn die Zeile fehlt oder mehrfach vorkommt. */
export function zaehleVerstoesse(ausgabe) {
  const treffer = [...ausgabe.matchAll(VERSTOESSE_ZEILE)]
  if (treffer.length !== 1) throw new Error(`Zeile „VERSTÖSSE: <n>“ ${treffer.length === 0 ? 'fehlt' : `steht ${treffer.length}-mal`} in der Ausgabe der Prüfung`)
  return Number(treffer[0][1])
}

/** Wie `zaehleVerstoesse`, meldet einen Fehler aber laut und zählt die Prüfung dann als unvergleichbar (NaN ≤ x ist nie wahr, also nie geerbt). */
export function zaehleOderMelde(name, ausgabe, melde = console.log) {
  try {
    return zaehleVerstoesse(ausgabe)
  } catch (e) {
    melde(`::error::${name}: ${e.message}`)
    return NaN
  }
}

/** Zerlegt die Ausgabe von `check-logic-alle.mjs` in die Ausgaben je Prüfdatei (eine Kopfzeile `[name i/n] <datei>` leitet jede ein). */
export function teileListenAusgabe(ausgabe) {
  const teile = new Map()
  let datei = null
  for (const zeile of ausgabe.split(/\r?\n/)) {
    // Der Schlussbericht des Pools (rote Liste, wiederholte letzte Zeilen) gehört zu keiner Prüfung.
    if (/^(Der Lauf hat getrackte|.+: \d+ von \d+ Prüfungen rot:)/.test(zeile)) break
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

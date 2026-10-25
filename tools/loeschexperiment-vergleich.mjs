/** Vergleichslogik des Löschexperiments (`tools/loeschexperiment.mjs`): reine Funktionen, kein Dateizugriff. */

/** Urteil je Prüfung aus Basis- und Löschlauf (`{ code, ende }`): gleich, neu rot, neu grün oder rot mit anderem Ende. */
export function vergleicheLauf(basis, nach) {
  const basisRot = basis.code !== 0
  const nachRot = nach.code !== 0
  if (!basisRot && nachRot) return 'neu rot'
  if (basisRot && !nachRot) return 'neu grün'
  if (basisRot && nachRot && basis.ende !== nach.ende) return 'rot, anderes Ende'
  return 'gleich'
}

/** Letzte `n` nicht leere Zeilen der Ausgabe. */
export function letzteZeilen(text, n = 3) {
  return String(text)
    .split(/\r?\n/)
    .map((z) => z.trimEnd())
    .filter(Boolean)
    .slice(-n)
    .join('\n')
}

/** Tabelle `{ pruefung: { basis, nach } }` → Zeilen mit Urteil und Exit-Codes; `abweichend` zählt alles außer „gleich“. */
export function bilanz(laeufe) {
  const zeilen = Object.entries(laeufe).map(([name, { basis, nach }]) => ({
    name,
    urteil: vergleicheLauf(basis, nach),
    basis: basis.code,
    nach: nach.code,
  }))
  return { zeilen, abweichend: zeilen.filter((z) => z.urteil !== 'gleich').length }
}

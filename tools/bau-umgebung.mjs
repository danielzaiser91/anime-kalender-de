/**
 * Variablen, die nur der Bestandsbau setzt (`.github/workflows/bestand-bauen.yml`: `$GITHUB_ENV`, Job-`env`, Secret) und die das Ergebnis
 * einer Prüfung ändern können. `check:logic` und `check:bestand-liste` entfernen sie für jede Prüfung samt Unterprozessen, damit eine Prüfung
 * im Bau dasselbe sieht wie in der PR-Kette (PR 1624: `DATEN_WARNUNG` machte den Auffälligkeiten-Wächter erst auf main rot).
 */
export const BAU_VARIABLEN = [
  'BAU_BEGINN',
  'BAU_LAUF',
  'DATEN_WARNUNG',
  'LAUF_SCHRITTE',
  'LAUF_TOKEN',
  'LAUF_ZIEL',
  'LAUF_ZWECK',
  'MELDER',
  'MELDUNGEN_SICHERN',
]

/** Kopie von `env` ohne die Bau-Variablen. */
export function ohneBauVariablen(env = process.env) {
  const kopie = { ...env }
  for (const name of BAU_VARIABLEN) delete kopie[name]
  return kopie
}

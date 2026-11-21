/**
 * Variablen, die nur der Bestandsbau setzt (`.github/workflows/bestand-bauen.yml`: `$GITHUB_ENV`, Job-`env`, Secret) und die das Ergebnis
 * einer Prüfung ändern können. `check:logic` und `check:bestand-liste` entfernen sie für jede Prüfung samt Unterprozessen, damit eine Prüfung
 * im Bau dasselbe sieht wie in der PR-Kette (PR 1624: `DATEN_WARNUNG` machte den Auffälligkeiten-Wächter erst auf main rot).
 * Die `GITHUB_*`-Schreibdateien gehören dazu: ein Test, der sie erbt, schreibt in die echte Lauf-Warnung (Bestandsbau 08.11.2026,
 * Titel 900001 aus `pipeline/check-fetch-pruefungen-laufzeit.ts` als DATEN_WARNUNG).
 */
export const BAU_VARIABLEN = [
  'BAU_BEGINN',
  'BAU_LAUF',
  'DATEN_WARNUNG',
  'GITHUB_ENV',
  'GITHUB_OUTPUT',
  'GITHUB_PATH',
  'GITHUB_STATE',
  'GITHUB_STEP_SUMMARY',
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

/**
 * Anmeldung und Lauf-Kennung der CI (`GH_TOKEN: ${{ github.token }}` in `nachlauf.yml`, `GITHUB_ACTIONS`/`GITHUB_REPOSITORY` setzt GitHub selbst).
 * `tools/tests-alle.mjs` entfernt sie für jeden Test: erbt ein Test sie, nimmt ein Skript wie `quellen-pr.sh` den echten Token-Zweig und pusht
 * ins echte Repo (Nachlauf 21.11.2026, durchgehend rot). Ein Test, der sie braucht, setzt sie selbst im Aufruf.
 */
export const CI_TOKEN_VARIABLEN = ['GITHUB_ACTIONS', 'GH_TOKEN', 'GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID']

/** Kopie von `env` ohne die CI-Anmeldung. */
export function ohneCiToken(env = process.env) {
  const kopie = { ...env }
  for (const name of CI_TOKEN_VARIABLEN) delete kopie[name]
  return kopie
}

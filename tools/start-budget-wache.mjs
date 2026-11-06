/**
 * Wachzeile „Startbudget wird eng“: liest die Zeile, die `tools/start-budget.mjs` im Bau des jüngsten erfolgreichen Deploy-Laufs
 * auf main gedruckt hat. Die Schwelle rechnet allein das Budget-Werkzeug (`WARNLUFT`); hier wird nur seine Warnzeile gefunden,
 * nicht die Schwelle nachgebaut. Weg gemessen am 06.11.2026: 3 gh-Aufrufe, ca. 5 s, trifft den CI-Wert (lokaler Bau misst ca. 1,6 KB weniger,
 * 20 s). Eine committete Messdatei bräuchte einen Schreiber im Bau auf main.
 */
export const WARNZEILE = /start-budget: nur noch (\d+(?:\.\d+)?) KB Luft \(Warnung unter (\d+(?:\.\d+)?) KB\)/
const MESSZEILE = /start-budget: \d+(?:\.\d+)? KB gzip von/

/** Warnzeile der Wache oder null; `undefined`, wenn der Bau keine Budget-Zeile hatte. */
export function budgetZeile(log, lauf) {
  const warn = WARNZEILE.exec(log)
  if (warn) return `WARNUNG start-budget: ${warn[1]} KB Luft (Warnung unter ${warn[2]} KB, Deploy-Lauf ${lauf})`
  return MESSZEILE.test(log) ? null : undefined
}

/** Wachzeilen: Warnung, nichts, oder `START-BUDGET? …` bei Abruffehler bzw. fehlender Zeile. `gh` gibt den Text der Ausgabe zurück. */
export function startBudgetZeilen(gh, repo) {
  try {
    const lauf = gh('run', 'list', '--repo', repo, '--workflow', 'deploy.yml', '--branch', 'main', '--status', 'success', '--limit', '1', '--json', 'databaseId', '-q', '.[0].databaseId').trim()
    if (!lauf) return ['START-BUDGET? kein erfolgreicher Deploy-Lauf auf main gefunden']
    const job = gh('run', 'view', lauf, '--repo', repo, '--json', 'jobs', '-q', '.jobs[] | select(.name == "build") | .databaseId').trim()
    if (!job) return [`START-BUDGET? Deploy-Lauf ${lauf} hat keinen Job „build“`]
    const zeile = budgetZeile(gh('run', 'view', lauf, '--repo', repo, '--job', job, '--log'), lauf)
    if (zeile === undefined) return [`START-BUDGET? Deploy-Lauf ${lauf}: keine start-budget-Zeile im Bau-Log`]
    return zeile ? [zeile] : []
  } catch (fehler) {
    return [`START-BUDGET? Bau-Log nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}

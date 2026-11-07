/**
 * Auflage-Quelle „Startbudget“ für den CI-Prüfer: eine Zeile `start-budget: nur noch … KB Luft` im Kettenlog des Kopfs (Warnstufe
 * von `tools/start-budget.mjs`, im Lauf selbst unsichtbar) steht als eigene Zeile oben in `kettenlog.txt`. Ob der PR `web/` oder
 * Startdaten berührt, entscheidet der Prüfer am Diff (tools/claude-global/agents/pruefer.md).
 */
import { WARNZEILE } from './start-budget-wache.mjs'

/** Eine Zeile je Job mit Warnstufe (Job-Name, Restluft, Schwelle); `jobs` sind { name, status, log } mit bereinigten Zeilen aus `zeilenVon`. */
export function budgetHinweise(jobs, zeilenVon, name) {
  const aus = []
  for (const j of jobs) {
    if (j.status !== 'completed') continue
    const treffer = zeilenVon(j).map((z) => WARNZEILE.exec(z)).find(Boolean)
    if (treffer) aus.push(`AUFLAGE-QUELLE start-budget: Job „${name(j.name)}“ meldet nur noch ${treffer[1]} KB Luft (Warnung unter ${treffer[2]} KB). Berührt der PR web/ oder Startdaten: Auflage, Startdateien verkleinern.`)
  }
  return aus
}

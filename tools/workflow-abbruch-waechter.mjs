/**
 * Wächter (16.10.2026): Ein Workflow mit `workflow_run`-Auslöser und abbrechender Concurrency braucht zwei Ausnahmen.
 *
 * Anlass: Ein abgebrochener Bestandslauf löste den Deploy aus (`completed`, Ergebnis `cancelled`); der Lauf
 * landete in der Gruppe `pages`, brach den laufenden push-Deploy ab und übersprang sich dann selbst per Job-`if`.
 * Der Code ging erst mit dem nächsten erfolgreichen Bau live.
 *
 * Regel für jeden Workflow mit `workflow_run` und `cancel-in-progress` ungleich `false`:
 * 1. Die Gruppe enthält eine eigene Gruppe für `github.event.workflow_run.conclusion != 'success'`.
 * 2. `cancel-in-progress` ist für `workflow_run`-Läufe falsch (`github.event_name != 'workflow_run'`).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

/** Liefert die Fehlertexte eines geparsten Workflows (leer = in Ordnung). */
export function pruefeWorkflow(datei, doc) {
  const auslöser = doc?.on ?? doc?.[true]
  if (!auslöser || typeof auslöser !== 'object' || !('workflow_run' in auslöser)) return []
  const abbruch = doc.concurrency?.['cancel-in-progress']
  if (abbruch === undefined || abbruch === false) return []
  const fehler = []
  const gruppe = String(doc.concurrency?.group ?? '')
  if (!/workflow_run\.conclusion\s*!=\s*'success'\)?\s*&&\s*format\([^)]*run_id\)/.test(gruppe)) {
    fehler.push(`${datei}: workflow_run-Auslöser mit cancel-in-progress, aber die Gruppe trennt Läufe nach nicht erfolgreichem Auslöser nicht ab (workflow_run.conclusion != 'success')`)
  }
  if (!/github\.event_name\s*!=\s*'workflow_run'/.test(String(abbruch))) {
    fehler.push(`${datei}: workflow_run-Läufe dürfen nicht abbrechen (cancel-in-progress: \${{ github.event_name != 'workflow_run' }})`)
  }
  return fehler
}

export function pruefeAlle(verzeichnis) {
  const fehler = []
  for (const datei of readdirSync(verzeichnis).filter((f) => /\.ya?ml$/.test(f))) {
    fehler.push(...pruefeWorkflow(datei, parse(readFileSync(join(verzeichnis, datei), 'utf8'))))
  }
  return fehler
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const fehler = pruefeAlle(join(process.cwd(), '.github/workflows'))
  for (const f of fehler) console.error(`FEHL ${f}`)
  if (fehler.length) process.exit(1)
  console.log('workflow-abbruch-waechter: ok')
}

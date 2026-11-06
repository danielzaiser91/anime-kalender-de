import { execFileSync } from 'node:child_process'
import { schreibeEigeneZuAk } from './eigene-titel-umhaengen.ts'

/**
 * Jeder Titel der geschriebenen Ausgabe bekommt seine eigene Kennung (`data/kennungen.json`, nur ergänzend). Ohne sie bricht der
 * Seitenbau ab (`pipeline/lib/ausgabe-kennung.ts`), deshalb steht der Schritt am Ende jedes Datenbaus.
 */
export function ergaenzeKennungen(): void {
  execFileSync(process.execPath, ['tools/kennungen-erzeugen.mjs'], { stdio: 'inherit' })
  schreibeEigeneZuAk()
}

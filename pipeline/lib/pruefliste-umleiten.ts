import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Lenkt die Prüflisten des Reihen-Baus in einen Wegwerf-Ordner um (`PRUEFLISTE_ORDNER`), damit eine Prüfung die Standardwerte von `schreibe` beobachten kann, ohne `data/` zu berühren.
 * Muss als erster Import der Prüfung stehen: die Dateinamen werden beim Laden der Bau-Module festgelegt.
 */
export const ordner = mkdtempSync(join(tmpdir(), 'pruefliste-')).replaceAll('\\', '/')
process.env.PRUEFLISTE_ORDNER = ordner

export function raeumeAuf(): void {
  rmSync(ordner, { recursive: true, force: true })
}

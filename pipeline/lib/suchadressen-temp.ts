import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const VORSILBE = 'suchadressen-'
const STUNDE = 60 * 60 * 1000

/**
 * Lenkt die Suchadressen-Listen des Bau-Abschlusses (`SUCHADRESSEN_ORDNER`, siehe `bau/nebendateien.ts`) in einen Temp-Ordner um,
 * damit Prüfungen keine getrackten Dateien beschreiben. Der Ordner verschwindet beim Prozessende; Reste älter als eine Stunde
 * (abgebrochene Läufe) räumt der Aufruf weg.
 */
export function suchadressenInTemp(): void {
  for (const name of readdirSync(tmpdir()).filter((n) => n.startsWith(VORSILBE))) {
    const pfad = join(tmpdir(), name)
    try {
      if (Date.now() - statSync(pfad).mtimeMs > STUNDE) rmSync(pfad, { recursive: true, force: true })
    } catch {
      /* von einem anderen Lauf gerade entfernt */
    }
  }
  const ordner = mkdtempSync(join(tmpdir(), VORSILBE))
  process.env.SUCHADRESSEN_ORDNER = ordner
  process.on('exit', () => rmSync(ordner, { recursive: true, force: true }))
}

/**
 * Prüft vor `check:panel` und `check:ansichten`, ob `dist/` zum Stand von `web/src` passt.
 * Baut nie selbst (ein Build dauert Minuten und gehört in die Hand dessen, der ihn startet).
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/** Neuester Änderungszeitpunkt (ms) aller Dateien unter `ordner`; 0, wenn leer. */
export function neuesteAenderung(ordner) {
  let neueste = 0
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = path.join(ordner, eintrag.name)
    const zeit = eintrag.isDirectory() ? neuesteAenderung(pfad) : statSync(pfad).mtimeMs
    if (zeit > neueste) neueste = zeit
  }
  return neueste
}

/** Fehlertext, wenn `dist/` fehlt oder älter als `web/src` ist; sonst `null`. */
export function distProblem(wurzel) {
  const index = path.join(wurzel, 'dist', 'index.html')
  if (!existsSync(index)) return 'dist/ fehlt. Zuerst bauen: `npm run build`.'
  if (statSync(index).mtimeMs < neuesteAenderung(path.join(wurzel, 'web', 'src'))) {
    return 'dist/ ist älter als web/src und zeigt nicht den aktuellen Stand. Zuerst neu bauen: `npm run build`.'
  }
  return null
}

/** Meldet ein Problem mit `dist/` auf stderr, setzt Exit 1 und liefert `false`; bei frischem `dist/` `true`. */
export function distPruefen(wurzel) {
  const problem = distProblem(wurzel)
  if (!problem) return true
  console.error(problem)
  process.exitCode = 1
  return false
}

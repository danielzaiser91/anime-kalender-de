/**
 * Wächter für die Läufer `check-logic-alle.mjs` und `tests-alle.mjs`: eine Prüfung darf keine getrackte Datei verändern
 * (Anlass 15.10.2026: zwei Prüfungen überschrieben parallel `data/suchadressen-offen.json`, der Lauf blieb grün).
 * `gitStand` hält den Inhalt aller getrackten Änderungen fest (`git diff HEAD`), `veraenderte` nennt, was dazugekommen ist.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const git = (wurzel, args) => execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })

/** Stand der getrackten Änderungen: je Datei ein Hash des Diffs. `null`, wenn `wurzel` kein Git-Arbeitsbaum ist (Test-Attrappen). */
export function gitStand(wurzel) {
  try {
    const stand = new Map()
    for (const datei of git(wurzel, ['diff', 'HEAD', '--name-only']).split('\n').filter(Boolean)) {
      stand.set(datei, createHash('sha1').update(git(wurzel, ['diff', 'HEAD', '--', datei])).digest('hex'))
    }
    return stand
  } catch {
    return null
  }
}

/** Dateien, deren Diff gegenüber `vorher` neu ist oder sich geändert hat (auch: wieder auf Stand von HEAD gebracht). */
export function veraenderte(vorher, nachher) {
  if (!vorher || !nachher) return []
  const namen = new Set([...vorher.keys(), ...nachher.keys()])
  return [...namen].filter((d) => vorher.get(d) !== nachher.get(d)).sort()
}

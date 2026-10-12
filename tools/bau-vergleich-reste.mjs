/**
 * Räumt Reste abgebrochener `bau-vergleich`- und `panel-vergleich`-Läufe auf: `git worktree prune` entfernt gesperrte Einträge nicht,
 * und ein hart beendeter `git worktree add` hinterlässt genau so einen (Sperre „initializing“, Ordner fehlt).
 * Der nächste `worktree add` auf denselben Hash scheitert dann. Angefasst werden nur gesperrte `baum-*`-Einträge
 * unter der eigenen Ablage, deren Ordner fehlt — ein lebender Lauf hat seinen Ordner.
 */
import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const gleich = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase()

/** Pfade der gesperrten `baum-*`-Einträge in `ablage` aus der Ausgabe von `git worktree list --porcelain`, deren Ordner `existiert` nicht kennt. */
export function verwaisteBaeume(porcelain, ablage, existiert = existsSync) {
  return porcelain
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/))
    .filter((zeilen) => zeilen.some((z) => z === 'locked' || z.startsWith('locked ')))
    .map((zeilen) => zeilen.find((z) => z.startsWith('worktree '))?.slice('worktree '.length))
    .filter((pfad) => pfad && basename(pfad).startsWith('baum-') && gleich(dirname(pfad), ablage) && !existiert(pfad))
}

/** Entsperrt die verwaisten Einträge (Meldung je Eintrag) und räumt mit `prune` auf; liefert die betroffenen Pfade. */
export function raeumeVerwaisteBaeume(git, ablage, existiert = existsSync) {
  const verwaist = verwaisteBaeume(git('worktree', 'list', '--porcelain'), ablage, existiert)
  for (const pfad of verwaist) {
    console.log(`Vergleichswerkzeug: gesperrten, auf der Platte fehlenden Worktree ${pfad} entfernt (Rest eines abgebrochenen Laufs).`)
    git('worktree', 'unlock', pfad)
  }
  git('worktree', 'prune')
  return verwaist
}

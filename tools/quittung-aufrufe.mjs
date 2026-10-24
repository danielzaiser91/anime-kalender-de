/**
 * Erkennt in einer `run`-Zeile, welche Pipeline-Dateien aufgerufen werden: über npm-Skriptnamen (auch indirekt über
 * `package.json`) und über direkte Pfade (`tsx`/`node`), verkettet mit `&&`, `;`, `|` oder mehrzeilig, mit Zusatzargumenten.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SKRIPTE = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).scripts

const NPM = /^(?:\S+=\S*\s+)*npm\s+(?:run|run-script)\s+(\S+)/
const PFAD = /(?:^|\s)(?:\.\/)?([\w./-]+\.(?:ts|mjs|cjs|js))(?=\s|$)/

/** Teilbefehle einer Zeile (Fortsetzungszeilen zusammengezogen). */
export function befehle(text) {
  return String(text ?? '').replaceAll(/\\\r?\n/g, ' ').split(/&&|\|\||;|\||\r?\n/).map((b) => b.trim()).filter(Boolean)
}

/** Aufrufe eines Teilbefehls; bei npm-Skripten stehen die äußeren Argumente im `befehl` mit, `besucht` bricht Kreise ab. */
function aufrufeVon(befehl, skripte, besucht) {
  const name = NPM.exec(befehl)?.[1]
  if (name) {
    if (besucht.has(name)) return []
    const innen = aufrufe(skripte[name], skripte, new Set([...besucht, name]))
    return innen.map((a) => ({ datei: a.datei, befehl: `${a.befehl} ${befehl}` }))
  }
  const pfad = PFAD.exec(befehl)?.[1]
  return pfad ? [{ datei: pfad, befehl }] : []
}

/** Alle Aufrufe einer `run`-Zeile als `{ datei, befehl }`; `befehl` trägt die Zusatzargumente. */
export function aufrufe(run, skripte = SKRIPTE, besucht = new Set()) {
  return befehle(run).flatMap((befehl) => aufrufeVon(befehl, skripte, besucht))
}

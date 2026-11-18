/**
 * Ort jeder Prüfung (18.11.2026): `tools/pruefung-ort.json` nennt die Prüfungen, die nicht in der PR-Kette laufen, sondern nachts gegen main
 * (`.github/workflows/nacht-pruefung.yml`, `npm run check:nachts`). Alles, was dort nicht steht, hat den Ort „pr“. Jede Prüfung hat genau einen Ort:
 * `check:logic` und `tests-alle` lassen die Nacht-Einträge aus, `--nachts` fährt nur sie. Eine Nacht-Prüfung mit `liest` (Repo-Dateien oder Ordner mit `/` am Ende,
 * die sie echt liest) läuft im PR-Ereignis trotzdem mit, sobald der PR eine dieser Dateien ändert (Diff gegen `HEAD^1`, im flachen Klon wird die Basis nachgeladen); lässt sich der Diff nicht lesen, läuft sie mit.
 * Das Urteil über die Datei fällt `tools/pr-kette-ort.mjs`. Fehlt die Datei (Wegwerf-Repos der Tests), gibt es keine Nacht-Einträge.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ladeBasis } from './pr-basis.mjs'

export const ORT_DATEI = 'tools/pruefung-ort.json'
/** Marke statt Dateiliste: der Diff ließ sich nicht lesen, jede Nacht-Prüfung mit `liest` läuft mit. */
export const ALLE = 'alle'

/** Inhalt der Zuordnungsdatei; ohne Datei leer. */
export function leseOrt(wurzel) {
  const pfad = join(wurzel, ORT_DATEI)
  return existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : { logik: {}, tests: {} }
}

/** Modus aus den Argumenten: `pr` (Standard) oder `nachts` (`--nachts`). */
export function leseModus(argv) {
  return argv.includes('--nachts') ? 'nachts' : 'pr'
}

/** Die vom PR geänderten Dateien (Diff gegen den ersten Elternteil des Merge-Commits); außerhalb des PR-Ereignisses leer, bei Lesefehler `ALLE`. */
export function beruehrteDateien(wurzel, env = process.env) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return []
  try {
    const git = (...a) => execFileSync('git', a, { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] })
    return git('diff', '--name-only', '--no-renames', ladeBasis(git), 'HEAD').split('\n').filter(Boolean)
  } catch (fehler) {
    console.warn(`⚠ WARNUNG pruefung-ort: Diff des PR nicht lesbar (${String(fehler.message).split('\n')[0]}): Nacht-Prüfungen mit Lesedateien laufen mit`)
    return ALLE
  }
}

/** Liest der Eintrag eine der berührten Dateien? Ordner (`/` am Ende) gelten als Präfix. */
export function liestBeruehrtes(eintrag, beruehrt) {
  const liest = eintrag?.liest ?? []
  if (liest.length === 0) return false
  if (beruehrt === ALLE) return true
  return beruehrt.some((datei) => liest.some((l) => (l.endsWith('/') ? datei.startsWith(l) : datei === l)))
}

/** Gehört der Eintrag zum Modus? `pr` = alle ohne Nacht-Ort plus Nacht-Einträge, deren Lesedatei der PR berührt; `nachts` = alle mit Nacht-Ort. */
function passt(eintrag, modus, beruehrt) {
  const nachts = eintrag?.ort === 'nachts'
  if (modus === 'pr') return !nachts || liestBeruehrtes(eintrag, beruehrt)
  return nachts
}

/** Die Einträge von `liste` zum Modus; `art` = `logik` oder `tests`, `name(eintrag)` = Schlüssel in der Zuordnungsdatei, `beruehrt` = geänderte Dateien des PR (nur Modus `pr`). */
export function nachOrt(liste, ort, art, modus, name = (e) => e, beruehrt = []) {
  return liste.filter((e) => passt(ort[art]?.[name(e)], modus, beruehrt))
}

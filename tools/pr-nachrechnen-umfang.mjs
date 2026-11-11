/**
 * Umfang-Grenzen im Nachrechnen (11.11.2026): Der Bestandsbau senkt `tools/umfang-grenzen.json` bei fast jedem Lauf (`--festschreiben`);
 * als kettenweite Datei machte das jeden liegenden PR NICHT AKTUELL (Messung 10.-11.11.: zwei von zwölf Abweisungen nur deswegen).
 * Hat main die Grenzen nur gesenkt, genügt es, `umfang-pruefen` auf dem Merge-Stand (PR-Kopf + main) zu rechnen: Merge-Baum aus
 * `git merge-tree`, Dateien aus dem Objektspeicher, ohne Arbeitsbaum. Eine Erhöhung auf main zählt weiter als Bewegung.
 * Das Messen läuft in einem Kindprozess (`umfang-baum-messen.mjs`): es braucht `typescript`, der Nacht-Merger läuft ohne `npm ci`
 * (`workflow-ohne-pakete`); dort scheitert nur das Kind, der PR gilt als „nicht ermittelbar“ veraltet.
 */
import { LIMIT_SKRIPT_MS, mitLimit } from './kind-mit-limit.mjs'
import { fileURLToPath } from 'node:url'
import { gitAufruf, inhalte } from './pr-nachrechnen-leser-git.mjs'

export const UMFANG_GRENZEN = 'tools/umfang-grenzen.json'
const ARTEN = ['funktionen', 'dateien', 'ketten']
const MESSER = fileURLToPath(new URL('./umfang-baum-messen.mjs', import.meta.url))

/** Verstöße des Baums gegen die Grenzen auf main, gemessen im Kindprozess (Frist `LIMIT_SKRIPT_MS`); wirft mit der Ursache des Kindes. */
export function standardMessen(baum, main) {
  try {
    return JSON.parse(mitLimit(process.execPath, [MESSER, baum, main], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }, { limitMs: LIMIT_SKRIPT_MS }))
  } catch (e) {
    throw new Error(String(e.stderr || e.message).trim().split('\n')[0])
  }
}

/** Erste Grenze, die `neu` gegenüber `alt` erhöht (auch neuer Bereich mit Wert > 0), sonst null. */
export function grenzErhoehung(alt, neu) {
  for (const [bereich, werte] of Object.entries(neu.ueberlaenge)) {
    for (const art of ARTEN) {
      const vorher = alt.ueberlaenge[bereich]?.[art] ?? 0
      if ((werte[art] ?? 0) > vorher) return `${bereich} ${art} ${vorher} -> ${werte[art]}`
    }
  }
  return null
}

/** Merge-Baum von Kopf und main (ohne Arbeitsbaum); wirft bei Konflikt. */
const mergeBaum = (git, main, kopf) => git(['merge-tree', '--write-tree', '--no-messages', main, kopf]).trim().split(/\r?\n/)[0]

/**
 * null = der PR hält auf dem Merge-Stand die Grenzen von main und main hat sie nicht erhöht (die Bewegung der Datei entwertet nichts);
 * sonst der Grund. `refs` { nummer, kopf, main, basis }; `git` wie in `gitLeser`, `messen(baum, main)` -> Verstöße (Standard: Kindprozess).
 */
export function umfangGrund(refs, git = gitAufruf, messen = standardMessen) {
  try {
    git(['fetch', '-q', 'origin', `refs/pull/${refs.nummer}/head`, refs.main, refs.basis])
    const lies = (ref) => JSON.parse(inhalte(git, ref, [UMFANG_GRENZEN]).get(UMFANG_GRENZEN))
    const erhoeht = grenzErhoehung(lies(refs.basis), lies(refs.main))
    if (erhoeht !== null) return `main erhöhte die Umfang-Grenze (${erhoeht})`
    const zuViel = messen(mergeBaum(git, refs.main, refs.kopf), refs.main)
    return zuViel.length === 0 ? null : `der PR reißt auf dem Merge-Stand die Umfang-Grenzen von main: ${zuViel.join('; ')}`
  } catch (e) {
    return `Umfang nicht ermittelbar (${String(e.message).split('\n')[0].slice(0, 120)})`
  }
}

/**
 * Umfang-Grenzen im Nachrechnen (11.11.2026): Der Bestandsbau senkt `tools/umfang-grenzen.json` bei fast jedem Lauf (`--festschreiben`);
 * als kettenweite Datei machte das jeden liegenden PR NICHT AKTUELL (Messung 10.-11.11.: zwei von zwölf Abweisungen nur deswegen).
 * Hat main die Grenzen nur gesenkt, genügt es, `umfang-pruefen` auf dem Merge-Stand (PR-Kopf + main) zu rechnen: Merge-Baum aus
 * `git merge-tree`, Dateien aus dem Objektspeicher, ohne Arbeitsbaum. Eine Erhöhung auf main zählt weiter als Bewegung.
 * Ohne `typescript` (Nacht-Merger ohne `npm ci`) ist das Messen nicht möglich: Grund „nicht ermittelbar“, der PR gilt als veraltet.
 */
import { gitAufruf, inhalte } from './pr-nachrechnen-leser-git.mjs'

export const UMFANG_GRENZEN = 'tools/umfang-grenzen.json'
const ARTEN = ['funktionen', 'dateien', 'ketten']

let messer = null
let messerFehler = 'nicht geladen'
try {
  const m = await import('./umfang-pruefen.mjs')
  messer = { BEREICHE: m.BEREICHE, istVermessen: m.istVermessen, vermessen: m.vermessen, gegenGrenzen: m.gegenGrenzen }
} catch (e) {
  messerFehler = String(e.message).split('\n')[0].slice(0, 100)
}
export const standardMesser = messer

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

/** Dateien, die `umfang-pruefen` vermisst, im Baum `baum`. */
function vermesseneDateien(git, baum, m) {
  const roh = git(['ls-tree', '-r', '-z', '--name-only', baum, '--', ...m.BEREICHE])
  return roh.split('\0').filter((p) => p !== '' && m.istVermessen(p))
}

/**
 * null = der PR hält auf dem Merge-Stand die Grenzen von main und main hat sie nicht erhöht (die Bewegung der Datei entwertet nichts);
 * sonst der Grund. `refs` { nummer, kopf, main, basis }; `git` wie in `gitLeser`, `m` der Messer (Standard: umfang-pruefen).
 */
export function umfangGrund(refs, git = gitAufruf, m = standardMesser) {
  if (m === null) return `Umfang nicht ermittelbar (umfang-pruefen nicht ladbar: ${messerFehler})`
  try {
    git(['fetch', '-q', 'origin', `refs/pull/${refs.nummer}/head`, refs.main, refs.basis])
    const lies = (ref) => JSON.parse(inhalte(git, ref, [UMFANG_GRENZEN]).get(UMFANG_GRENZEN))
    const erhoeht = grenzErhoehung(lies(refs.basis), lies(refs.main))
    if (erhoeht !== null) return `main erhöhte die Umfang-Grenze (${erhoeht})`
    const baum = mergeBaum(git, refs.main, refs.kopf)
    const texte = inhalte(git, baum, vermesseneDateien(git, baum, m))
    const { zuViel } = m.gegenGrenzen(m.vermessen([...texte.keys()], (p) => texte.get(p)).stand, lies(refs.main))
    return zuViel.length === 0 ? null : `der PR reißt auf dem Merge-Stand die Umfang-Grenzen von main: ${zuViel.join('; ')}`
  } catch (e) {
    return `Umfang nicht ermittelbar (${String(e.message).split('\n')[0].slice(0, 120)})`
  }
}

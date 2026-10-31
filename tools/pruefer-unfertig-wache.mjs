/**
 * Kennzahl „Prüfer sah unfertige Kette“: Anteil der letzten Prüfer-Urteile, deren erste Zeile „ok, Checks laufen noch: …“
 * lautet (Schritt „Check-Stand des Kopfes“ in pr-pruefer.yml; nur „ok“ bekommt den Zusatz). Quelle ist der Urteilskommentar
 * des CI-Prüfers, ein Abruf der jüngsten Repo-Kommentare. Warnzeile ab 10 % bei mindestens 10 Urteilen.
 */
export const LETZTE_URTEILE = 30
export const MINDEST_URTEILE = 10
export const WARN_ANTEIL = 0.1

const BOT = 'github-actions[bot]'
const URTEIL = /^\*\*Prüfer-Review\*\* für \S+ - Urteil: \*\*(.*)\*\*/

/** Urteilszeilen (Text hinter „Urteil:“) der Prüfer-Kommentare des Bots, neueste zuerst wie geliefert, höchstens `n`. */
export function urteile(kommentare, n = LETZTE_URTEILE) {
  const aus = []
  for (const k of kommentare) {
    if (k.user?.login !== BOT) continue
    const treffer = URTEIL.exec(String(k.body ?? '').split('\n')[0])
    if (treffer) aus.push(treffer[1])
  }
  return aus.slice(0, n)
}

/** Zählung über die jüngsten Urteile: `{ gesamt, unfertig, anteil }`. */
export function unfertigeKette(kommentare, n = LETZTE_URTEILE) {
  const liste = urteile(kommentare, n)
  const unfertig = liste.filter((u) => u.includes('Checks laufen noch')).length
  return { gesamt: liste.length, unfertig, anteil: liste.length === 0 ? 0 : unfertig / liste.length }
}

/** Warnzeile oder null; zu wenige Urteile sind keine Aussage. */
export function unfertigZeile(z) {
  if (z.gesamt < MINDEST_URTEILE || z.anteil < WARN_ANTEIL) return null
  const prozent = Math.round(z.anteil * 100)
  return `PRUEFER: ${z.unfertig} von ${z.gesamt} Prüfer-Urteilen sahen eine unfertige Kette (${prozent} %, Grenze ${WARN_ANTEIL * 100} %)`
}

/** Wachzeilen: Warnung oder nichts; ein Abruffehler wird zur eigenen Zeile `PRUEFER? …`. `gh` gibt den JSON-Text zurück. */
export function prueferZeilen(gh, repo) {
  try {
    const roh = gh('api', `repos/${repo}/issues/comments?sort=created&direction=desc&per_page=100`)
    const zeile = unfertigZeile(unfertigeKette(JSON.parse(roh)))
    return zeile ? [zeile] : []
  } catch (fehler) {
    return [`PRUEFER? Prüfer-Urteile nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}

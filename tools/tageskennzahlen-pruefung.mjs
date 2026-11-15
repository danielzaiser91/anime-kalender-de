/**
 * Reine Rechenfunktionen für Qualität (Prüfer-Urteile) und „CI grün bis Merge“ der Tageskennzahlen; kein gh, kein git.
 *
 * Zählweise Qualität (gemessen an PR 3920, 3912, 3922, 3911 vom 15.11.2026): Der CI-Prüfer schreibt je Kopf einen Kommentar
 * „**Prüfer-Review** für <Kopf> - Urteil: **ok|aendern|nicht beurteilt, …**“, echt auch mit Zusatz (4 363 Kommentare seit 10.10.2026:
 * ok 2 636, aendern 1 158, „ok, Checks rot: …“ / „ok, Checks laufen noch: …“ 229, „aendern, Auflagen offen: Dirigent entscheidet“ 146,
 * „nicht beurteilt, …“ 194). Entscheidung je Form:
 *   - „nicht beurteilt, …“ (Kette lief noch) ist kein Urteil.
 *   - „ok“ mit Zusatz ist ok: der Prüfer hat den Inhalt freigegeben, rot oder laufend beschreibt nur die Kette; keine Nachbesserung.
 *   - „aendern“ mit Zusatz ist aendern.
 *   - Dasselbe Urteil auf demselben Kopf zählt einmal; bekommt ein Kopf, der „aendern“ hatte, später „ok“ (Neulauf ohne neuen Commit), ist er
 *     keine Nachbesserung: er hat die Freigabe selbst erhalten.
 *   - Prüfrunde eines PR = ein Kopf mit Urteil ≠ ok, der vor dem ersten „ok“ liegt und nie selbst „ok“ bekommt
 *     (ein „aendern“ nach dem ersten „ok“, etwa weil main hereingemergt wurde, ist keine Nachbesserung des Inhalts und zählt nicht).
 *   - Das ist das Urteil des CI-Prüfers; bei Stufe-2-PRs kann der Prüfer-Agent früher „ändern“ sagen (Handtext, zählt nicht).
 *   - Freigabe in Runde 1 = das erste Urteil des PR ist „ok“, also null Nachbesserungsrunden.
 *   - Es zählen nur PRs von Hand, die am Tag gemergt wurden und mindestens ein Urteil haben (Stufe-0-Kleinigkeiten ohne Urteil fallen heraus).
 * Prüfer-Agent-Kommentare und „Nachtrag (Abnahme Dirigent …“ sind Handtexte mit wechselnder Form und zählen nicht.
 *
 * CI grün bis Merge: Ende des letzten erfolgreichen Laufs „PR-Prüfkette“ auf dem Kopf, der gemergt wurde (spätestens zum Merge), bis mergedAt.
 */
import { median } from './tageskennzahlen-rechnen.mjs'

const KETTE = 'PR-Prüfkette'
const stunden = (ms) => ms / 3_600_000
const runde = (x, stellen = 2) => Number(x.toFixed(stellen))

/** Kommentarzeilen { pr, zeit, kopf, urteil } -> Map PR-Nummer -> Urteile in Zeitfolge (ohne „nicht beurteilt“). */
export function urteileJePr(zeilen) {
  const jePr = new Map()
  for (const z of [...zeilen].sort((a, b) => Date.parse(a.zeit) - Date.parse(b.zeit))) {
    if (z.urteil.startsWith('nicht beurteilt')) continue
    if (!jePr.has(z.pr)) jePr.set(z.pr, [])
    jePr.get(z.pr).push({ kopf: z.kopf, ok: /^ok(,|$)/.test(z.urteil) })
  }
  return jePr
}

/** Nachbesserungsrunden eines PR aus seinen Urteilen (Zählweise im Kopfkommentar). */
export function nachbesserungsrunden(urteile) {
  const ersterOk = urteile.findIndex((u) => u.ok)
  const davor = ersterOk < 0 ? urteile : urteile.slice(0, ersterOk)
  const freigegeben = new Set(urteile.filter((u) => u.ok).map((u) => u.kopf))
  return new Set(davor.map((u) => u.kopf).filter((k) => !freigegeben.has(k))).size
}

/** Qualität der am Tag von Hand gemergten PRs; `undefined`, wenn keiner ein Urteil hat. `prs`: [{ number }]. */
export function qualitaet(prs, urteile) {
  const mitUrteil = prs.filter((p) => urteile.has(p.number))
  if (mitUrteil.length === 0) return undefined
  const runden = mitUrteil.map((p) => nachbesserungsrunden(urteile.get(p.number)))
  return {
    prs: mitUrteil.length,
    runde1Prozent: runde((runden.filter((r) => r === 0).length / runden.length) * 100, 1),
    nachbesserungenJePr: runde(runden.reduce((a, b) => a + b, 0) / runden.length),
  }
}

/** Median (h) von „CI grün“ bis Merge; `prs`: [{ headSha, mergedAt }], `laeufe`: [{ name, headSha, ende, conclusion }]; `undefined` ohne belegbaren PR. */
export function medianCiGruenBisMergeH(prs, laeufe) {
  const gruen = new Map()
  for (const l of laeufe) {
    if (l.name !== KETTE || l.conclusion !== 'success') continue
    gruen.set(l.headSha, [...(gruen.get(l.headSha) ?? []), Date.parse(l.ende)])
  }
  const abstaende = []
  for (const p of prs) {
    const merge = Date.parse(p.mergedAt)
    const enden = (gruen.get(p.headSha) ?? []).filter((e) => e <= merge)
    if (enden.length > 0) abstaende.push(stunden(merge - Math.max(...enden)))
  }
  const m = median(abstaende)
  return m === undefined ? undefined : runde(m)
}

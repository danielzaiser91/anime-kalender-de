import { log, warn } from '../lib/util.ts'
import { anisearchKanonisch, anisearchSeite } from '../lib/anisearch-seite.ts'
import { eigeneHandlungFehler, eigeneTexteAktiv, ladeEigeneHandlungen, type EigeneHandlung } from '../lib/handlung-eigen.ts'
import { type SynopsisEintrag } from './13-1-anreichern.ts'

/** Der Eintrag eines eigenen Textes in `public/data/synopses/`: Text, erste Quelle als `deSource`, alle Quellen samt Lizenz in `eigen`. */
function eigenerEintrag(e: EigeneHandlung, bisher: SynopsisEintrag | undefined, anisearchId: number | undefined): SynopsisEintrag {
  const quellen = e.quellen.map((q) => ({ name: q.name, url: anisearchKanonisch(q.url) }))
  return {
    ...bisher,
    de: e.text,
    deSource: quellen[0]!,
    eigen: { quellen, lizenz: e.lizenz, ...(e.umfang === 'reihe' ? { reihe: true as const } : {}) },
    ...(anisearchId === undefined ? {} : { asUrl: anisearchSeite(anisearchId) }),
  }
}

/** Die Warnung zu einem ungenutzten Eintrag: Hinter dem Toggle ist der Titel nicht verloren, der Text gilt wieder, sobald er sichtbar wird. */
export function ungenutztWarnung(u: { id: number; grund: string }, hinterToggle: ReadonlySet<number>): string {
  if (hinterToggle.has(u.id)) return `Eigene Handlung ${u.id} liegt hinter dem Toggle (keine deutsche Fassung belegt) — Eintrag bleibt stehen, der Text gilt wieder, sobald der Titel sichtbar ist`
  return `Eigene Handlung ${u.id} ungenutzt (${u.grund}) — Eintrag in data/handlung-eigen.yaml löschen`
}

/**
 * **Eigene Texte für Titel ohne jede deutsche Handlung** (nach `baueAuslieferung`, wenn aniSearch, Archiv und TMDB ihren Platz hatten).
 * Eine fehlerhafte Datei bricht den Bau ab; ein Eintrag, der nicht mehr gebraucht wird, steht als Warnung im Protokoll.
 */
export function ergaenzeEigeneHandlungen(synopses: Record<number, SynopsisEintrag>, titel: { id: number; anisearchId?: number }[], verschoben: { id: number }[]): number {
  const eintraege = ladeEigeneHandlungen()
  const fehler = eigeneHandlungFehler(eintraege)
  if (fehler.length) throw new Error(`data/handlung-eigen.yaml fehlerhaft:\n${fehler.join('\n')}`)
  const asIds = new Map(titel.map((t) => [t.id, t.anisearchId]))
  const { aktiv, ungenutzt } = eigeneTexteAktiv(eintraege, (id) => !!synopses[id]?.de, (id) => asIds.has(id))
  const hinterToggle = new Set(verschoben.map((t) => t.id))
  for (const u of ungenutzt) warn(ungenutztWarnung(u, hinterToggle))
  for (const e of aktiv) synopses[e.id] = eigenerEintrag(e, synopses[e.id], asIds.get(e.id))
  log(`Eigene Handlungstexte: ${aktiv.length} eingebunden, ${ungenutzt.length} ungenutzt`)
  return aktiv.length
}

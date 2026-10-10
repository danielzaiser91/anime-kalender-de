import type { Release, Title } from '../../shared/types.ts'

/** Je Release-Liste die Titel mit einem sicheren (nicht geschätzten, nicht widerlegten) Termin — einmal gerechnet. */
const sichereTermine = new WeakMap<Release[], Set<number>>()

/**
 * **Ein Teil ohne belegte deutsche Fassung** (Daniel, 07.10.2026, Black Clover Staffel 2: „laut unserem Wissensstand gibt es keine deutsche
 * Synchro — es muss hinter dem Toggle verschwinden und ein ✕ DE bekommen"). Gemeint ist ein Titel ab 2023, den wir nur über eine
 * Ankündigung führen: geringe Sicherheit, kein Stream mit belegter Synchro, keine deutsche Erstausgabe mit Synchro, keine deutschen Sprecher,
 * kein sicherer deutscher Termin (ein Termin, der nur den Start mit Untertiteln meint, ist geschätzt).
 *
 * Wirkt **nur auf die Reihenliste** im Panel (gestrichelt, hinter „ohne Synchro ausblenden") — der Titel bleibt im Kalender, weil seine
 * Ankündigung dort steht.
 */
export function ohneBelegteSynchro(t: Title, releases: Release[]): boolean {
  if (!(t.einzelquelle ?? t.dubConfidence === 'low') || (t.jpYear ?? 0) < 2023) return false
  if (t.streams?.some((s) => s.dub === true) || t.deErstausgabe?.synchro || t.hasVoices) return false
  let sicher = sichereTermine.get(releases)
  if (!sicher) {
    sicher = new Set(releases.filter((r) => !r.schedule?.estimated && !r.widerlegt && !r.sprache).map((r) => r.titleId)) // ein OmU-/Sprache-offen-Termin belegt nichts
    sichereTermine.set(releases, sicher)
  }
  return !sicher.has(t.id)
}

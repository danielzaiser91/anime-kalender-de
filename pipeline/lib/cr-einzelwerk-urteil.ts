import type { Title } from '../../shared/types.ts'
import { normSchluessel } from './util.ts'

export type EinzelwerkEintrag = {
  titel?: string
  en?: string
  romaji?: string
  treffer?: { titel?: string; art?: string; audio?: string[] } | null
}


/** Sammler: passt der Katalogeintrag zu einem unserer Namen? `exakt` oder Teil-Abgleich (nie gegen eine Serie). */
export function katalogTrefferPasst(it: { title?: string; type?: string }, namen: string[]): { passt: boolean; exakt: boolean } {
  const exakt = normSchluessel(it.title) !== '' && namen.some((n) => normSchluessel(it.title) === normSchluessel(n))
  const teil = it.type !== 'series' && normSchluessel(it.title).length >= 6 && namen.some((n) => normSchluessel(n).includes(normSchluessel(it.title)))
  return { passt: exakt || teil, exakt }
}

/**
 * Belegt der Eintrag aus `data/cr-einzelwerke.json` die deutsche Fassung des Einzelwerks?
 *
 * Ein Teil-Abgleich (Katalogtitel steckt in unserem) gegen eine **Serie** belegt nichts:
 * deren `de-DE` gilt für die Serie, nicht für OVA oder Special (Dorohedoro, 20.10.2026).
 * Ja also bei exaktem Namen, oder bei Teil-Abgleich nur, wenn der Treffer keine Serie ist.
 *
 * Altdaten ohne `art` (Stand 20.10.2026): nur der exakte Name zählt. Entfällt, sobald der
 * nächste CR-Lokallauf (`data:cr-einzelwerke`) `art` für alle Treffer liefert.
 */
export function einzelwerkBelegt(eintrag: EinzelwerkEintrag): boolean {
  const t = eintrag.treffer
  if (!t?.audio?.includes('de-DE')) return false
  const exakt = [eintrag.titel, eintrag.en, eintrag.romaji].some((n) => normSchluessel(n) !== '' && normSchluessel(n) === normSchluessel(t.titel))
  if (exakt) return true
  return t.art !== undefined && t.art !== 'series'
}

/** Setzt `dub: true` am Crunchyroll-Weg jedes belegten Einzelwerks; Rückgabe: Anzahl. Nur Ja, nie Nein. */
export function belegeEinzelwerke(titles: Map<number, Title>, eintraege: ({ id: number } & EinzelwerkEintrag)[]): number {
  let anzahl = 0
  for (const eintrag of eintraege) {
    if (!einzelwerkBelegt(eintrag)) continue
    const stream = titles.get(eintrag.id)?.streams.find((s) => s.platform === 'crunchyroll')
    if (!stream || stream.dub !== undefined) continue
    stream.dub = true
    anzahl++
  }
  return anzahl
}

import type { Release } from '../../shared/types.ts'
import type { Vorschlag } from './meldungen.ts'
import { log, writeJson } from './util.ts'

/**
 * **Was ein Sammelartikel meldet und der Bau keinem Titel zuordnen konnte** (04.10.2026): „Tokyo Revengers: War of the
 * Three Titan Arc" („Ab sofort", deutsch, Disney+) fand keinen Titel im Bestand und wurde still verworfen — der Start
 * fehlte im Kalender, bis Daniel ihn meldete. Diese Liste macht das Verworfene sichtbar (`data/proposals/nicht-zugeordnet.json`):
 * Titel, Artikel, Tag, Anbieter. Nur Meldungen mit deutschem Ton und Tag; alles andere ist kein verpasster Termin.
 */
export interface NichtZugeordnet {
  titel: string
  artikel: string
  tag: string
  anbieter: string[]
  quelle: string
}

export function unzugeordnet(sammelVorschlaege: Vorschlag[], neueReleases: Release[]): NichtZugeordnet[] {
  const behandelt = new Set(neueReleases.map((r) => r.herkunft ?? ''))
  return sammelVorschlaege
    .filter((v) => v.dub === 'zugesagt' && (v.dates ?? []).some((d) => d.iso))
    .filter((v) => ![...behandelt].some((h) => h.includes(v.articleTitle)))
    .map((v) => ({
      titel: v.articleTitle.replace(/^»|«.*$/g, ''),
      artikel: v.articleUrl,
      tag: v.dates!.find((d) => d.iso)!.iso!,
      anbieter: v.platforms ?? [],
      quelle: 'Sammelartikel',
    }))
}

/** Schreibt die Liste neben die übrigen Vorschläge und nennt sie im Log. */
export function schreibeUnzugeordnet(sammelVorschlaege: Vorschlag[], neueReleases: Release[]): void {
  const liste = unzugeordnet(sammelVorschlaege, neueReleases)
  writeJson('data/proposals/nicht-zugeordnet.json', { stand: new Date().toISOString().slice(0, 10), eintraege: liste }, true)
  if (liste.length) log(`${liste.length} Sammelartikel-Meldungen mit deutschem Ton keinem Titel zugeordnet (data/proposals/nicht-zugeordnet.json)`)
}

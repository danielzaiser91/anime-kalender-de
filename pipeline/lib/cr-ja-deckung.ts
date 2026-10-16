import type { Release, Title } from '../../shared/types.ts'
import { crunchyrollSeriesId, type CrunchyrollEntry } from './crunchyroll.ts'
import {
  beurteile,
  beurteileBlockketten,
  beurteileJeBlock,
  beurteileNachFolgennummern,
  beurteileTeilblock,
  kapitelImBlock,
  type CrDubData,
  type CrSerie,
} from './crunchyroll-dub.ts'

/** Serie mit einem Block ohne eine deutsche Folge: Ein Ja für die ganze Adresse kann dort an der falschen Staffel hängen. */
function hatNullBlock(serie: CrSerie): boolean {
  return (serie.staffeln ?? []).some((s) => s.folgen > 0 && s.deutsch === 0)
}

function deutschFolgen(serie: CrSerie): number {
  return (serie.staffeln ?? []).reduce((n, s) => n + (s.deutscheFolgen?.length ?? 0), 0)
}

/**
 * Titel mit Block-Urteil „deutsch“, in der Reihenfolge des Baus: je Adresse `beurteile` (`09-4-1`), dann je Serienkennung
 * Folgennummern, je Block (nur die noch offenen Titel), Ketten, Teilblöcke (`09-4-2`), zuletzt je Titel allein (`09-6`).
 */
function durchBlockUrteil(serien: CrSerie[], nachUrl: Map<string, Title[]>): Set<number> {
  const ja = new Set<number>()
  const beurteilt = new Set<number>()
  const merke = (urteile: { titleId: number; dub: boolean }[]) => {
    for (const u of urteile) {
      if (!beurteilt.has(u.titleId) && u.dub) ja.add(u.titleId)
      beurteilt.add(u.titleId)
    }
  }
  for (const serie of serien) merke(beurteile(serie, nachUrl.get(serie.url) ?? []))

  const nachKennung = new Map<string, { serie: CrSerie; titel: Map<number, Title> }>()
  for (const serie of serien) {
    if (!serie.seriesId) continue
    const eintrag = nachKennung.get(serie.seriesId) ?? { serie, titel: new Map<number, Title>() }
    if (deutschFolgen(serie) > deutschFolgen(eintrag.serie)) eintrag.serie = serie
    for (const t of nachUrl.get(serie.url) ?? []) eintrag.titel.set(t.id, t)
    nachKennung.set(serie.seriesId, eintrag)
  }
  for (const { serie, titel } of nachKennung.values()) {
    const alle = [...titel.values()]
    merke(beurteileNachFolgennummern(serie, alle))
    merke(beurteileJeBlock(serie, alle.filter((t) => !beurteilt.has(t.id))))
    merke(beurteileBlockketten(serie, alle))
    merke(beurteileTeilblock(serie, alle))
  }
  for (const serie of serien) {
    for (const t of nachUrl.get(serie.url) ?? []) {
      if (kapitelImBlock(serie, t) === true) ja.add(t.id)
      for (const u of beurteile(serie, [t])) if (u.dub) ja.add(u.titleId)
    }
  }
  return ja
}

interface DeckungsEingabe {
  titles: Title[]
  /** Kennungen mit eigenem Crunchyroll-Termin im Kalender (`releases.json`). */
  mitTermin: Set<number>
  /** Kennungen mit Handbeleg „deutsch“ oder Katalog-Beleg (Einzelwerke, Filmblöcke, Katalogzuordnung, offene Befunde). */
  mitBeleg: Set<number>
  crDub: CrDubData
}

/**
 * Crunchyroll-Ja ohne Folgenbereiche in einer Serie mit Null-Block, das kein Beleg trägt (16.10.2026, Dorohedoro: Slot Season 2 gab S1 und
 * dem Special ein Ja). Gedeckt ist ein Ja durch ein Block-Urteil, den eigenen Termin oder einen Beleg aus Hand oder Katalog. Rückgabe: `Kennung Name`.
 */
export function crJaOhneDeckung({ titles, mitTermin, mitBeleg, crDub }: DeckungsEingabe): string[] {
  const nachUrl = new Map<string, Title[]>()
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (s.platform === 'crunchyroll') nachUrl.set(s.url, [...(nachUrl.get(s.url) ?? []), t])
    }
  }
  const gedeckt = durchBlockUrteil(crDub.serien, nachUrl)
  const offen: string[] = []
  for (const serie of crDub.serien) {
    if (!hatNullBlock(serie)) continue
    for (const t of nachUrl.get(serie.url) ?? []) {
      const weg = t.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
      if (!weg?.dub || weg.dubRanges?.length) continue
      if (gedeckt.has(t.id) || mitTermin.has(t.id) || mitBeleg.has(t.id)) continue
      offen.push(`${t.id} ${t.titleRomaji ?? '?'}`)
    }
  }
  return offen
}

export function kennungenMitCrTermin(releases: Release[]): Set<number> {
  return new Set(releases.filter((r) => r.platform === 'crunchyroll').map((r) => r.titleId))
}

/** Serienkennungen, deren Katalogdaten einen Block ohne deutsche Folge führen. */
export function serienkennungenMitNullBlock(crDub: CrDubData): Set<string> {
  const ids = new Set<string>()
  for (const serie of crDub.serien) {
    if (serie.seriesId && hatNullBlock(serie)) ids.add(serie.seriesId)
  }
  return ids
}

/**
 * Belegt der Kalender-Slot einer Staffel diese Adresse als deutsch? Nur ein Treffer beweist etwas, ein Fehlen nicht: Der Simulcast-Kalender
 * führt ausschließlich laufende Staffeln. Die Kennung gilt der Franchise; hat sie einen Block ohne deutsche Folge, gilt der Slot nur
 * dem Titel mit eigenem Termin (Dorohedoro S1: Slot „Season 2“, 16.10.2026).
 */
export function slotBelegt(url: string, imKalender: Map<string, CrunchyrollEntry>, serienMitNullBlock: Set<string>): boolean {
  const id = crunchyrollSeriesId(url)
  return Boolean(id && imKalender.has(id) && !serienMitNullBlock.has(id))
}

import type { Title } from '../../shared/types.ts'
import { handKennungen } from '../lib/hand-kennungen.ts'
import { ladeKatalogEintraege } from '../lib/katalog-eingefroren.ts'
import { findeTeilungen } from '../lib/mal-teilung.ts'
import { log, readJson } from '../lib/util.ts'
import { alle, ANISEARCH_ID_BASIS, anisearchUmgezogenInBestand } from './anisearch-titel.ts'

/**
 * **Teilt aniSearch ein AniList-Werk Folge für Folge auf Seiten auf, sind die Seiten das Werk und der Sammeltitel entfällt** (Daniel, 13.10.2026: Durarara!! Specials,
 * Angel Beats! Tokubetsu-hen, Pokémon XY&Z-Special; Regel und Messung in `docs/wissen/datensatz.md`). Bedingung: `findeTeilungen` (`lib/mal-teilung.ts`).
 *
 * Gilt nur, wenn eine Seite Deutsch führt; eine Teilung nur im Katalog hinter dem Schalter bleibt, bis entschieden ist, ob die Regel dort gilt.
 * Nennt eine Handdatei den Sammeltitel (Beleg, Termin, Verweis), bleibt er stehen und wird im Protokoll genannt: erst die Datei umhängen, dann fällt er weg.
 */
export type TeilungsQuellen = {
  /** Kennungen, die eine Handdatei nennt. */
  hand: Set<number>
  /** `data/anisearch-eintraege.json`. */
  eintraege: Parameters<typeof findeTeilungen>[1]
  /** Alle AniList-Titel des Katalogs; „genau ein Titel mit der MAL“ gilt auch gegen sie. */
  katalog: { id: number; malId?: number; episodes?: number | null }[]
}

/**
 * Der Katalog führt die MAL-Kennung nicht bei jedem Titel; die drei Sammeltitel von 13.10.2026 tragen sie in den eingefrorenen Stammdaten
 * (`data/stammdaten/anilist-eingefroren.json`), sonst käme der entfernte Titel hinter dem Schalter wieder an.
 */
const ausDateien = (): TeilungsQuellen => ({
  hand: handKennungen(),
  eintraege: alle(),
  katalog: ladeKatalogEintraege().map((e) => ({ id: e.id, malId: e.mal, episodes: e.folgen })),
})

export function entferneSammeltitel(
  titles: Map<number, Title>,
  jpStart: Map<number, string>,
  jpStartAnzeige: Map<number, string>,
  quellen: TeilungsQuellen = ausDateien(),
): number {
  const teilungen = findeTeilungen([...quellen.katalog, ...titles.values()], quellen.eintraege, (zeilenId) => titles.has(zeilenId))
  let entfallen = 0
  for (const [sammelId, seiten] of teilungen) {
    if (!titles.has(sammelId)) continue
    if (quellen.hand.has(sammelId)) {
      log(`MAL-Teilung: Titel ${sammelId} bleibt, eine Handdatei nennt ihn (Seiten ${seiten.join(', ')}); Beleg an die Seite umhängen oder in MAL_AUSNAHMEN begründen`)
      continue
    }
    titles.delete(sammelId)
    jpStart.delete(sammelId)
    jpStartAnzeige.delete(sammelId)
    entfallen++
  }
  if (entfallen) log(`MAL-Teilung: ${entfallen} Sammeltitel entfallen, ihre aniSearch-Seiten stehen einzeln`)
  return entfallen
}

type AlterTitel = { id: number; malId?: number; episodes?: number | null }

/** Die AniList-Titel der letzten Ausgabe (`titles.json`, Liste oder Karte). */
function alteTitel(): AlterTitel[] {
  const alt = readJson<AlterTitel[] | Record<string, AlterTitel>>('public/data/titles.json', [])
  return Array.isArray(alt) ? alt : Object.values(alt)
}

/**
 * Für den Verlust-Riegel des Baus: Sammeltitel der letzten Ausgabe, die jetzt fehlen, weil ihre Seiten sie ersetzen — aufgegangen, nicht verloren.
 * Gilt nur, wenn die Regel den Titel entfernen darf (alle Seiten stehen in der Ausgabe oder hinter dem Schalter, keine Handdatei nennt ihn).
 */
export function aufgegangeneSammeltitel(
  jetzt: Set<number>,
  hinterToggle: Set<number>,
  vorher: AlterTitel[] = alteTitel(),
  quellen: TeilungsQuellen = ausDateien(),
): number[] {
  const steht = (id: number) => jetzt.has(id) || hinterToggle.has(id)
  const teilungen = findeTeilungen([...quellen.katalog, ...vorher], quellen.eintraege, steht)
  const frueher = new Set(vorher.map((t) => t.id))
  return [...teilungen.keys()].filter((id) => frueher.has(id) && !steht(id) && !quellen.hand.has(id))
}

/** Titel, die der Verlust-Riegel nicht als Verlust zählt: die umgezogenen aniSearch-Eigenkennungen und die aufgegangenen Sammeltitel. */
export function umgezogeneKennungen(jetzt: Set<number>, hinterToggle: Set<number>, angekuendigt: Set<number>): number[] {
  return [...anisearchUmgezogenInBestand(jetzt, hinterToggle, angekuendigt), ...aufgegangeneSammeltitel(jetzt, hinterToggle)]
}

/**
 * Sammeltitel im AniList-Katalog hinter dem Schalter, die entfallen, weil ihre Seiten schon in der Ausgabe stehen: Katalogkennung → Kennung der ersten Seitenzeile.
 * Sonst käme der aus dem Hauptbestand entfernte Titel dort wieder an (ein Vorfilter verschiebt, er löscht nicht).
 */
export function katalogSammeltitel(steht: (titelId: number) => boolean, quellen: TeilungsQuellen = ausDateien()): Map<number, number> {
  const weg = new Map<number, number>()
  for (const [sammelId, seiten] of findeTeilungen(quellen.katalog, quellen.eintraege, steht)) {
    if (!quellen.hand.has(sammelId)) weg.set(sammelId, ANISEARCH_ID_BASIS + seiten[0]!)
  }
  return weg
}

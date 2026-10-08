/**
 * Invarianten an den **ausgelieferten Dateien** (`titles.json`, `ohne-synchro.json`, `cartoons.json`, `franchises.json`), die der Daten-Detektiv
 * als hart empfohlen hat (D-06, D-15; `docs/wissen/daten-detektiv.md`). Sie laufen in `schreibeKernUndNews`, wenn diese Dateien geschrieben sind.
 * Gegenprobe je Regel: `pipeline/check-invarianten.ts`.
 */
import type { Title } from '../../shared/types.ts'

/** Kennung eines Titels, der nur bei aniSearch steht: dieser Wert plus die aniSearch-Kennung (`bau/anisearch-titel.ts`). */
const ANISEARCH_ID_BASIS = 10_000_000

export interface Auslieferung {
  titles: Title[]
  ohneSynchro: Title[]
  cartoons: Title[]
  franchises: Record<string, { id: number; name: string }[]>
}

export interface SynchroQuellen {
  /** `data/anisearch-dubs.json`: AniList-Kennung → Dub-Kennzeichen (`d` vertont). */
  dubsAnilist: Record<string, string>
  /** `data/anisearch-dub-ids.json`: aniSearch-Kennung → Dub-Kennzeichen. */
  dubIds: Record<string, string>
  /** Handbelege mit `dub: true` (`data/dub-confirmed.yaml`), ohne die bewusst nicht im Bestand geführten. */
  handbelegteIds: Set<number>
  /** Titel, für die ein Handurteil „keine Synchro" vorliegt: bleiben hinter dem Toggle. */
  handKeine: Set<number>
  heute: string
  /** Weitere, schwächere Quellen (nur der Daten-Detektiv): Namen der Quellen, die für diesen Titel Synchro führen. */
  weitere?: (t: Title) => string[]
}

/**
 * Bekannt offen, bis die Ursache behoben ist (08.10.2026: der Bestandsbau brach daran ab, Scott Pilgrim Takes Off 170206:
 * aniSearch führt ihn mit „d", sein Zwilling kommt nicht in den Hauptbestand). Läuft am 15.10.2026 ab, danach wird die Regel wieder hart.
 */
const BEKANNT_OFFEN = new Set<number>([170206])
const BEKANNT_OFFEN_BIS = '2026-10-15'

/**
 * D-06: Ein Titel hinter dem Toggle („keine deutsche Synchro"), obwohl aniSearch ihn als vertont (`d`) führt oder ein Handbeleg `dub: true` sagt.
 * Ausgenommen: sein aniSearch-Zwilling steht im Hauptbestand (dann ist er umgezogen, nicht verloren), ein Handurteil „keine Synchro"
 * und ein Titel, dessen japanischer Start noch aussteht (die Ankündigung bleibt hinter dem Toggle).
 */
export function synchroHinterToggle(a: Pick<Auslieferung, 'titles' | 'ohneSynchro'>, q: SynchroQuellen): { titel: Title; quellen: string[] }[] {
  const haupt = new Set(a.titles.map((t) => t.id))
  const treffer: { titel: Title; quellen: string[] }[] = []
  for (const o of a.ohneSynchro) {
    if (haupt.has(o.id) || q.handKeine.has(o.id) || (o.jpStart && o.jpStart > q.heute)) continue
    if (BEKANNT_OFFEN.has(o.id) && q.heute <= BEKANNT_OFFEN_BIS) continue
    if (o.anisearchId && haupt.has(ANISEARCH_ID_BASIS + o.anisearchId)) continue
    const quellen = [
      q.dubsAnilist[String(o.id)] === 'd' && 'aniSearch-Dub-Liste',
      o.anisearchId && q.dubIds[String(o.anisearchId)] === 'd' && 'aniSearch-Kennung „d"',
      q.handbelegteIds.has(o.id) && 'Handbeleg dub:true',
      ...(q.weitere?.(o) ?? []),
    ].filter((x): x is string => !!x)
    if (quellen.length) treffer.push({ titel: o, quellen })
  }
  return treffer
}

export const synchroNichtHinterToggle = (a: Pick<Auslieferung, 'titles' | 'ohneSynchro'>, q: SynchroQuellen): string[] =>
  synchroHinterToggle(a, q).map(({ titel, quellen }) => `Titel ${titel.id} (${titel.titleRomaji}): hinter dem Toggle, aber ${quellen.join(' und ')}`)

/** D-15: Reihen-Verweise zeigen ins Leere — ein Glied ohne Titel, oder ein Titel einer mehrgliedrigen Reihe, die in `franchises.json` fehlt. */
export function reihenVerweiseAufgeloest(a: Auslieferung): string[] {
  const bekannt = new Set([...a.titles, ...a.ohneSynchro, ...a.cartoons].map((t) => t.id))
  const glieder = new Map<number, number>()
  for (const t of a.titles) if (t.franchiseId != null) glieder.set(t.franchiseId, (glieder.get(t.franchiseId) ?? 0) + 1)
  const fehler: string[] = []
  for (const t of a.titles) {
    if (t.franchiseId != null && (glieder.get(t.franchiseId) ?? 0) > 1 && !a.franchises[String(t.franchiseId)]) fehler.push(`Titel ${t.id}: Reihe ${t.franchiseId} (${glieder.get(t.franchiseId)} Titel) fehlt in franchises.json`)
  }
  for (const [reihe, liste] of Object.entries(a.franchises))
    for (const g of liste) if (!bekannt.has(g.id)) fehler.push(`Reihe ${reihe}: Glied "${g.name}" [${g.id}] ist kein bekannter Titel`)
  return fehler
}

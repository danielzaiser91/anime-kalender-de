import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { ROOT, log, readJson, warn, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import type { KatalogEintrag } from '../lib/anilist.ts'
import { fuehreReihenZusammen } from './03-reihen.ts'
import { alle } from './anisearch-titel.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import { type Ausgeschieden, anisearchKatalogReihen, katalogAnker, ladeBeziehungen } from './anisearch-reihen-pruefliste.ts'
import { type ReinErgebnis, type ReinHand, type ReinTitel, bestandReihenAusAnisearch, katalogReihenAusAnisearch, reineReihen } from './anisearch-reihen-rein.ts'

/**
 * **Anbindung von `REIHEN_QUELLE=anisearch` an den Bau** (Schritt 6 der AniList-Ablösung, 12.10.2026). Hauptbestand und Katalog laufen rein (Rückweg `REIHEN_QUELLE=anilist`); wo der Weg aus ist, rufen die Eintrittspunkte den AniList-Weg.
 * Mit ihm kommen `franchiseId` des Hauptbestands und die Reihen des Katalogs allein aus aniSearch (Regeln in `anisearch-reihen-rein.ts`); `data/reihen-von-hand.yaml` gilt weiter.
 * Die Prüfliste dieses Wegs steht in einer eigenen Datei, damit der Standardweg seine nicht verliert.
 */
export const REIN_PRUEFLISTE_DATEI = 'data/anisearch-reihen-rein-pruefliste.json'

/** `ids:`, `reinIds:` und `getrennt:` der Handdatei; `reinIds:` verbindet wie `ids:`, wird aber nur hier gelesen (der Standardweg kennt diese Teile schon als eine Reihe). */
export function ladeHand(datei = `${ROOT}/data/reihen-von-hand.yaml`): ReinHand {
  const eintraege = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as Array<{ ids?: number[]; reinIds?: number[]; getrennt?: number[] }> | null) ?? []) : []
  return {
    verbinden: eintraege.flatMap((e) => [e.ids, e.reinIds].filter((l): l is number[] => !!l)),
    trennen: eintraege.flatMap((e) => (e.getrennt ? [e.getrennt] : [])),
  }
}

/** Schreibt den Teil `teil` der Prüfliste; der andere bleibt stehen, geschrieben wird nur bei Änderung. */
function schreibePruefliste(teil: 'bestand' | 'katalog', e: ReinErgebnis): void {
  const alt = readJson<Record<string, unknown>>(REIN_PRUEFLISTE_DATEI, {})
  const neu = { ...alt, stand: todayIso(), [teil]: { inReihen: e.inReihen, reihen: e.reihen, pruefliste: e.pruefliste } }
  if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...neu, stand: '' })) writeJson(REIN_PRUEFLISTE_DATEI, neu, true)
}

/** Die MAL-Kennung eines Titels (sein Feld) und die im aniSearch-Eintrag; die zweite gilt nur als Ersatz und verbindet nur mit Beleg (`malVerbindungen`). */
const malVon = (mal: number | undefined, anisearchId: number | undefined): { mal?: number; malAnisearch?: number } => ({ mal, malAnisearch: anisearchId ? alle()[String(anisearchId)]?.mal : undefined })

/** Hauptbestand: `franchiseId` aus aniSearch für jeden Titel (Titel ohne archivierte Seite stehen allein). */
function reinBestandReihen(titles: Map<number, Title>): void {
  const kennung = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
  const titel: ReinTitel[] = [...titles.values()].map((t) => ({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anisearchId: kennung.get(t.id), ...malVon(t.malId, kennung.get(t.id)) }))
  const { kanten, namen } = ladeBeziehungen()
  const e = reineReihen(titel, kanten, namen, ladeHand())
  for (const t of titles.values()) t.franchiseId = e.reihe.get(t.id) ?? t.id
  schreibePruefliste('bestand', e)
  log(`aniSearch-Reihen (rein): ${e.reihen} Reihen mit ${e.inReihen} Titeln, ${e.pruefliste.length} Fälle auf der Prüfliste (${REIN_PRUEFLISTE_DATEI})`)
}

type ReihenArgs = Parameters<typeof fuehreReihenZusammen>[0]

/**
 * `fuehreReihenZusammen`, mit dem Schalter aber ohne AniList-Beziehungen (leere Medienlisten) und danach `franchiseId` aus aniSearch.
 * Ein Fehler stoppt den Bau nie: dann bleibt es bei den Reihen ohne AniList-Kanten, und die Warnung nennt den Grund.
 */
export function fuehreReihenZusammenQuelle(args: ReihenArgs): ReturnType<typeof fuehreReihenZusammen> {
  if (!bestandReihenAusAnisearch()) return fuehreReihenZusammen(args)
  const ergebnis = fuehreReihenZusammen({ ...args, byAniId: {}, byMal: {} })
  try {
    reinBestandReihen(args.titles)
  } catch (e) {
    warn(`aniSearch-Reihen (rein) übersprungen (Fehler): ${(e as Error).message}`)
  }
  return ergebnis
}

/**
 * AniList-Kanten, die aniSearch nicht ersetzen kann: jede Kante, an der ein Titel ohne aniSearch-Kennung hängt. Ein Crossover (zwei Eltern) verbindet auch hier nichts, weder von sich aus noch als Ziel.
 * Gemessen 13.10.2026: 3.044 Katalogtitel ohne Kennung, davon 1.286 in einer Reihe mit mehreren Titeln; ohne diese Kanten stünden 1.273 allein.
 */
export function anilistKantenOhneKennung(eintraege: KatalogEintrag[], mitKennung: Set<number>): [number, number][] {
  const crossover = new Set(eintraege.filter((e) => (e.eltern?.length ?? 0) >= 2).map((e) => e.id))
  const ohne = (id: number): boolean => !mitKennung.has(id)
  return eintraege.flatMap((e) => (crossover.has(e.id) ? [] : (e.rel ?? []).filter((o) => !crossover.has(o) && (ohne(e.id) || ohne(o))).map((o): [number, number] => [e.id, o])))
}

/** Katalog: Reihe je Eintrag aus aniSearch; der ausgelieferte Hauptbestand (Anker) behält seine Reihe, zwei feste Reihen verschmelzen nie. */
function reinKatalogReihen(eintraege: KatalogEintrag[], kennung: Map<number, number>, anker: ReturnType<typeof katalogAnker>): Map<number, number> {
  const fest = new Map(anker.map((a) => [a.id, a.reihe]))
  const titel: ReinTitel[] = [
    ...anker.map((a) => ({ id: a.id, name: a.name, anisearchId: a.anisearchId, ...malVon(a.mal, a.anisearchId) })),
    ...eintraege.filter((e) => !fest.has(e.id)).map((e) => ({ id: e.id, name: e.t[0] ?? e.t[1] ?? `#${e.id}`, anisearchId: kennung.get(e.id), ...malVon(e.mal, kennung.get(e.id)) })),
  ]
  const { kanten, namen } = ladeBeziehungen()
  const kantenOhne = anilistKantenOhneKennung(eintraege, new Set(titel.filter((t) => t.anisearchId).map((t) => t.id)))
  const e = reineReihen(titel, kanten, namen, ladeHand(), fest, kantenOhne)
  schreibePruefliste('katalog', e)
  log(`aniSearch-Reihen im Katalog (rein): ${e.reihen} Reihen mit ${e.inReihen} Titeln (mit Hauptbestand), ${e.pruefliste.length} Fälle auf der Prüfliste`)
  return e.reihe
}

/** `anisearchKatalogReihen` mit dem Schalter; gleiche Parameter, damit `nebendateien.ts` nur den Namen wechselt. */
export function anisearchKatalogReihenQuelle(reihe: Map<number, number>, eintraege: KatalogEintrag[], bekannt: Map<number, number>, verschoben: Title[], kennung: Map<number, number>, weg: Ausgeschieden): Map<number, number> {
  if (!katalogReihenAusAnisearch()) return anisearchKatalogReihen(reihe, eintraege, bekannt, verschoben, kennung, weg)
  try {
    const anker = katalogAnker(eintraege, bekannt, verschoben, kennung, weg)
    return reinKatalogReihen(eintraege.filter((e) => !weg.katalogWeg.has(e.id)), kennung, anker)
  } catch (e) {
    warn(`aniSearch-Reihen im Katalog (rein) übersprungen (Fehler): ${(e as Error).message}`)
    return reihe
  }
}

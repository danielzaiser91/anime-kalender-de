import { log, readJson, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { anisearchHand } from './grundlagen.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'

/**
 * **Welche aniSearch-Titelseite gehört zu welchem Titel** — die einzige Stelle, an der der Bau eine Kennung zuordnet (die Oberfläche zeigt nie eine Suche,
 * ohne Kennung gar keinen aniSearch-Weg; Daniel, 09.10.2026). Reihenfolge: Handdatei, Abruf-Ergebnis (`anisearch.json`, `anisearch-titel.json`), die Kennung
 * eines reinen aniSearch-Titels, zuletzt aniSearchs eigene MAL-Brücke (`anisearch-mal.json`, `fetch-anisearch-zuordnung.ts`). Nie ein Namensabgleich.
 */
type Kennungen = Record<string, { anisearchId?: number }>

let fest: Map<number, number> | undefined
function festeKennungen(): Map<number, number> {
  if (fest) return fest
  const m = new Map<number, number>()
  for (const quelle of ['data/anisearch-titel.json', 'data/anisearch.json']) {
    for (const [id, e] of Object.entries(readJson<Kennungen>(quelle, {}))) if (e.anisearchId) m.set(Number(id), e.anisearchId)
  }
  for (const [id, asId] of Object.entries(anisearchHand)) m.set(Number(id), asId)
  return (fest = m)
}

/** Ist die MAL-Kennung eindeutig, die aniSearch-Kennung noch frei und unter den Anwärtern einmalig, gilt sie; sonst bleibt der Titel auf der Liste. */
export function loeseKennungen(titel: { id: number; mal?: number }[], festeIds: Map<number, number>, malZuAnisearch: Record<string, number>): Map<number, number> {
  const raus = new Map<number, number>()
  const vergeben = new Set(festeIds.values())
  const anwaerter = new Map<number, number[]>()
  for (const t of titel) {
    const f = festeIds.get(t.id) ?? (t.id >= ANISEARCH_ID_BASIS ? t.id - ANISEARCH_ID_BASIS : undefined)
    if (f !== undefined) {
      raus.set(t.id, f)
      continue
    }
    const x = t.mal ? malZuAnisearch[String(t.mal)] : undefined
    if (x !== undefined && !vergeben.has(x)) anwaerter.set(x, [...(anwaerter.get(x) ?? []), t.id])
  }
  for (const [x, ids] of anwaerter) if (ids.length === 1) raus.set(ids[0]!, x)
  return raus
}

export const anisearchKennungen = (titel: { id: number; mal?: number }[]): Map<number, number> =>
  loeseKennungen(titel, festeKennungen(), readJson<Record<string, number>>('data/anisearch-mal.json', {}))

/**
 * **Die Liste aller Titel ohne aniSearch-Direktlink** (`data/anisearch-offen.json`). Sie schrumpft, sobald die Brücke eine Kennung liefert; geschrieben wird nur bei
 * Änderung, damit der Stand nicht täglich committet. Cartoons gehören nicht dazu (ihr Weg führt zu TMDB).
 */
export function schreibeAnisearchOffen(hauptbestand: Title[]): void {
  const imHaupt = new Set(hauptbestand.map((t) => t.id))
  const titel = [...hauptbestand, ...readJson<Title[]>('public/data/ohne-synchro.json', []).filter((t) => !imHaupt.has(t.id))]
  const offen = titel
    .filter((t) => !t.anisearchId)
    .sort((a, b) => a.id - b.id)
    .map((t) => ({
      id: t.id,
      ...(t.malId ? { malId: t.malId } : {}),
      titleRomaji: t.titleRomaji,
      ...(t.titleEn ? { titleEn: t.titleEn } : {}),
      ...(t.titleDe ? { titleDe: t.titleDe } : {}),
      ...(t.jpYear ? { jpYear: t.jpYear } : {}),
      grund: t.malId ? ('mal-ohne-eindeutige-zuordnung' as const) : ('ohne-mal' as const),
    }))
  const alt = readJson<{ titel?: unknown }>('data/anisearch-offen.json', {})
  if (JSON.stringify(alt.titel) !== JSON.stringify(offen)) {
    writeJson('data/anisearch-offen.json', { stand: todayIso(), anzahl: offen.length, ohneMal: offen.filter((o) => o.grund === 'ohne-mal').length, titel: offen })
  }
  log(`${offen.length} von ${titel.length} Titeln ohne aniSearch-Direktlink (${offen.filter((o) => o.grund === 'ohne-mal').length} ohne MAL-Kennung) — Liste: data/anisearch-offen.json`)
}

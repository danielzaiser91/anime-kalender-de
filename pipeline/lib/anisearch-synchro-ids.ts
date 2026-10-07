import { readJson } from './util.ts'

/**
 * **Titel, die aniSearch mit deutscher Vertonung führt, kommen in den Hauptbestand** (Daniel, 07.10.2026: „wir nehmen alle Kennungen
 * von aniSearch"). Der Hauptbestand entstand aus MyDubList; was dort fehlte, lag hinter dem Toggle — auch Ranma ½ (1989), dessen
 * erste 30 Folgen synchronisiert wurden (aniSearch: Dub abgebrochen, Kennzeichen `c`), und Persona-5-Specials (Kennzeichen `d`).
 *
 * Gelesen wird `data/anisearch-dubs.json` (Titel-Kennung → `d`/`p`/`c`/`-`, geschrieben von `fetch-anisearch-dubs.ts`). Zurück
 * kommen die Kennungen mit Deutsch vertont, geplant oder abgebrochen, die nicht schon über MAL im Bestand sind.
 */
export function ausAnisearchDubs(imBestand: { id: number }[]): number[] {
  const bekannt = new Set(imBestand.map((m) => m.id))
  const dubs = readJson<Record<string, string>>('data/anisearch-dubs.json', {})
  return Object.entries(dubs)
    .filter(([id, kennzeichen]) => 'dpc'.includes(kennzeichen) && !bekannt.has(Number(id)))
    .map(([id]) => Number(id))
}

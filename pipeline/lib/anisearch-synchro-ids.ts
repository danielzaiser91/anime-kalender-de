import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson, ROOT } from './util.ts'

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

/**
 * **Der AniList-Titel eines aniSearch-Eintrags, den die Handdatei bindet (`data/anisearch-ids-hand.yaml`), gehört in den Bestand** — auch ohne Deutsch
 * (`-`), das `ausAnisearchDubs` nicht holt. Sonst fände der Bau den Titel nicht, an den er die Meldungen und Termine des aufgegangenen aniSearch-Titels
 * hängen muss (Dubletten, `docs/wissen/datensatz.md`, 08.10.2026). Zurück kommen nur Kennungen, zu denen es einen aniSearch-Eintrag gibt.
 */
export function ausAnisearchHand(imBestand: { id: number }[]): number[] {
  const bekannt = new Set(imBestand.map((m) => m.id))
  const eintraege = readJson<Record<string, unknown>>('data/anisearch-eintraege.json', {})
  const hand = readFileSync(resolve(ROOT, 'data/anisearch-ids-hand.yaml'), 'utf8')
  return [...hand.matchAll(/^(\d+):\s*(\d+)/gm)].filter(([, anilist, anisearch]) => anisearch! in eintraege && !bekannt.has(Number(anilist))).map(([, anilist]) => Number(anilist))
}

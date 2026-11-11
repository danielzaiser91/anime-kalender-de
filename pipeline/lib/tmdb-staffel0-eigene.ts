import { readJson, writeJson } from './util.ts'
import { STAFFEL0_DATEI, type Staffel0Bestand } from './tmdb-staffel0-abruf.ts'

type Zuordnung = Record<string, { tmdbId?: number } | null | undefined>

/**
 * Ein Titel hat genau eine TMDB-Zuordnung: Trägt er eine eigene Kennung (Serie oder Film in `data/tmdb-titles.json`), fällt sein Eintrag in der
 * Staffel 0 weg. Plakat und Hintergrund bleiben stehen: Sie sind sein Cover, bis der Plakat-Lauf ihn über die eigene Kennung neu holt; ein Streichen
 * ließe ihn bis dahin ohne TMDB-Bild (Ratsche `check:cover-vorschau-bestand`). Gibt die gestrichenen Kennungen zurück.
 */
export function streicheStaffel0MitKennung(zuordnung: Zuordnung, eintraege: Staffel0Bestand): string[] {
  const gestrichen = Object.keys(eintraege).filter((id) => zuordnung[id]?.tmdbId)
  for (const id of gestrichen) delete eintraege[id]
  return gestrichen
}

/** Wie `streicheStaffel0MitKennung`, aber über die Datei; schreibt nur, wenn etwas wegfällt. */
export function raeumeStaffel0Auf(zuordnung: Zuordnung): string[] {
  const eintraege = readJson<Staffel0Bestand>(STAFFEL0_DATEI, {})
  const gestrichen = streicheStaffel0MitKennung(zuordnung, eintraege)
  if (gestrichen.length) writeJson(STAFFEL0_DATEI, eintraege)
  return gestrichen
}

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'

/** „voraussichtlich" samt Beugung („Voraussichtlicher Termin") und das Kürzel „vsl." — mit Wortgrenze davor. */
const VORAUSSICHTLICH = /(?<![\p{L}])(?:voraussichtlich|vsl\.)/iu

/**
 * Slugs der Einträge einer kuratierten Datei, deren `note` „voraussichtlich" nennt, deren Termin aber kein
 * `schedule.estimated: true` trägt. Kommentare werden bewusst nicht gelesen: Ein Kommentar über einem Eintrag
 * kann das Wort auch verneinen („ohne „voraussichtlich"") oder zu einem anderen Eintrag der Gruppe gehören.
 */
export function findeVoraussichtlichOhneSchaetzung(text: string): string[] {
  const liste = yaml.load(text)
  if (!Array.isArray(liste)) return []
  const slugs: string[] = []
  for (const e of liste as { slug?: string; note?: string; schedule?: { estimated?: boolean } }[]) {
    if (!e?.slug || !e.schedule || e.schedule.estimated === true) continue
    if (VORAUSSICHTLICH.test(e.note ?? '')) slugs.push(e.slug)
  }
  return slugs
}

/** Alle Treffer in `data/curated/*.yaml` als „Datei: Slug". */
export function findeVoraussichtlichImBestand(ordner: string): string[] {
  return readdirSync(ordner)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .flatMap((f) => findeVoraussichtlichOhneSchaetzung(readFileSync(resolve(ordner, f), 'utf8')).map((s) => `${f}: ${s}`))
}

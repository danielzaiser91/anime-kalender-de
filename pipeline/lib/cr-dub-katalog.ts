/**
 * **Serien, deren Tonspurliste Deutsch führt** — aus dem deutschen Crunchyroll-Katalog (29.09.2026).
 *
 * Eigenes Modul, weil `crunchyroll-dub.ts` über der Dateigrenze liegt.
 *
 * **Anlass.** „Dragon Ball Z: Resurrection 'F'" (AniList 20778) stand als „kein Deutsch" im
 * Datensatz: Unsere Auswertung sah nur die Staffel `GMSE00002920JAJP` — die **japanische**
 * Tonspur-Staffel — und dort keine deutsche Folge. Die deutsche Fassung liegt in einer anderen
 * Staffel derselben Serie, und der deutsche Katalog nennt sie auf **Serienebene**:
 * `"audio": ["ja-JP","de-DE"]`. Daniel hat es am 29.09.2026 im Kasten bestätigt (alle 13 Folgen
 * deutscher Ton).
 *
 * Dieses eine falsche Nein hielt seit dem 27.09.2026 **jeden** Bestandslauf davon ab, seine
 * Erzeugnisse zu committen (`check:quellen` → „FALSCH NEGATIV", `check:bestand` → „Erzeugnisse
 * werden nicht übernommen") — samt der MAL-Kennungen.
 *
 * Die Liste wird **einmal** gelesen und gemerkt: Der Bau beurteilt tausende Serien, der Katalog
 * ändert sich währenddessen nicht.
 */
import { readJson } from './util.ts'

let gemerkt: Set<string> | undefined

export function serienMitDeutsch(pfad = 'data/cr-katalog-de.json'): Set<string> {
  if (gemerkt) return gemerkt
  const katalog = readJson<{ id: string; audio?: string[] }[] | { eintraege?: { id: string; audio?: string[] }[] }>(
    pfad,
    [],
  )
  const liste = Array.isArray(katalog) ? katalog : (katalog.eintraege ?? [])
  gemerkt = new Set(liste.filter((e) => (e.audio ?? []).includes('de-DE')).map((e) => e.id))
  return gemerkt
}

/** Nur für Prüfungen: den gemerkten Katalog vergessen. */
export function vergissKatalog(): void {
  gemerkt = undefined
}

/**
 * Ordnet die Serien von `data/adn-catalog.json` aniSearch-Einträgen zu (`lib/adn-anisearch.ts`) und schreibt die Liste der offenen nach
 * `data/adn-anisearch-offen.json`. Liest nur die Titelliste aus dem Cache (`data/cache/anisearch-titelliste.json`); abgerufen wird sie
 * höchstens, wenn sie älter als `TITELLISTE_MAX_TAGE` ist und ein Token da ist (Limit 1 Abruf je Stunde, nur die API, nie Seiten).
 */
import { log, readJson, warn, writeJson } from './util.ts'
import { anisearchToken } from './anisearch-api.ts'
import { ladeTitelliste, TITELLISTE, zeileZuTitel, type AbrufGrenzen, type Zwischenspeicher } from '../fetch-anisearch-katalog-abgleich.ts'
import { wortIndex, type AsTitel } from './anisearch-katalog-abgleich.ts'
import { ordneAdnZuAnisearch, titellisteFrisch, type AdnOffen } from './adn-anisearch.ts'
import type { AdnShow } from './adn.ts'

const OFFEN_DATEI = 'data/adn-anisearch-offen.json'
/** Ein Versuch, kurze Frist: das Limit (1 Abruf je Stunde) teilen sich alle Jobs, ein Warten auf Retry-After ließe den 45-Minuten-Schritt hängen. */
export const ABRUF_GRENZEN: AbrufGrenzen = { versuche: 1, frist: 120_000 }

/** Titelliste aus dem Cache; veraltet und mit Token: neu holen; sonst die alte (besser alte Namen als keine). */
export async function holeTitelliste(zwischen: Zwischenspeicher, token: string | undefined): Promise<Map<number, AsTitel> | undefined> {
  if (token && !titellisteFrisch(zwischen.geholtAm, Date.now())) {
    try {
      return await ladeTitelliste(token, ABRUF_GRENZEN, zwischen)
    } catch (err) {
      warn(`ADN-Zuordnung: Titelliste nicht abrufbar (${(err as Error).message}) — der Zwischenspeicher gilt`)
    }
  }
  if (!zwischen.titel) return undefined
  return new Map(Object.entries(zwischen.titel).map(([id, z]) => [Number(id), zeileZuTitel(id, z)]))
}

/** Die offene Liste nur schreiben, wenn sich ihr Inhalt ändert (kein Datum darin, sonst entsteht täglich ein Commit). */
function schreibeOffen(offen: AdnOffen[]): void {
  const alt = readJson<{ serien?: unknown }>(OFFEN_DATEI, {})
  if (JSON.stringify(alt.serien) === JSON.stringify(offen)) return
  writeJson(OFFEN_DATEI, { anzahl: offen.length, serien: offen }, true)
}

/**
 * Setzt `anisearchId` an die Serien. Ohne Titelliste bleibt, was `bisher` (Katalog der Vorwoche) schon hatte: ein Lauf ohne Cache darf
 * keine Zuordnung löschen.
 */
export async function ordneKatalogZuAnisearch(shows: AdnShow[], bisher: AdnShow[]): Promise<void> {
  const titel = await holeTitelliste(readJson<Zwischenspeicher>(TITELLISTE, {}), anisearchToken())
  if (!titel) {
    warn('ADN-Zuordnung: keine aniSearch-Titelliste — die bisherigen Zuordnungen bleiben stehen.')
    for (const s of shows) s.anisearchId = bisher.find((b) => b.showId === s.showId)?.anisearchId
    return
  }
  const { zuordnung, offen } = ordneAdnZuAnisearch(shows, titel, wortIndex([...titel.values()]))
  for (const s of shows) s.anisearchId = zuordnung.get(s.showId)
  schreibeOffen(offen)
  const grund = (g: string) => offen.filter((o) => o.grund === g).length
  log(`ADN-Katalog: ${zuordnung.size} von ${shows.length} einem aniSearch-Eintrag zugeordnet; offen: ${grund('kein-kandidat')} ohne Kandidat, ${grund('mehrdeutig')} mehrdeutig, ${grund('vergeben')} vergeben (${OFFEN_DATEI})`)
}

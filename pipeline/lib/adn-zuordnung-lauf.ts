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
function schreibeOffen(offen: AdnOffen[], datei: string): void {
  const alt = readJson<{ serien?: unknown }>(datei, {})
  if (JSON.stringify(alt.serien) === JSON.stringify(offen)) return
  writeJson(datei, { anzahl: offen.length, serien: offen }, true)
}

/**
 * Ohne Titelliste bleibt, was `bisher` (Katalog der Vorwoche) schon hatte: ein Lauf ohne Cache darf keine Zuordnung löschen. Eine Serie,
 * die danach keine Kennung hat und nicht in der Liste der offenen steht (neu im Katalog), kommt mit Grund `titelliste-fehlt` hinein,
 * statt stumm durchzufallen; der nächste Lauf mit Titelliste rechnet die Liste neu.
 */
export function uebernimmOhneTitelliste(shows: AdnShow[], bisher: AdnShow[], offenAlt: AdnOffen[]): AdnOffen[] {
  for (const s of shows) s.anisearchId = bisher.find((b) => b.showId === s.showId)?.anisearchId
  const ohne = shows.filter((s) => !s.anisearchId)
  const bekannt = new Set(offenAlt.map((o) => o.showId))
  const neue: AdnOffen[] = ohne
    .filter((s) => !bekannt.has(s.showId))
    .map((s) => ({ showId: s.showId, title: s.title, originalTitle: s.originalTitle, grund: 'titelliste-fehlt', kandidaten: [] }))
  const ohneIds = new Set(ohne.map((s) => s.showId))
  return [...offenAlt.filter((o) => ohneIds.has(o.showId)), ...neue].sort((x, y) => x.showId - y.showId)
}

/** Setzt `anisearchId` an die Serien und schreibt die Liste der offenen. `titelliste` und `offenDatei` sind für den Test austauschbar. */
export async function ordneKatalogZuAnisearch(
  shows: AdnShow[],
  bisher: AdnShow[],
  { titelliste = () => holeTitelliste(readJson<Zwischenspeicher>(TITELLISTE, {}), anisearchToken()), offenDatei = OFFEN_DATEI } = {},
): Promise<void> {
  const titel = await titelliste()
  if (!titel) {
    warn('ADN-Zuordnung: keine aniSearch-Titelliste — die bisherigen Zuordnungen bleiben stehen, neue Serien stehen als offen (titelliste-fehlt).')
    const alt = readJson<{ serien?: AdnOffen[] }>(offenDatei, {}).serien ?? []
    schreibeOffen(uebernimmOhneTitelliste(shows, bisher, alt), offenDatei)
    return
  }
  const { zuordnung, offen } = ordneAdnZuAnisearch(shows, titel, wortIndex([...titel.values()]))
  for (const s of shows) s.anisearchId = zuordnung.get(s.showId)
  schreibeOffen(offen, offenDatei)
  const grund = (g: string) => offen.filter((o) => o.grund === g).length
  log(`ADN-Katalog: ${zuordnung.size} von ${shows.length} einem aniSearch-Eintrag zugeordnet; offen: ${grund('kein-kandidat')} ohne Kandidat, ${grund('mehrdeutig')} mehrdeutig, ${grund('vergeben')} vergeben (${offenDatei})`)
}

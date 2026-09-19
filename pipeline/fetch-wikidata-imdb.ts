/**
 * **IMDb-Kennungen über Wikidata, nicht über IMDb** (19.09.2026).
 *
 * Anlass: Grisaia Stargazer und Fushigi Yugi OVA — um zu entscheiden, welche Prime-Staffel
 * welches Werk ist, sah Daniel bei aniSearch, MAL und IMDb nach. IMDb verbietet automatisches
 * Auslesen (`imdb.com/robots.txt`, Kopf: „Use of any device, tool, or process designed to data
 * mine or scrape the content using automated means is prohibited without prior written
 * permission from IMDb.“). Verlinkt werden darf trotzdem, und die Kennung dafür führt Wikidata
 * frei (CC0): P4086 ist die MAL-Kennung, P345 die IMDb-Kennung. Unsere Titel tragen `malId`
 * aus AniList — damit ist der Weg MAL → IMDb eine einzige SPARQL-Abfrage.
 *
 * Gemessen 19.09.2026: 4.764 Paare bei Wikidata, 1.627 unserer 2.772 Titel mit `malId` bekommen
 * so eine IMDb-Kennung. Stichproben stimmen (Cowboy Bebop tt0213338, Naruto tt0409591,
 * Fullmetal Alchemist: Brotherhood tt1355642, Steins;Gate tt1910272). Nennt Wikidata zu einer
 * MAL-Kennung mehrere IMDb-Kennungen (12 Fälle), bleibt sie weg — raten wäre schlimmer.
 *
 * Wöchentlich. Ergebnis: `data/imdb-ids.json` — MAL-Kennung → IMDb-Kennung.
 */
import { writeJson, log, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const ZIEL = 'data/imdb-ids.json'
const ABFRAGE = 'SELECT ?mal ?imdb WHERE { ?item wdt:P4086 ?mal ; wdt:P345 ?imdb . }'

type Bindung = { mal: { value: string }; imdb: { value: string } }

async function main(): Promise<void> {
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(ABFRAGE)
  const antwort = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      /* Wikidata verlangt einen erkennbaren User-Agent mit Kontakt. */
      'User-Agent': 'anime-kalender-de/1.0 (https://anime-kalender.de; wöchentlich)',
    },
  })
  if (!antwort.ok) throw new Error(`Wikidata antwortet ${antwort.status}`)
  const daten = (await antwort.json()) as { results: { bindings: Bindung[] } }
  const je = new Map<string, Set<string>>()
  for (const b of daten.results.bindings) {
    const mal = b.mal.value.trim()
    const imdb = b.imdb.value.trim()
    if (!/^\d+$/.test(mal) || !/^tt\d+$/.test(imdb)) continue
    if (!je.has(mal)) je.set(mal, new Set())
    je.get(mal)!.add(imdb)
  }
  const ergebnis: Record<string, string> = {}
  let mehrdeutig = 0
  for (const [mal, imdb] of [...je].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (imdb.size === 1) ergebnis[mal] = [...imdb][0]!
    else mehrdeutig++
  }
  const zahl = Object.keys(ergebnis).length
  /* Ein unplausibler Lauf schreibt nicht: Wikidata kennt seit Jahren mehrere Tausend Paare. */
  if (zahl < 2000) throw new Error(`nur ${zahl} Paare — Lauf verworfen`)
  writeJson(ZIEL, ergebnis)
  log(`${zahl} MAL→IMDb-Paare geschrieben, ${mehrdeutig} mehrdeutige ausgelassen`)
  recordSource('wikidata-imdb', zahl)
}

main().catch((err) => {
  warn(`Wikidata-IMDb: ${err instanceof Error ? err.message : String(err)}`)
  recordSource('wikidata-imdb', 0, err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})

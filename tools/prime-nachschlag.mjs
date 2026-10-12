import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/*
  **Nachschlagen: MAL und IMDb je Auftrag** (Daniel, 19.09.2026, Entwurf B). Die MAL-Kennung
  steht am Titel, die IMDb-Kennung kommt über Wikidata (`data/imdb-ids.json`). Der Kasten
  zeigt daraus die Zeile „Nachschlagen: MAL IMDb“ — für Staffel- und Teilfragen wie Grisaia
  Stargazer oder Fushigi Yugi OVA. (Aus `extension-offene-amazon.mjs` herausgelöst, 11.10.2026.)
*/
export function nachschlagVon(wurzel) {
  let imdbIds = {}
  try {
    imdbIds = JSON.parse(readFileSync(resolve(wurzel, 'data/imdb-ids.json'), 'utf8'))
  } catch {
    /* Ohne Wikidata-Zuordnung bleibt es bei der MAL-Kennung. */
  }
  return (t) => {
    if (!t?.malId) return {}
    const imdb = imdbIds[String(t.malId)]
    return { malId: t.malId, ...(imdb ? { imdb } : {}) }
  }
}

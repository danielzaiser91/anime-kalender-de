/**
 * Die aniSearch-Kennung (`asId`) der Prüfliste der Erweiterung stimmt mit dem Titel überein.
 *
 * Anlass (16.10.2026): Die Prüfliste las die Kennung aus `data/anisearch.json` (Schlüssel: AniList-Kennung) und verlor so jeden
 * Titel, der aus aniSearch selbst stammt (id = 10.000.000 + Kennung): der Verweis führte auf die Suche statt auf die Titelseite.
 * Die Kennung steht im Titel (`titles.json`, `anisearchId`); hier werden die erzeugten Listen damit verglichen.
 * Verglichen werden Paare (Eintrag, Titel); eine Liste ohne ein einziges Paar ist ein Fehler, keine Entwarnung.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const quelle = (wurzel, datei) => readFileSync(resolve(wurzel, datei), 'utf8')

/** Einträge `[name, titelId, asId]`, : Paare mit bekanntem Titel und die mit abweichender Kennung; ein unbekannter Titel darf keine tragen. */
export function abweichungen(eintraege, titel) {
  const schlecht = []
  let paare = 0
  for (const [name, id, asId] of eintraege) {
    const t = titel.get(id)
    if (!t) {
      /* Cartoon oder sonst unbekannter Titel: keine aniSearch-Kennung; eine Zahl (auch negativ) ergäbe einen falschen Verweis. */
      if (asId != null) schlecht.push(`${name} (Titel ${id} unbekannt: Liste ${asId}, erwartet null)`)
      continue
    }
    paare++
    if ((asId ?? null) !== (t.anisearchId ?? null)) schlecht.push(`${name} (Titel ${t.id}: Liste ${asId ?? 'null'}, Titel ${t.anisearchId ?? 'null'})`)
  }
  return { paare, schlecht }
}

/** Das Ergebnis einer Liste als Fehlerzeilen: Abweichungen, und kein einziges verglichenes Paar. */
function urteil(liste, { paare, schlecht }) {
  const fehler = []
  if (schlecht.length) fehler.push(`${liste}: asId weicht vom Titel ab: ${schlecht.slice(0, 5).join('; ')}`)
  if (paare === 0) fehler.push(`${liste}: kein einziges Paar verglichen (Liste leer oder ohne Titel)`)
  return fehler
}

/** Die bekannten Titel: der Hauptbestand und, was hinter dem Schalter „ohne Synchro“ liegt (`ohne-synchro.json`, fehlt es, bleibt es leer). */
function bekannteTitel(wurzel, hauptbestand) {
  const hinterSchalter = existsSync(resolve(wurzel, 'public/data/ohne-synchro.json')) ? JSON.parse(quelle(wurzel, 'public/data/ohne-synchro.json')) : []
  return new Map([...hinterSchalter, ...hauptbestand].map((t) => [t.id, t]))
}

/** Prüft `public/data/prime-suche.json` und `extension/offene-netflix.js` unter `wurzel`; liefert die Fehlerzeilen. */
export function pruefeAsId(wurzel) {
  const dateien = ['public/data/titles.json', 'public/data/prime-suche.json', 'extension/offene-netflix.js']
  const fehlt = dateien.filter((d) => !existsSync(resolve(wurzel, d)))
  if (fehlt.length) return fehlt.map((d) => `${d} fehlt`)
  const titel = bekannteTitel(wurzel, JSON.parse(quelle(wurzel, dateien[0])))

  const prime = Object.entries(JSON.parse(quelle(wurzel, dateien[1])))
  const primeErgebnis = abweichungen(prime.map(([url, e]) => [url, e.id, e.asId]), titel)

  /* Netflix-Liste: Schlüssel ist die Anbieter-Adresse, `asTitel` der Titel hinter `asId` (bei mehreren Staffeln der erste). */
  const netflix = JSON.parse(quelle(wurzel, dateien[2]).replace(/^[^{]*=\s*/, ''))
  const netflixErgebnis = abweichungen(Object.entries(netflix).map(([k, e]) => [k, e.asTitel, e.asId]), titel)

  return [...urteil('Prime-Suchtreffer', primeErgebnis), ...urteil('Netflix-Liste', netflixErgebnis)]
}

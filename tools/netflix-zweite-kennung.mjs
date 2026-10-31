/**
 * Zweite Netflix-Kennung als eigenes Prüfziel (Prüfliste der Erweiterung, `extension-offene-liste.mjs`; Zählung im Prüfstand).
 * Nennen aniSearch oder JustWatch für einen Titel eine andere Netflix-Kennung als der Datensatz, bekommt auch sie einen
 * Eintrag mit denselben Titeln und demselben Stand wie die Kennung des Datensatzes. Doppelt genannte Kennungen zählen einmal.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { zusaetzlicheNetflixKennungen } from '../pipeline/lib/netflix-zweite-kennung.ts'

/** Hängt je Titel jede zusätzliche Kennung an `jeAdresse` (Kennung → Einträge) an; gibt die Zahl neuer Einträge zurück. */
export function ergaenzeZweiteKennungen(jeAdresse, zusatz) {
  let neu = 0
  for (const [titelId, kennungen] of zusatz) {
    const eigen = [...jeAdresse.values()].flat().find((e) => e.t.id === titelId)
    if (!eigen) continue
    for (const k of kennungen) {
      const vorhanden = jeAdresse.get(k) ?? []
      if (vorhanden.some((e) => e.t.id === titelId)) continue
      jeAdresse.set(k, [...vorhanden, { ...eigen }])
      neu++
    }
  }
  return neu
}

/** Zusätzliche Kennungen je Titel aus den aniSearch- und JustWatch-Daten der Wurzel. Cartoons bleiben draußen wie im Wächter `check-netflix-quellen-bestand.ts` (nur titles.json). */
export function ladeZusatz(titel, wurzel) {
  const lies = (pfad) => JSON.parse(readFileSync(resolve(wurzel, pfad), 'utf8'))
  return zusaetzlicheNetflixKennungen(titel.filter((t) => !t.cartoon), { anisearch: lies('data/anisearch.json'), justwatch: lies('data/justwatch-audio.json') })
}

/** Zählt die zusätzlichen Prüfziele (je Kennung, die der Datensatz nicht führt) zu `gesamt` und `gemeldet` des Prüfstand-Eintrags; offen steht schon aus der Liste. */
export function zaehleZusatzZiele(eintrag, zusatz) {
  const zahl = [...zusatz.values()].reduce((n, k) => n + k.length, 0)
  eintrag.gesamt += zahl
  eintrag.gemeldet += zahl
  return zahl
}

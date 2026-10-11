import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Die Titel, unter denen eine Meldung der Erweiterung eine Adresse wiederfindet: der Hauptbestand und —
 * sobald `data/pruefliste-regeln.json` die Cartoons zuschaltet (`erweitert`) — die Cartoons (Kennung
 * negativ). Dieselbe Schaltung wie bei den Listen (`tools/pruef-bestand.mjs`); ohne sie fände der Zuordner
 * die Adresse eines Cartoons nicht und ließe die Meldung unzugeordnet liegen.
 */
export function ladePruefTitel<T>(wurzel: string): T[] {
  const lies = (datei: string): T[] => {
    const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data', datei), 'utf8'))
    return Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))
  }
  let erweitert = process.env.PRUEFLISTE_ERWEITERT === '1'
  try {
    erweitert ||= JSON.parse(readFileSync(resolve(wurzel, 'data/pruefliste-regeln.json'), 'utf8')).erweitert === true
  } catch {
    /* Ohne Regeldatei gilt der Hauptbestand allein. */
  }
  return erweitert ? [...lies('titles.json'), ...lies('cartoons.json')] : lies('titles.json')
}

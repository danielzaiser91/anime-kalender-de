/**
 * Titel, deren Verweis der Bau entfernt hat, weil dort **kein deutscher Ton** liegt, gehören
 * trotzdem zur Adresse: der Anbieter führt die Staffel, nur nicht synchronisiert.
 *
 * Ohne sie sieht die Zuordnung weniger Staffeln als die Seite meldet und verweigert sich ganz
 * (Bleach TYBW: Disney+ führt 4 Staffeln, `titles.json` nur 3, weil Staffel 4 „nur untertitelt"
 * ist — die Meldung vom 08.10.2026 blieb liegen).
 */
import { existsSync, readFileSync } from 'node:fs'
import { schluesselAdresse } from './zuordnung.ts'

export type EntfernterVerweis = { titleId: number; url: string; grund: string }

/** Nur das belegte Nein: Bei den übrigen Gründen (tote Seite, falsche Reihe) gehört der Titel nicht an die Adresse. */
const GRUND_KEIN_TON = /^belegtes Nein/

/** Adresse (Schlüssel wie `schluesselAdresse`) → Titel, die der Bau dort wegen fehlenden Tons entfernt hat. */
export function entfernteJeAdresse(verweise: EntfernterVerweis[]): Map<string, number[]> {
  const je = new Map<string, number[]>()
  for (const v of verweise) {
    if (!v.url || !v.titleId || !GRUND_KEIN_TON.test(v.grund)) continue
    const k = schluesselAdresse(v.url)
    const bisher = je.get(k) ?? []
    if (!bisher.includes(v.titleId)) je.set(k, [...bisher, v.titleId])
  }
  return je
}

/** Hängt die entfernten Titel an Adressen, die `nachUrl` schon kennt; unbekannte Adressen bleiben unbekannt. */
export function ergaenzeUmEntfernte(nachUrl: Map<string, number[]>, datei: string): Map<string, number[]> {
  const hinzu = new Map<string, number[]>()
  for (const [k, entfernt] of entfernteJeAdresse(ladeEntfernteVerweise(datei))) {
    const bisher = nachUrl.get(k)
    if (!bisher) continue
    const neu = entfernt.filter((id) => !bisher.includes(id))
    nachUrl.set(k, [...bisher, ...neu])
    hinzu.set(k, neu)
  }
  return hinzu
}

/**
 * Die Titel, die eine Meldung selbst benennt (`titel_id`), stammen aus der Auftragsliste und
 * kennen die entfernte Staffel nicht — sie wären die 3 von 4 Staffeln. Bei mehreren benannten
 * Titeln einer Adresse kommen die entfernten dazu; ein einzelner benannter Titel bleibt allein.
 */
export function mitEntfernten(benannt: number[], entfernteDerAdresse: number[] = []): number[] {
  return benannt.length > 1 ? [...new Set([...benannt, ...entfernteDerAdresse])] : [...new Set(benannt)]
}

function ladeEntfernteVerweise(datei: string): EntfernterVerweis[] {
  if (!existsSync(datei)) return []
  try {
    const roh = JSON.parse(readFileSync(datei, 'utf8')) as { verweise?: EntfernterVerweis[] }
    return Array.isArray(roh.verweise) ? roh.verweise : []
  } catch {
    return []
  }
}

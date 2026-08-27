/**
 * Gedächtnis darüber, wann jede Quelle zuletzt etwas geliefert hat.
 *
 * Der Zweck ist nicht Statistik, sondern Alarm: Ein Scraper, dessen Selektoren
 * nach einem Seitenumbau ins Leere greifen, wirft keinen Fehler — er findet
 * einfach nichts mehr. Der Datenbestand veraltet dann still, und genau das
 * fällt monatelang niemandem auf. Hier steht deshalb je Quelle, wann sie
 * zuletzt erfolgreich war; `check-sources.ts` schlägt Alarm, wenn eine zu
 * lange schweigt.
 */
import { readJson, writeJson } from './util.ts'

const FILE = 'data/source-health.json'

export interface SourceState {
  /** Zeitpunkt des letzten Laufs, der etwas geliefert hat. */
  lastOk?: string
  /** Zeitpunkt des letzten Laufs überhaupt. */
  lastRun: string
  /** Was beim letzten Mal herauskam — Zahl der Fundstücke. */
  lastCount: number
  /** Fehlermeldung des letzten erfolglosen Laufs. */
  lastError?: string
}

export type SourceHealth = Record<string, SourceState>

/**
 * **Null Treffer ist nicht dasselbe wie nichts getan.**
 *
 * Die Grundannahme oben — wer nichts liefert, ist kaputt — trägt für einen
 * Scraper: Greifen seine Selektoren nach einem Seitenumbau ins Leere, findet
 * er nichts und muss auffallen.
 *
 * Für eine **Änderungs-Quelle** ist sie falsch. `motn:changes` fragt „was hat
 * sich in den letzten drei Tagen geändert?", und die richtige Antwort lautet
 * meistens „nichts". Am 27.08.2026 hat das den täglichen Lauf rot gemacht:
 * „motn-changes: seit 4.1 Tage nichts geliefert (zuletzt 0 Treffer)" — die
 * Quelle war gesund, sie hatte nur nichts zu melden.
 *
 * Das ist dieselbe Falle, die `CLAUDE.md` schon für die Prime-Prüfliste
 * beschreibt: eine Prüfung, die rot wird, weil die Arbeit erledigt ist.
 *
 * Unterschieden wird deshalb, ob der Lauf **gearbeitet** hat. `gearbeitet`
 * ist die Zahl der untersuchten Dinge — Seiten, Titel, Kalendertage. Wer 200
 * Titel geprüft und keine Änderung gefunden hat, war erfolgreich; wer nichts
 * untersucht hat, schweigt.
 *
 * Ohne das Argument bleibt es beim alten Verhalten: Für die meisten Quellen
 * ist die Trefferzahl selbst das Maß.
 */
export function recordSource(name: string, count: number, error?: string, gearbeitet?: number): void {
  const health = readJson<SourceHealth>(FILE, {})
  const now = new Date().toISOString()
  const previous = health[name]
  const erfolgreich = count > 0 || (gearbeitet ?? 0) > 0
  health[name] = {
    lastOk: erfolgreich ? now : previous?.lastOk,
    lastRun: now,
    lastCount: count,
    lastError: erfolgreich ? undefined : (error ?? previous?.lastError),
  }
  writeJson(FILE, health, true)
}

export function readSourceHealth(): SourceHealth {
  return readJson<SourceHealth>(FILE, {})
}

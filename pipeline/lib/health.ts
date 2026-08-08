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

export function recordSource(name: string, count: number, error?: string): void {
  const health = readJson<SourceHealth>(FILE, {})
  const now = new Date().toISOString()
  const previous = health[name]
  health[name] = {
    lastOk: count > 0 ? now : previous?.lastOk,
    lastRun: now,
    lastCount: count,
    lastError: count > 0 ? undefined : (error ?? previous?.lastError),
  }
  writeJson(FILE, health, true)
}

export function readSourceHealth(): SourceHealth {
  return readJson<SourceHealth>(FILE, {})
}

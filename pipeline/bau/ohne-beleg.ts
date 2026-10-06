import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { Title } from '../../shared/types.ts'
import { ROOT } from '../lib/util.ts'

/**
 * **Ein ausgestrahlter Titel, für den kein einziger Beleg einer deutschen Fassung vorliegt, gehört hinter „Anime ohne deutsche Synchro"**
 * (Daniel, 04.10.2026, Ranma 1/2 Staffel 3: Netflix führt Folge 1 seit gestern, aber ohne deutschen Ton — die Staffel stand mit
 * „Noch keine deutsche Fassung" im Hauptbestand).
 *
 * Gemeint sind die Titel ab 2023, deren Wege alle ungeprüft sind: kein Stream mit belegter Synchro, keine Erstausgabe-Marke
 * (die der Aufrufer schon ausgeschlossen hat: kein Release, keine deutschen Sprechrollen). Ältere Fernsehtitel ohne Streams
 * bleiben, wo sie sind — ihre Synchro ist real, nur nicht in Wegen belegt (gemessen 04.10.2026: 213 Titel ohne Beleg, davon
 * etwa 25 ab 2024 mit Weg). Wie überall gilt: ein Vorfilter verschiebt, er löscht nicht (`schreibeOhneSynchro`).
 */
export function ausgestrahltOhneBeleg(t: Title): boolean {
  if (!t.streams.length || t.deErstausgabe || t.streams.some((s) => s.dub === true)) return false
  return (t.jpYear ?? 0) >= 2023
}

/** Titel, für die eine Quelle ausdrücklich „keine deutsche Synchronfassung" sagt (`data/ohne-synchro-von-hand.yaml`); ohne Quelle zählt ein Eintrag nicht. */
export function ohneSynchroVonHand(): Set<number> {
  const liste = (yaml.load(readFileSync(resolve(ROOT, 'data/ohne-synchro-von-hand.yaml'), 'utf8')) ?? []) as { anilistId?: number; sources?: string[] }[]
  return new Set(liste.filter((e) => e.anilistId && e.sources?.length).map((e) => e.anilistId!))
}

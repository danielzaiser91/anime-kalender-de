/**
 * **Nennt die belegte deutsche Quelle eine Staffel, gilt sie — nicht AniLists „Part".**
 *
 * Daniel am 01.10.2026 an „86: Eighty Six": aniSearch führt den zweiten Teil als
 * „86: Eighty Six (Staffel 2)", AniList als „Part 2". `eindeutschenStaffel()`
 * machte daraus „Teil 2" — und `staffelBeschriftungen()` ordnete ihn deshalb der
 * ersten Staffel als zweiten Teil zu. Der Unterschied ist keine Kleinigkeit:
 * **„Teil" ist die zweite Hälfte einer geteilten Staffel, „Staffel" eine eigene.**
 *
 * Die Nummer gehört **nicht** in den Werktitel — der bleibt ohne Staffelangabe
 * (`werkTitel()`, und `check:logic` prüft es). Sie wandert als `staffelQuelle`
 * an den Reiheneintrag und steuert dort die Beschriftung.
 *
 * Liegt in einer eigenen Datei, weil `13-4-zusatzdateien.ts` die Längengrenze reißt.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT, readJson } from '../lib/util.ts'

/** Die Staffelnummer, die ein deutscher Quelltitel nennt — sonst nichts. */
export function staffelNummerAusQuelle(deutscherTitel: string): number | undefined {
  const roh = deutscherTitel.trim()
  const m = /\(\s*Staffel\s+(\d+)\s*\)\s*$/i.exec(roh) ?? /[–—-]?\s*Staffel\s+(\d+)\s*$/i.exec(roh)
  return m ? Number(m[1]) : undefined
}

/**
 * Die Staffelnummer, die die deutschen aniSearch-Synonyme („… Staffel 2") nennen.
 * Nur ab 2 (Staffel 1 sagt nichts) und nur, wenn alle Staffel-Synonyme dieselbe Zahl nennen.
 * „Season N" zählt nicht: englische Synonyme zählen Reihen (Sailor Moon Cosmos: Season 5, AniList „Part 1" eines Films).
 */
export function staffelNummerAusSynonymen(synonyme: string[]): number | undefined {
  const nummern = new Set(synonyme.map(staffelNummerAusQuelle).filter((n): n is number => n !== undefined))
  const [nr] = nummern
  return nummern.size === 1 && nr! >= 2 ? nr : undefined
}

type AnisearchEintrag = { info?: { languages?: { language?: string; title?: string }[]; synonyms?: string[] } }

/**
 * Staffelnummer eines aniSearch-Eintrags: Sprachblock „Deutsch", sonst die Synonyme.
 * Nennt der deutsche Titel selbst „Teil N" („Kengan Ashura: Teil 2", Synonym trotzdem „Staffel 2"), ist er die zweite Hälfte — das Synonym bleibt außen vor.
 */
export function staffelNummerAusEintrag(e: AnisearchEintrag): number | undefined {
  const de = e.info?.languages?.find((l) => /deutsch/i.test(l.language ?? ''))
  if (de?.title && staffelNummerAusQuelle(de.title)) return staffelNummerAusQuelle(de.title)
  return /\b(?:Teil|Part|Cour)\s*\d/i.test(de?.title ?? '') ? undefined : staffelNummerAusSynonymen(e.info?.synonyms ?? [])
}

/** Titel-Kennung → Staffelnummer aus dem aniSearch-Sprachblock „Deutsch" und den Synonymen. */
export function staffelQuellenAusAnisearch(): Map<number, number> {
  const map = new Map<number, number>()
  const eintraege = readJson<Record<string, AnisearchEintrag>>('data/anisearch.json', {})
  for (const [id, e] of Object.entries(eintraege)) {
    const nr = staffelNummerAusEintrag(e)
    if (nr) map.set(Number(id), nr)
  }
  return map
}

export type StaffelVonHand = { anilistId: number; staffel: number; quelle: string; belegtAm: string; titel?: string; grund?: string }

/** Liest `data/staffel-von-hand.yaml` (leer, wenn es die Datei nicht gibt). */
export function staffelEintraegeVonHand(datei = resolve(ROOT, 'data/staffel-von-hand.yaml')): StaffelVonHand[] {
  return existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as StaffelVonHand[] | null) ?? []) : []
}

/** Titel-Kennung → Staffelnummer: aniSearch-Sprachblock, dann Handeinträge (Hand schlägt Ableitung). */
export function alleStaffelQuellen(eintraege = staffelEintraegeVonHand()): Map<number, number> {
  const map = staffelQuellenAusAnisearch()
  for (const e of eintraege) map.set(e.anilistId, e.staffel)
  return map
}

/** Was an einem Handeintrag fehlt oder nicht stimmt (leer = in Ordnung). */
export function fehlerImHandeintrag(e: StaffelVonHand, reihenIds: Set<number>): string[] {
  return [
    !(Number.isInteger(e.staffel) && e.staffel >= 2) && 'Staffel ab 2 als Zahl',
    !/^https:\/\//.test(e.quelle ?? '') && 'Quelle als Adresse',
    !/^\d{4}-\d{2}-\d{2}$/.test(e.belegtAm ?? '') && 'Tag der Lesung',
    !reihenIds.has(e.anilistId) && 'Kennung steht in keiner Reihe',
  ].filter((f): f is string => Boolean(f))
}

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

/** Titel-Kennung → Staffelnummer aus dem aniSearch-Sprachblock „Deutsch". */
export function staffelQuellenAusAnisearch(): Map<number, number> {
  const map = new Map<number, number>()
  const eintraege = readJson<Record<string, { info?: { languages?: { language?: string; title?: string }[] } }>>(
    'data/anisearch.json',
    {},
  )
  for (const [id, e] of Object.entries(eintraege)) {
    const de = e.info?.languages?.find((l) => /deutsch/i.test(l.language ?? ''))
    const nr = de?.title ? staffelNummerAusQuelle(de.title) : undefined
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

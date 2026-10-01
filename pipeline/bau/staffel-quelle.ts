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
import { readJson } from '../lib/util.ts'

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

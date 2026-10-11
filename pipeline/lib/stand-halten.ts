import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson, ROOT, writeJson, writeText } from './util.ts'

/**
 * Setzt in `neu` den alten Zeitstempel ein, wenn `alt` sich sonst nicht unterscheidet.
 * Ohne das ändert jeder Bau die Datei, obwohl der Inhalt gleich bleibt.
 */
export function mitAltemStand<T extends Record<string, unknown>>(alt: Record<string, unknown> | null, neu: T, feld: keyof T & string): T {
  if (alt?.[feld] === undefined) return neu
  const ohneStand = (o: Record<string, unknown>) => JSON.stringify({ ...o, [feld]: null })
  return ohneStand(alt) === ohneStand(neu) ? { ...neu, [feld]: alt[feld] } : neu
}

/** Schreibt eine JSON-Datei; das Zeitstempelfeld wird nur erneuert, wenn sich der übrige Inhalt ändert. */
export function writeJsonStand<T extends Record<string, unknown>>(pfad: string, neu: T, feld: keyof T & string, pretty = false): void {
  writeJson(pfad, mitAltemStand(readJson<Record<string, unknown> | null>(pfad, null), neu, feld), pretty)
}

/** Schreibt eine Textdatei mit Stand-Datum; ist sie mit ihrem alten Stand schon gleich, bleibt der alte Stand stehen. */
export function writeTextStand(pfad: string, bauText: (stand: string) => string, heute: string, standImText: RegExp): void {
  const voll = resolve(ROOT, pfad)
  const alt = existsSync(voll) ? readFileSync(voll, 'utf8') : null
  const altStand = alt?.match(standImText)?.[1]
  writeText(pfad, alt !== null && altStand && bauText(altStand) === alt ? alt : bauText(heute))
}

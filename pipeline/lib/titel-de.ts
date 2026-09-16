/**
 * Liest die von Hand geprüften deutschen Werktitel aus `data/titel-de.yaml`.
 *
 * Steht in `lib/`, nicht im Bau: Auch `check-logic.ts` prüft die Datei, und ein
 * Import aus `build.ts` würde einen ganzen Bau auslösen (belegt am 30.08.2026,
 * als genau das eine gepflegte YAML überschrieben hat).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'

export interface TitelDe {
  /** Unsere Titel-Kennung (AniList). */
  id: number
  titleDe: string
  geprueftAm?: string
  note?: string
  /** Mindestens zwei unabhängige Belege — sonst gehört der Name nicht hierher. */
  quellen?: string[]
}

export function ladeTitelDe(): TitelDe[] {
  const pfad = resolve(ROOT, 'data/titel-de.yaml')
  if (!existsSync(pfad)) return []
  const daten = yaml.load(readFileSync(pfad, 'utf8')) as TitelDe[] | null
  return (daten ?? []).filter((e) => e?.id && e?.titleDe)
}

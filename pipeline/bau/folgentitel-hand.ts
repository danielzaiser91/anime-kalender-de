import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'

/**
 * **Von Hand zugeordnete deutsche Folgentitel** (`data/folgentitel-hand.yaml`, Daniel, 01.11.2026: was keine Stufe automatisch liefert, ordnen wir
 * einzeln zu). Jeder Eintrag nennt Titel, Folge, den deutschen Titel und die Fundstelle (`quelle`) in einer erlaubten Quelle. Die Stufe füllt nur Lücken:
 * ein Titel aus aniSearch, Crunchyroll, RTL+ oder TMDB bleibt.
 */
export interface HandEintrag {
  anilistId: number
  folge: number
  titel: string
  quelle: string
}

/** Die Einträge je Titelkennung → Folgennummer → Titel; fehlt die Datei, gibt es keine. */
export function ladeHandTitel(pfad: string): Record<string, Map<number, string>> {
  if (!existsSync(pfad)) return {}
  const eintraege = (yaml.load(readFileSync(pfad, 'utf8')) ?? []) as HandEintrag[]
  const je: Record<string, Map<number, string>> = {}
  for (const e of eintraege) (je[String(e.anilistId)] ??= new Map()).set(e.folge, e.titel)
  return je
}

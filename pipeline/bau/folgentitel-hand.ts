import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { istPlatzhalter } from './folgentitel-zeilen.ts'

/**
 * **Aus erlaubten Quellen übernommene deutsche Folgentitel** (`data/folgentitel-hand.yaml`, Auftrag Daniel, 01.11.2026: was keine Stufe automatisch liefert, wird einzeln
 * zugeordnet). Jeder Eintrag nennt Titel, Folge, den deutschen Titel und die Fundstelle (`quelle`) in einer erlaubten Quelle. Die Stufe füllt nur Lücken:
 * ein Titel aus aniSearch, Crunchyroll, RTL+ oder TMDB bleibt. Ein Eintrag ohne Pflichtfeld oder doppelt ist ein Fehler (`handFehler`), kein stilles Überspringen.
 */
export interface HandEintrag {
  anilistId: number
  folge: number
  titel: string
  quelle: string
}

const text = (v: unknown): boolean => typeof v === 'string' && v.trim() !== ''

/** Die Fehler der Einträge: fehlende oder falsche Pflichtfelder, Platzhalter als Titel, dieselbe Folge zweimal. */
export function handFehler(eintraege: unknown): string[] {
  if (!Array.isArray(eintraege)) return ['die Datei ist keine Liste']
  const fehler: string[] = []
  const gesehen = new Set<string>()
  eintraege.forEach((e: Partial<HandEintrag> | null, i) => {
    const wo = `Eintrag ${i + 1}`
    if (!e || typeof e !== 'object') return void fehler.push(`${wo}: kein Eintrag`)
    if (!Number.isInteger(e.anilistId) || (e.anilistId as number) < 1) fehler.push(`${wo}: anilistId fehlt oder ist keine Kennung`)
    if (!Number.isInteger(e.folge) || (e.folge as number) < 1) fehler.push(`${wo}: folge fehlt oder ist keine Nummer`)
    if (!text(e.titel)) fehler.push(`${wo}: titel fehlt`)
    else if (istPlatzhalter(e.titel as string)) fehler.push(`${wo}: titel ist ein Platzhalter`)
    if (!text(e.quelle)) fehler.push(`${wo}: quelle (Fundstelle) fehlt`)
    const schluessel = `${e.anilistId}:${e.folge}`
    if (gesehen.has(schluessel)) fehler.push(`${wo}: Folge ${e.folge} von ${e.anilistId} steht zweimal`)
    gesehen.add(schluessel)
  })
  return fehler
}

/** Die Einträge je Titelkennung → Folgennummer → Titel; fehlt die Datei, gibt es keine; ein Fehler in der Datei wirft. */
export function ladeHandTitel(pfad: string): Record<string, Map<number, string>> {
  if (!existsSync(pfad)) return {}
  const eintraege = yaml.load(readFileSync(pfad, 'utf8')) ?? []
  const fehler = handFehler(eintraege)
  if (fehler.length) throw new Error(`${pfad}: ${fehler.join('; ')}`)
  const je: Record<string, Map<number, string>> = {}
  for (const e of eintraege as HandEintrag[]) (je[String(e.anilistId)] ??= new Map()).set(e.folge, e.titel)
  return je
}

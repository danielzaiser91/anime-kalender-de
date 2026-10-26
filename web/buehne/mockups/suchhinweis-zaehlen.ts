import type { Title } from '@shared/types.ts'
import { normalize } from '../../src/lib/search.ts'

/** Treffer, die nur der Schalter „Anime ohne deutsche Synchro“ dazuholt: alle, und davon die mit gleichem Namen. */
export interface ZusatzTreffer {
  gesamt: number
  genau: number
}

/** „Passt genau“: Titel oder Synonym gleich dem Suchbegriff, Groß-/Kleinschreibung und Umlaute egal. */
export function passtGenau(titel: Title, suche: string, synonyme: string[]): boolean {
  const gesucht = normalize(suche.trim())
  if (!gesucht) return false
  const namen = [titel.titleDe, titel.titleEn, titel.titleRomaji, titel.titleNative, ...synonyme]
  return namen.some((name) => Boolean(name) && normalize(name!.trim()) === gesucht)
}

/** Titel der Liste mit Schalter, die in der Liste ohne Schalter fehlen. */
export function nurMitSchalter(mitSchalter: Title[], ohneSchalter: Title[]): Title[] {
  const da = new Set(ohneSchalter.map((t) => t.id))
  return mitSchalter.filter((t) => !da.has(t.id))
}

export function zaehleZusatz(treffer: Title[], suche: string, synonymeFuer: (id: number) => string[]): ZusatzTreffer {
  return { gesamt: treffer.length, genau: treffer.filter((t) => passtGenau(t, suche, synonymeFuer(t.id))).length }
}

/** „6 Treffer ohne Synchro, davon 1 exakt“ — die exakten nur, wenn es welche gibt. */
export function zusatzText({ gesamt, genau }: ZusatzTreffer): string {
  const kopf = `${gesamt.toLocaleString('de-DE')} Treffer ohne Synchro`
  return genau > 0 ? `${kopf}, davon ${genau.toLocaleString('de-DE')} exakt` : kopf
}

/** „„Hajime no Ippo“ ist ausgeblendet durch: Jahr 2003“ — die Filter kommen fertig beschriftet. */
export function blockadeText(name: string, filter: string[]): string {
  return `„${name}“ ist ausgeblendet durch: ${filter.join(', ')}`
}

import type { Title } from '@shared/types.ts'
import { groupByFranchise } from './db-gruppen.ts'
import { normalize } from './search.ts'

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

/**
 * Die Karten, die der Schalter zur Liste dazubrächte — gezählt in der Einheit der Liste: bei „Staffeln zusammenfassen“ die Gruppen,
 * die noch keine Karte haben (Treffer in einer schon gezeigten Gruppe füllen nur diese Karte), sonst die einzelnen Titel.
 */
export function zaehleKarten(treffer: Title[], sichtbar: Title[], gruppiert: boolean, suche: string, synonymeFuer: (id: number) => string[]): ZusatzTreffer {
  const gezeigt = new Set(sichtbar.map((t) => t.id))
  const alle = gruppiert ? groupByFranchise([...sichtbar, ...treffer]).map((g) => g.members) : treffer.map((t) => [t])
  const neu = alle.filter((karte) => karte.every((t) => !gezeigt.has(t.id)))
  return { gesamt: neu.length, genau: neu.filter((karte) => karte.some((t) => passtGenau(t, suche, synonymeFuer(t.id)))).length }
}

/** Steht für diesen Titel schon eine Karte in der Liste? Bei zusammengefassten Staffeln genügt ein anderes Glied seiner Gruppe. */
export function hatKarte(titel: Title, sichtbar: Title[], gruppiert: boolean): boolean {
  const gezeigt = new Set(sichtbar.map((t) => t.id))
  if (!gruppiert) return gezeigt.has(titel.id)
  const karte = groupByFranchise([...sichtbar, titel]).find((g) => g.members.some((t) => t.id === titel.id))
  return !!karte?.members.some((t) => gezeigt.has(t.id))
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

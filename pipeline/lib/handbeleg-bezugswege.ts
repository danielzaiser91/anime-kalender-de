import type { Title, WatchLink } from '../../shared/types.ts'
import { plattformVon } from './cartoons.ts'
import { log } from './util.ts'
import { adressKern, dubKey, type DubCheck } from './dub-confirmed.ts'

/**
 * Bezugswege (`watchLinks`) eines Titels, die ein Nein-Handbeleg zu `platform` verneint. `check:handbelege` prüft damit, dass keiner
 * im Datensatz steht; der Bau nimmt sie mit `entferneBezugswegeTrotzNein` heraus.
 *
 * - `nichtVerfuegbar` (`available: false`): der Anbieter führt den Titel nicht, jeder Weg dorthin ist falsch.
 * - sonst (`dub: false`): ohne deutschen Ton. Ein Kauf- oder Leihweg sagt nichts über den Ton und bleibt stehen
 *   (White Snake: Handbeleg „YouTube-Kanal nur Chinesisch“, daneben YouTube Movies zum Kauf).
 * - `adressen` sind die Adressen der Nein-Belege; ohne sie gilt das Nein der ganzen Plattform.
 */
export function bezugswegeTrotzNein(t: Pick<Title, 'watchLinks'>, platform: string, adressen: string[], nichtVerfuegbar: boolean): WatchLink[] {
  const gleicheAdresse = (w: WatchLink) => !adressen.length || adressen.some((u) => adressKern(u) === adressKern(w.url))
  const verneint = (w: WatchLink) => nichtVerfuegbar || w.zugang !== 'kauf'
  return (t.watchLinks ?? []).filter((w) => plattformVon(w.name) === platform && gleicheAdresse(w) && verneint(w))
}

const sagtJa = (c: DubCheck) => c.dub === true || (c.dubRanges ?? []).some((r) => r.dub)
const sagtNein = (c: DubCheck) => c.dub === false || c.available === false

/** Entfernt aus allen Titeln die Bezugswege, die ein eindeutiges Nein-Handbeleg verneint (kein Ja derselben Plattform daneben); liefert die Zahl. */
export function entferneBezugswegeTrotzNein(titles: Map<number, Title>, checks: DubCheck[]): number {
  const jeVerweis = new Map<string, DubCheck[]>()
  for (const c of checks) jeVerweis.set(dubKey(c.anilistId, c.platform), [...(jeVerweis.get(dubKey(c.anilistId, c.platform)) ?? []), c])
  let entfernt = 0
  for (const gruppe of jeVerweis.values()) {
    const t = titles.get(gruppe[0]!.anilistId)
    if (!t?.watchLinks?.length || gruppe.some(sagtJa) || !gruppe.some(sagtNein)) continue
    const adressenVon = (liste: DubCheck[]) => liste.map((c) => c.url).filter((u): u is string => Boolean(u))
    /* Wie `check:handbelege`: Nennt ein Nein eine Adresse, gilt nur sie; sonst alle Adressen der Gruppe, ohne jede die ganze Plattform. */
    const adressen = adressenVon(gruppe.filter(sagtNein)).length ? adressenVon(gruppe.filter(sagtNein)) : adressenVon(gruppe)
    const raus = new Set(bezugswegeTrotzNein(t, gruppe[0]!.platform, adressen, gruppe.some((c) => c.available === false)))
    t.watchLinks = t.watchLinks.filter((w) => !raus.has(w))
    entfernt += raus.size
  }
  if (entfernt) log(`${entfernt} Bezugswege entfernt, die ein Nein-Handbeleg des Anbieters verneint`)
  return entfernt
}

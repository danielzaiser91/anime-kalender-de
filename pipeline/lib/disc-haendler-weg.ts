/**
 * **Händler-Weg aus der EAN für Titel, die nur den aniSearch-Artikel als Bezugsweg haben.**
 *
 * Der Kauflink aus der EAN (`disc-ean.ts`) hing bisher nur an Disc-Terminen in `releases.json`. Ein Titel mit belegter
 * deutscher Disc-Ausgabe, aber ohne Termin, zeigte nur den aniSearch-Artikel. Hier bekommt er zusätzlich dieselbe
 * Amazon-Suche nach der EAN einer deutschen Ausgabe (Tonspurzeile des Artikels nennt „Deutsch“; ohne Audio-Feld kein Weg).
 *
 * Kein Abruf und keine Aussage über Lieferbarkeit: Der Weg ist eine Suche („Bei Amazon suchen“), kein Angebot.
 * Nur Titel ohne Stream und ohne anderen Weg als aniSearch; wer schon einen Händler hat, behält ihn.
 */
import { amazonEanUrl } from '../../shared/plattform-suche.ts'
import type { Title } from '../../shared/types.ts'
import { discEan, discIndexLaden, type DiscIndex } from './disc-ean.ts'
import { log } from './util.ts'

const nurAniSearch = (t: Title): boolean => {
  const w = t.watchLinks ?? []
  return !(t.streams ?? []).length && w.length > 0 && w.every((l) => l.name === 'aniSearch')
}

/**
 * Bauschritt: läuft ganz hinten im Wege-Abschluss. Davor entfernt `bereinigeWege` jede Amazon-Suche als „belegtes Nein“
 * (Adresse ohne Query), und die Händler-Ergänzung aus JustWatch weicht einem vorhandenen Händler.
 */
export function baueEanHaendlerWege(titles: Map<number, Title>): void {
  log(`${ergaenzeEanHaendlerWege(titles.values(), discIndexLaden())} Titel bekamen neben dem aniSearch-Artikel die Amazon-Suche nach der EAN`)
}

/** Artikel einer Ausgabe nennt in der Tonspurzeile „Deutsch“; ohne Audio-Feld gilt das nicht als belegt. */
const mitDeutsch = (index: DiscIndex, url: string | undefined): boolean =>
  (index.artikel[/article\/(\d+)/.exec(url ?? '')?.[1] ?? '']?.audio ?? []).some((z) => /deutsch/i.test(z))

/** EAN der ersten Ausgabe des Titels mit deutscher Tonspur und eindeutiger EAN (bei mehreren Ausgaben eine deutsche, nicht zwingend die des aniSearch-Wegs). */
function deutscheEan(titleId: number, index: DiscIndex): string | undefined {
  for (const a of index.ausgaben[String(titleId)] ?? []) {
    const ean = mitDeutsch(index, a.url) ? discEan(index, titleId, a.datum) : undefined
    if (ean) return ean
  }
  return undefined
}

/** Hängt den EAN-Weg an; Rückgabe = Anzahl der Titel, die ihn bekamen. */
export function ergaenzeEanHaendlerWege(titles: Iterable<Title>, index: DiscIndex): number {
  let n = 0
  for (const title of titles) {
    if (!nurAniSearch(title)) continue
    const ean = deutscheEan(title.id, index)
    if (!ean) continue
    title.watchLinks = [...(title.watchLinks ?? []), { name: 'Amazon', url: amazonEanUrl(ean), kind: 'buy', zugang: 'kauf' }]
    n++
  }
  return n
}

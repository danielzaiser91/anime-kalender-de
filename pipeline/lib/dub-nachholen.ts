/**
 * **Die Synchro-Aussage steht im Artikel, nicht im Feed-Auszug.** Der Auszug endet vor den Einzelheiten; „mit deutscher
 * Synchronisation auf Blu-ray" (Gantz) fehlte darin, „im Originalton mit Untertiteln" (Beerus) stand darin. Ein Termin
 * entsteht nur aus einer ausdrücklichen Synchro-Aussage (`releasesAus`), deshalb wird der Artikeltext einmal je
 * Vorschlag gelesen und der Befund daraus gebildet — nur der Artikelkörper, nicht die Seitenleiste mit fremden Meldungen.
 */
import { sleep } from './util.ts'

/** Wo der Artikelkörper endet: danach folgen fremde Meldungen und Kommentare. */
const KOERPER_ENDE = /Mehr zum Thema|Weitere Themen|Diskutiere mit|\d+ Kommentar|Neueste Meldungen/

/** Der Fließtext des Artikels aus dem Seiten-HTML. */
export function artikelKoerper(html: string): string {
  const von = html.indexOf('<article')
  const bis = html.indexOf('</article>')
  const text = (von >= 0 && bis > von ? html.slice(von, bis) : html)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  const ende = text.search(KOERPER_ENDE)
  return ende > 0 ? text.slice(0, ende) : text
}

interface Nachholbar {
  articleUrl: string
  category: string
  platforms: string[]
  dates: { iso?: string; month?: string }[]
  dub: string
  dubGelesen?: string
  sammel?: unknown[]
  discZeilen?: unknown[]
  verschiebungen?: unknown[]
  alreadyCurated: boolean
}

/** Ein Vorschlag, aus dem ein Termin werden könnte und dessen Synchro-Aussage noch nicht aus dem Artikel gelesen ist. */
const istFaellig = (p: Nachholbar, heute: string): boolean =>
  !p.dubGelesen &&
  p.dub !== 'ja' &&
  !p.alreadyCurated &&
  !p.sammel &&
  !p.discZeilen &&
  !p.verschiebungen &&
  p.platforms.length > 0 &&
  p.dates.some((d) => (d.iso ?? `${d.month}-31`) >= heute)

/** Liest die Artikel fälliger Vorschläge (höchstens `hoechstens` je Lauf) und setzt `dub` und `dubGelesen`. */
export async function dubNachholen<T extends Nachholbar>(
  alle: T[],
  heute: string,
  holen: (url: string) => Promise<string | undefined>,
  befund: (text: string) => string,
  hoechstens = 20,
): Promise<T[]> {
  let geholt = 0
  const aus: T[] = []
  for (const p of alle) {
    if (geholt >= hoechstens || !istFaellig(p, heute)) {
      aus.push(p)
      continue
    }
    geholt++
    const html = await holen(p.articleUrl)
    await sleep(1500)
    aus.push(html ? { ...p, dub: befund(artikelKoerper(html)), dubGelesen: heute } : p)
  }
  return aus
}

/**
 * Ein Termin ist eine Synchro-Aussage: nur `ja` (Sammelartikel `zugesagt`) wird einer. „Originalton mit Untertiteln",
 * „noch offen" und Schweigen bleiben Vorschlag (Beerus, 09.10.2026).
 */
export const belegtSynchro = (v: { dub?: string }): boolean => v.dub === 'ja' || v.dub === 'zugesagt'

/** Ein frischer Feed-Treffer behält, was der Vorlauf schon aus dem Artikel gelesen hat: die Sammelartikel-Liste und den Synchro-Befund. */
export function behalteGelesenes<T extends { dub: string; dubGelesen?: string; sammel?: unknown; sammelGelesen?: string }>(neu: T, vorher: T | undefined): T {
  return {
    ...neu,
    ...(vorher?.sammel ? { sammel: vorher.sammel, sammelGelesen: vorher.sammelGelesen } : {}),
    ...(vorher?.dubGelesen ? { dub: vorher.dub, dubGelesen: vorher.dubGelesen } : {}),
  }
}

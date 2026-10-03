/**
 * Liest die Sprecherseite eines aniSearch-Anime (`/anime/<id>/seiyuu`).
 *
 * Je Figur führt aniSearch die Sprecher nach Land (`seiyuu_ja`, `seiyuu_de` …). Wir behalten
 * **deutsche** Sprecher vollständig (sie belegen eine deutsche Fassung) und von den japanischen nur
 * die Zahl, damit der Datensatz klein bleibt. Gemessen am 03.10.2026: Eyeshield 21 hat 234 japanische
 * und 134 deutsche Einträge.
 */

export interface DeutscheRolle {
  figur: string
  sprecher: string
}

export interface Sprecher {
  de: DeutscheRolle[]
  /** Anzahl Figuren mit japanischem Sprecher — Gegenprobe, dass die Seite überhaupt Sprecher führt. */
  ja: number
}

const entitaeten = (s: string): string =>
  s.replace(/&#0?39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim()

export function sprecherAus(html: string): Sprecher {
  const de: DeutscheRolle[] = []
  let ja = 0
  for (const zeile of html.split('<tr>').slice(1)) {
    const figur = /<th[^>]*data-title="([^"]*)"/.exec(zeile)?.[1]
    if (!figur) continue
    if (/class="seiyuuItem seiyuu_ja"/.test(zeile)) ja++
    const deItem = /class="seiyuuItem seiyuu_de"[\s\S]*?<a href="person\/\d+,[^"]*">([^<]+)<\/a>/.exec(zeile)
    if (deItem) de.push({ figur: entitaeten(figur), sprecher: entitaeten(deItem[1]!) })
  }
  return { de, ja }
}

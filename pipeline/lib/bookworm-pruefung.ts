import { readFileSync } from 'node:fs'
import { ladeAkVon, umleitungen } from './ausgabe-kennung.ts'

export type Pruefe = (name: string, ok: boolean, gefunden?: unknown) => void

/** Bookworm Staffel 5: eine Zeile, alte Kennung leitet um. Quellen als Parameter: die Kulisse (`check:logic`) oder die echten Dateien (`check:bestand`). */
export function pruefeBookwormKennung(pruefe: Pruefe, kennungenPfad: string, handPfad: string): void {
  const { akVon, zeilen } = ladeAkVon(kennungenPfad)
  const zeile = zeilen.find((z) => z[2] === 22017 && z[1] === 10_022_017)
  const ziel = zeilen.find((z) => z[1] === 217_712)
  pruefe('Handdatei bindet AniList 217712 an aniSearch 22017 (die Zeile entfällt)', /^217712:\s*22017\b/m.test(readFileSync(handPfad, 'utf8')))
  pruefe('Kennung 26256 (Zeile 10022017) trägt als Nachfolger die ak des AniList-Titels 217712', zeile?.[0] === 26256 && ziel !== undefined && zeile[3] === ziel[0], [zeile, ziel])
  pruefe('Der Nachfolger ist kein Zwischenglied und trägt dieselbe aniSearch-Kennung', ziel?.[3] === undefined && ziel?.[2] === 22017, ziel)
  pruefe('akVon der Zeile ist die ak des AniList-Titels (die Ausgabe nennt nie 26256)', akVon(10_022_017) === akVon(217_712) && akVon(217_712) !== 26256)
  pruefe('ak-umleitung.json führt 26256 auf den Nachfolger', umleitungen(zeilen).some(([alt, neu]) => alt === 26256 && neu === ziel?.[0]))
}

/**
 * **Wer die Adresse eines Handbelegs ändert, sperrt die alte Adresse** (10.11.2026, Anlass #3339: Oshi no Ko S1, B0GFPBT6FG →
 * B0B7D5DRV2). `belegSchluessel` enthält die Adresse, und der Bestandsbau liest die Browser-Meldungen jeden Lauf neu: Ohne Eintrag
 * in `data/belege-entfernt.yaml` (Kennung + alte Adresse) hängt er die Blöcke mit der alten Adresse als Dubletten wieder an.
 */
import { istEntfernt } from './belege-entfernt.ts'
import { sperrKern, type BelegEntfernt } from './sperr-kern.ts'

interface Beleg {
  anilistId?: number
  url?: string
}

const schluessel = (id: number | undefined, url: string): string => `${id} ${sperrKern(url)}`
const paare = (belege: readonly Beleg[]): Set<string> => new Set(belege.filter((b) => b?.url).map((b) => schluessel(b.anilistId, b.url!)))

/** `wechsel`: Zahl der Paare (Kennung, alte Adresse), die weg sind, während dieselbe Kennung eine neue Adresse bekam; `ungedeckt`: davon die ohne Eintrag in der Sperrliste. */
export function adresswechsel(alt: readonly Beleg[], neu: readonly Beleg[], entfernt: readonly BelegEntfernt[]): { wechsel: number; ungedeckt: string[] } {
  const vorher = paare(alt)
  const nachher = paare(neu)
  const neueIds = new Set([...nachher].filter((p) => !vorher.has(p)).map((p) => p.split(' ')[0]))
  const geprueft = new Set<string>()
  const ungedeckt: string[] = []
  for (const b of alt) {
    if (!b?.url) continue
    const s = schluessel(b.anilistId, b.url)
    if (nachher.has(s) || geprueft.has(s) || !neueIds.has(String(b.anilistId))) continue
    geprueft.add(s)
    if (!istEntfernt(entfernt, b.anilistId, b.url)) ungedeckt.push(`${b.anilistId} ${b.url}`)
  }
  return { wechsel: geprueft.size, ungedeckt }
}

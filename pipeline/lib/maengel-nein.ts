import { dubKey, neinHandbelege, type DubCheck } from './dub-confirmed.ts'

type Beleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges' | 'juengstesUrteil'> & { checkedAt?: string }

/**
 * Gilt ein Handbeleg-Nein für einen Termin, der am Tag `ab` beginnt? Wer „nicht verfügbar“ belegt (`available: false`), hat vor dem Termin gemessen,
 * wenn sein Datum vor `ab` liegt: Das Angebot kann danach erschienen sein, das Nein ist dann überholt (Kuroko's Basketball 102836, Kamisama Kiss 14713).
 * Ein „ohne deutschen Ton“ (`dub: false`) gilt unabhängig vom Datum, der Ton einer Ausgabe ändert sich mit dem Termin nicht.
 */
export function baueNeinGilt(belege: Beleg[]): (id: number, plattform: string, ab: string) => boolean {
  const nein = neinHandbelege(belege)
  const tonNein = new Set(belege.filter((b) => b.dub === false).map((b) => dubKey(b.anilistId, b.platform)))
  const nichtVerfuegbarAm = new Map<string, string>()
  for (const b of belege.filter((x) => x.available === false)) {
    const k = dubKey(b.anilistId, b.platform)
    if ((b.checkedAt ?? '') > (nichtVerfuegbarAm.get(k) ?? '')) nichtVerfuegbarAm.set(k, b.checkedAt ?? '')
  }
  return (id, plattform, ab) => {
    const k = dubKey(id, plattform)
    const verneint = nein.has(k) || [...nein].some((n) => n.startsWith(`${k}|`))
    return verneint && (tonNein.has(k) || (nichtVerfuegbarAm.get(k) ?? '') >= ab)
  }
}

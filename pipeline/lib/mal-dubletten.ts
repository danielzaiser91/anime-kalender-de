/**
 * **Gleiche MAL-Kennung bei einem aniSearch- und einem AniList-Titel ist eine Dublette, außer sie ist hier begründet** (Befund
 * `docs/wissen/datensatz.md`, 08.10.2026: 27 solche aniSearch-Titel, 4 davon dasselbe Werk zweimal).
 *
 * Eine Dublette löst die Handdatei `data/anisearch-ids-hand.yaml` auf (AniList-ID → aniSearch-ID, der aniSearch-Titel entfällt). Was hier
 * steht, ist gemessen kein doppeltes Werk: Teil eines AniList-Titels, den aniSearch teilt, oder ein Special unter der MAL der Serie.
 */
const ANISEARCH_ID_BASIS = 10_000_000

const TEIL = 'Teil eines AniList-Titels: AniList fasst zusammen, aniSearch teilt'
const ZWEI_WERKE = 'zwei Werke: Special oder Bonus unter der MAL-Kennung der Serie'

function grund(ids: number[], text: string): [number, string][] {
  return ids.map((id) => [id, text])
}

/** aniSearch-Kennung → Grund, warum ihre MAL-Kennung auch ein AniList-Titel trägt (Stand 08.10.2026, Befund am Datensatz). */
export const MAL_AUSNAHMEN: Record<number, string> = Object.fromEntries([
  ...grund([3873, 5194, 5879, 6864, 6984, 6986, 6990, 6994, 10586, 11635, 11938, 13343, 13418, 13419, 14752, 18616], TEIL),
  ...grund([6828, 7051, 7052, 7069, 9303, 13220], ZWEI_WERKE),
  ...grund([19697], 'Kitarou Tanjou „Shinsei-ban": zweite Fassung desselben Films, unsicher, bisher nicht angefasst'),
])

/**
 * Dubletten, die die Handdatei auflöst, sobald der Bau mit ihr gelaufen ist: aniSearch-Kennung → letzter Tag, an dem die Zeile noch stehen darf
 * (Ablauf 15.10.2026). Danach wird sie rot, bis der Datensatz neu gebaut ist.
 */
export const MAL_UEBERGANG: Record<number, string> = { 21084: '2026-10-15', 21566: '2026-10-15', 21575: '2026-10-15', 21751: '2026-10-15' }

type Titel = { id: number; malId?: number }

/** Meldungen zu aniSearch-Titeln, deren MAL-Kennung ein AniList-Titel trägt, ohne dass die Ausnahme es deckt. Leer heißt in Ordnung. */
export function malDubletten(titel: Titel[], eintraege: Record<string, { mal?: number }>, heute: string): string[] {
  const anilist = new Map<number, number[]>()
  for (const t of titel) if (t.id < ANISEARCH_ID_BASIS && t.malId) anilist.set(t.malId, [...(anilist.get(t.malId) ?? []), t.id])
  const fehler: string[] = []
  for (const t of titel) {
    if (t.id < ANISEARCH_ID_BASIS) continue
    const asId = t.id - ANISEARCH_ID_BASIS
    const mal = eintraege[String(asId)]?.mal
    const partner = mal ? anilist.get(mal) : undefined
    if (!mal || !partner?.length || MAL_AUSNAHMEN[asId]) continue
    const bis = MAL_UEBERGANG[asId]
    if (bis && heute <= bis) continue
    fehler.push(`aniSearch ${asId} (Titel ${t.id}) und AniList ${partner.join(', ')} tragen dieselbe MAL-Kennung ${mal}${bis ? ` — Übergang bis ${bis} abgelaufen` : ''}: in data/anisearch-ids-hand.yaml binden oder in MAL_AUSNAHMEN begründen`)
  }
  return fehler
}

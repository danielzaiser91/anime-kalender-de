/**
 * **Welche aniSearch-Ausgabe ein Disc-Termin aus den News meint** (26.09.2026).
 *
 * Anime2You meldete „Dragon Ball Z: Box 4 erscheint am 20.11.2026" — der Termin stand als nackte
 * Pille „Kaufausgabe" da, ohne Namen und ohne Ziel. In `data/disc-ausgaben.json` steht dieselbe Box
 * längst („Dragon Ball Z – Box 04/10 (Uncut)", als DVD und Blu-ray, mit dem Platzhalter 31.12.2026).
 * Daniel hat die Zuordnung am selben Tag an Amazons Seite bestätigt.
 *
 * Verknüpft wird nur über **dieselbe Nummer** (Box, Volume) — der Name allein ist kein Beleg — und
 * nur mit Ausgaben, die nicht lange vor dem Termin erschienen sind: Dragon Ball Z hat eine zweite
 * „Box 04/10" als DVD von 2011, und die ist eine andere Ware. Treffen mehrere verschiedene Ausgaben,
 * bleibt der Termin unverknüpft.
 */

export interface DiscAusgabe {
  edition: string
  datum: string
  url?: string
  format?: string
  kurz?: string
}

const NUMMER = /\b(box|vol(?:ume)?)[\s._-]*0*(\d{1,2})(?!\d)/i

/** „box", „4" aus „…/dragon-ball-z-box-4-termin/" oder „Box 04/10 (Uncut)". */
export function discNummer(text: string): { art: string; nr: number } | null {
  const m = NUMMER.exec(text)
  if (!m) return null
  return { art: m[1]!.toLowerCase().startsWith('vol') ? 'vol' : 'box', nr: Number(m[2]) }
}

const TAG = 86_400_000

export function ausgabeZumDiscTermin(
  termin: { datum: string; hinweise: string[] },
  ausgaben: DiscAusgabe[],
): { edition: string; url: string } | null {
  const nummer = termin.hinweise.map(discNummer).find(Boolean)
  if (!nummer) return null
  const frueheste = Date.parse(termin.datum) - 400 * TAG
  const treffer = ausgaben.filter((a) => {
    const n = discNummer(a.kurz ?? a.edition)
    return n && n.art === nummer.art && n.nr === nummer.nr && Date.parse(a.datum) >= frueheste
  })
  if (!treffer.length) return null
  const namen = [...new Set(treffer.map((a) => (a.kurz ?? a.edition).trim()))]
  if (namen.length > 1) return null
  const formate = [...new Set(treffer.map((a) => a.format).filter(Boolean))].sort()
  const ziel = treffer.find((a) => a.format === 'Blu-ray' && a.url) ?? treffer.find((a) => a.url)
  if (!ziel?.url) return null
  return { edition: [namen[0], formate.join(' + ')].filter(Boolean).join(' · '), url: ziel.url }
}

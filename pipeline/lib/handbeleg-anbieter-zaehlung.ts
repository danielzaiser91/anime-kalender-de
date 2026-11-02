/**
 * Handbelege zählen in **unseren** Folgennummern. Netflix zählt je Staffel neu und führt manchmal nur spätere Staffeln
 * (`data/anbieter-staffeln.json` ohne Staffel 1): Beyblade X trug "Folgen 2–48" aus Netflix-Staffel 2, unsere Folge 52 ff.
 * Ein Bereich an einer solchen Adresse braucht den Vermerk der Umrechnung in der `note`, sonst ist er ungeprüft.
 */
import type { DubCheck } from './dub-confirmed.ts'

export const UMRECHNUNGS_VERMERK = 'Umrechnung:'

export type StaffelListen = Record<string, { staffeln?: { seq: number; folgen: number }[] } | undefined>

type Beleg = Pick<DubCheck, 'anilistId' | 'title' | 'platform' | 'url' | 'dubRanges' | 'note'>

function netflixKennung(url: string | undefined): string | undefined {
  return /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(url ?? '')?.[1]
}

/** Die Netflix-Kennungen aller Verweise eines Titels. */
export function netflixKennungen(streams: { platform?: string; url?: string }[] | undefined): string[] {
  const kennungen = (streams ?? []).filter((s) => s.platform === 'netflix').map((s) => netflixKennung(s.url))
  return kennungen.filter((k): k is string => !!k)
}

/** Je Handbeleg mit Bereichen an einer Netflix-Adresse, deren Staffelliste nicht bei Staffel 1 beginnt und die keinen Umrechnungsvermerk trägt, eine Zeile. */
export function findeAnbieterZaehlung(belege: Beleg[], listen: StaffelListen, adressenVon: (anilistId: number) => string[]): string[] {
  const treffer: string[] = []
  for (const b of belege) {
    if (b.platform !== 'netflix' || !b.dubRanges?.length) continue
    if (b.note?.includes(UMRECHNUNGS_VERMERK)) continue
    const eigene = netflixKennung(b.url)
    const kennungen = eigene ? [eigene] : adressenVon(b.anilistId)
    for (const kennung of kennungen) {
      const staffeln = listen[kennung]?.staffeln
      if (!staffeln?.length || staffeln.some((s) => s.seq === 1)) continue
      const erste = Math.min(...staffeln.map((s) => s.seq))
      const bereiche = b.dubRanges.map((r) => `${r.from}–${r.to}`).join(', ')
      treffer.push(`${b.title ?? b.anilistId} (${b.anilistId}): Bereich ${bereiche} an Netflix ${kennung}, dessen Liste bei Staffel ${erste} beginnt`)
    }
  }
  return treffer
}

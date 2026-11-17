import type { Release, Title } from '../../shared/types.ts'

export const ANBIETER_STAFFELN_DATEI = 'data/anbieter-staffeln.json'
/** Staffelliste des Anbieters je Netflix-Kennung (`ANBIETER_STAFFELN_DATEI`); `folgen` zählt je Staffel. */
export type AnbieterStaffeln = Record<string, { staffeln?: { folgen?: number }[]; gemeldetAm?: string }>
export type StaffelBefund = 'ohne-bereich' | 'laenger-als-staffel' | 'ueberlappung' | 'liste-veraltet'

/** Der späteste Start eines Netflix-Termins (JJJJ-MM-TT); ohne Termin `undefined`. */
export const letzterNetflixStart = (releases: Release[]): string | undefined =>
  releases.filter((r) => r.platform === 'netflix').map((r) => r.schedule?.firstEpisodeDate ?? '').sort().at(-1) || undefined

const netflixKennung = (url: string): string | undefined => /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(url)?.[1]

/**
 * Titel, deren Staffel-Zuordnung an einer geteilten Netflix-Adresse nicht zur Staffelliste des Anbieters passt (nur Titel desselben Franchise; fremde Partner
 * zählt `adresse-mehrfach`). Netflix zählt je Staffel; die Titel einer Adresse müssen in diese Staffeln passen:
 * `ohne-bereich` = keine Staffelliste, `laenger-als-staffel` = ein Titel hat mehr Folgen als jede Staffel, `ueberlappung` = zusammen mehr Folgen als alle Staffeln.
 * `liste-veraltet` (Ausnahme, kein offener Mangel): ein Titel der Adresse hat einen Netflix-Termin nach `gemeldetAm`, die Liste kennt seine Staffel noch nicht.
 * Nicht gezählt, weil nicht messbar bzw. kein Fehler der Zuordnung: ein Titel ohne Folgenzahl (`folgenzahl`) und Staffeln ohne Titel (der Katalog kennt sie nicht).
 */
export function staffelZuordnung(titel: Title[], staffeln: AnbieterStaffeln, netflixStart: (id: number) => string | undefined): Map<number, StaffelBefund> {
  const je = new Map<string, Map<number, Title>>()
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      const id = netflixKennung(s.url ?? '')
      if (id) (je.get(id) ?? je.set(id, new Map()).get(id)!).set(t.id, t)
    }
  }
  const aus = new Map<number, StaffelBefund>()
  for (const [id, gruppe] of je) {
    const ts = [...gruppe.values()]
    if (ts.length < 2 || new Set(ts.map((t) => t.franchiseId ?? t.id)).size > 1 || ts.some((t) => !t.episodes)) continue
    const folgen = (staffeln[id]?.staffeln ?? []).map((s) => s.folgen ?? 0)
    const befund: StaffelBefund | undefined = !folgen.length
      ? 'ohne-bereich'
      : ts.some((t) => t.episodes! > Math.max(...folgen))
        ? 'laenger-als-staffel'
        : ts.reduce((a, t) => a + t.episodes!, 0) > folgen.reduce((a, n) => a + n, 0)
          ? 'ueberlappung'
          : undefined
    const gemeldet = staffeln[id]?.gemeldetAm
    const veraltet = Boolean(befund && gemeldet && ts.some((t) => (netflixStart(t.id) ?? '') > gemeldet))
    if (befund) for (const t of ts) aus.set(t.id, veraltet ? 'liste-veraltet' : befund)
  }
  return aus
}

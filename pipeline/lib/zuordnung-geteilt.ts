import { adressKern, istSammelKern } from '../../shared/adresse-kern.ts'
import { amazonTitelAdresse } from './amazon-adresse.ts'
import type { ZuordnungEintrag } from './zuordnung-fremd.ts'

export interface GeteilterBesitzer {
  titleId: number
  franchiseId: number
  /** „laut Adresse Staffel k“ aus dem Handbeleg dieser Kennung an der Adresse, wo vorhanden. */
  staffel?: number
}

export interface GeteilteSeite {
  adresse: string
  besitzer: GeteilterBesitzer[]
}

/** Die Adresse, die der Bau für den Eintrag prüft (Seite der Rohfolge, sonst gemeldete Adresse) — wie in `zuordnung-fremd.ts`. */
function adresseVon(schluessel: string, e: ZuordnungEintrag): string {
  return e.plattform === 'primevideo' && e.seite ? amazonTitelAdresse(e.seite) : schluessel.split('#')[0]!
}

/**
 * **Dieselbe Seite an Titeln verschiedener Reihen** (29.10.2026): Zuordnungen, bei denen zwei Kennungen mit unterschiedlicher
 * `franchiseId` an derselben Adresse liegen. Staffeln derselben Reihe teilen sich eine Seite legitim (Stand 29.10.2026:
 * 37 Seiten, alle gleiche Reihe — Bleach, Pocket Monsters, Netflix-Sammelseiten) und zählen nicht; Such- und Startseiten auch nicht.
 * `franchiseVon` liefert undefined für unbekannte Kennungen: die zählen nicht (keine Behauptung ohne Wissen).
 */
export function findeGeteilteSeiten(
  zugeordnet: readonly [string, ZuordnungEintrag][],
  franchiseVon: (titleId: number) => number | undefined,
  staffelVon: (titleId: number, adresse: string) => number | undefined,
): GeteilteSeite[] {
  const nachKern = new Map<string, { adresse: string; ids: Set<number> }>()
  for (const [schluessel, e] of zugeordnet) {
    const adresse = adresseVon(schluessel, e)
    const kern = adressKern(adresse)
    if (istSammelKern(kern)) continue
    const stelle = nachKern.get(kern) ?? { adresse, ids: new Set<number>() }
    stelle.ids.add(e.titleId)
    nachKern.set(kern, stelle)
  }
  const treffer: GeteilteSeite[] = []
  for (const { adresse, ids } of nachKern.values()) {
    const besitzer = [...ids].flatMap((titleId) => {
      const franchiseId = franchiseVon(titleId)
      return franchiseId === undefined ? [] : [{ titleId, franchiseId, staffel: staffelVon(titleId, adresse) }]
    })
    if (new Set(besitzer.map((b) => b.franchiseId)).size > 1) treffer.push({ adresse, besitzer })
  }
  return treffer
}

/** Eine Zeile je Fund: beide Besitzer samt Reihe und, wo ableitbar, „laut Adresse Staffel k“. */
export function beschreibeGeteilte(t: GeteilteSeite): string {
  const teile = t.besitzer.map((b) => `${b.titleId} (Reihe ${b.franchiseId}${b.staffel === undefined ? '' : `, laut Adresse Staffel ${b.staffel}`})`)
  return `${t.adresse}: ${teile.join(' und ')}`
}

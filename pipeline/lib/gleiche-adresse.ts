/**
 * **Dieselbe Amazon-Seite an zwei verschieden benannten Titeln** (Made in Abyss B0CWLSM344 an 97986 und 114745, Prüfer 1614):
 * Eine Prime-Seite gehört genau einem Titel (Zuordnung über die Folgenzahl, `data/prime-zugeordnet.json`). Steht ein Handbeleg
 * in `data/dub-confirmed.yaml` an einer Seite, die die Zuordnung einem anderen Titel gibt, ist das ein Fehlbeleg.
 * Nicht erfasst (kein Eigentümer bekannt oder Franchise-Seite): Netflix-/Disney+-/ADN-Serienseiten tragen laut Projektregel
 * mehrere Staffeln, und Amazon-Seiten ohne Eintrag in der Zuordnung lassen sich ohne Abruf nicht entscheiden.
 * `data/gleiche-adresse-stand.json` hält die Adressen des Standes; die Zahl darf nur sinken (Ratsche).
 */
import { adressKern } from '../../shared/adresse-kern.ts'

export interface GleicheAdresseStand {
  stand: string
  hoechstens: number
  adressen: string[]
}
export interface BelegKurz {
  anilistId?: number
  url?: string
}
export interface ZuordnungKurz {
  titleId?: number
  seite?: string
}
export interface GleicheAdresseBilanz {
  /** Amazon-Seiten mit Beleg an ≥ 2 Titeln, von denen mindestens einer nicht der Eigentümer ist. */
  fehl: string[]
  neu: string[]
  erledigt: string[]
  ueberGrenze: boolean
}

/** Eigentümer je Amazon-Seite (Adresskern) laut Zuordnung: Schlüssel und Feld `seite` zeigen beide auf den Titel. */
export function eigentuemer(zuordnung: Record<string, ZuordnungKurz>): Map<string, Set<number>> {
  const aus = new Map<string, Set<number>>()
  const merke = (kern: string, id: number | undefined): void => {
    if (!kern.startsWith('amazon:') || id === undefined) return
    const menge = aus.get(kern) ?? new Set<number>()
    menge.add(id)
    aus.set(kern, menge)
  }
  for (const [schluessel, z] of Object.entries(zuordnung)) {
    merke(adressKern(schluessel), z.titleId)
    if (z.seite) merke(adressKern(`https://www.amazon.de/dp/${z.seite}`), z.titleId)
  }
  return aus
}

/** Kerne der Amazon-Seiten (nur dort gibt es Eigentümer, `eigentuemer()`), an denen Belege zu mehreren Titeln hängen und ein Titel nicht Eigentümer ist. */
export function fehlDoppelungen(belege: BelegKurz[], zuordnung: Record<string, ZuordnungKurz>): string[] {
  const besitzer = eigentuemer(zuordnung)
  const je = new Map<string, Set<number>>()
  for (const b of belege) {
    if (!b.url || b.anilistId === undefined) continue
    const kern = adressKern(b.url)
    const menge = je.get(kern) ?? new Set<number>()
    menge.add(b.anilistId)
    je.set(kern, menge)
  }
  const fehl: string[] = []
  for (const [kern, ids] of je) {
    const eigen = besitzer.get(kern)
    if (ids.size >= 2 && eigen && [...ids].some((i) => !eigen.has(i))) fehl.push(kern)
  }
  return fehl.sort()
}

export function gleicheAdresseBilanz(belege: BelegKurz[], zuordnung: Record<string, ZuordnungKurz>, stand: GleicheAdresseStand): GleicheAdresseBilanz {
  const fehl = fehlDoppelungen(belege, zuordnung)
  const bekannt = new Set(stand.adressen)
  const jetzt = new Set(fehl)
  return {
    fehl,
    neu: fehl.filter((k) => !bekannt.has(k)),
    erledigt: stand.adressen.filter((k) => !jetzt.has(k)),
    ueberGrenze: fehl.length > stand.hoechstens,
  }
}

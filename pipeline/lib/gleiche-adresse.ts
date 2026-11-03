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
  /** Echte Sammelseiten (Serie plus Beiläufer, z. B. 13 Folgen plus 4 OVAs): kein Fehlbeleg, wenn genau diese Titel Belege dort haben und ihre Folgen die Seitenzahl ergeben. */
  erlaubt?: ErlaubteSeite[]
}
export interface ErlaubteSeite {
  adresse: string
  /** Kennungen (Titel-id) der Titel, die sich die Seite teilen. */
  titel: number[]
  /** Folgenzahl der Seite; muss die Summe der `episodes` dieser Titel sein. */
  folgen: number
  grund: string
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
  /** Erlaubte Seiten ohne Doppelung mehr (Belege weg oder Zuordnung geändert): Eintrag in `erlaubt` streichen. */
  veraltet: string[]
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

/** Kennungen mit Beleg je Adresskern. */
function belegteTitel(belege: BelegKurz[]): Map<string, Set<number>> {
  const je = new Map<string, Set<number>>()
  for (const b of belege) {
    if (!b.url || b.anilistId === undefined) continue
    const kern = adressKern(b.url)
    je.set(kern, (je.get(kern) ?? new Set<number>()).add(b.anilistId))
  }
  return je
}

/** Eine erlaubte Seite gilt nur, solange genau ihre Titel Belege dort haben und deren Folgen die Seitenzahl ergeben. */
function erlaubtGilt(e: ErlaubteSeite, belegt: Set<number> | undefined, folgen: Record<number, number>): boolean {
  if (!belegt || belegt.size !== e.titel.length || !e.titel.every((i) => belegt.has(i))) return false
  if (e.titel.some((i) => folgen[i] === undefined)) return false
  return e.titel.reduce((summe, i) => summe + folgen[i]!, 0) === e.folgen
}

export function gleicheAdresseBilanz(
  belege: BelegKurz[],
  zuordnung: Record<string, ZuordnungKurz>,
  stand: GleicheAdresseStand,
  folgen: Record<number, number>,
): GleicheAdresseBilanz {
  const alle = fehlDoppelungen(belege, zuordnung)
  const belegt = belegteTitel(belege)
  const eintraege = stand.erlaubt ?? []
  const gilt = new Set(eintraege.filter((e) => erlaubtGilt(e, belegt.get(e.adresse), folgen)).map((e) => e.adresse))
  const fehl = alle.filter((k) => !gilt.has(k))
  const veraltet = eintraege.map((e) => e.adresse).filter((k) => !alle.includes(k)).sort()
  const bekannt = new Set(stand.adressen)
  const jetzt = new Set(fehl)
  return {
    fehl,
    neu: fehl.filter((k) => !bekannt.has(k)),
    erledigt: stand.adressen.filter((k) => !jetzt.has(k)),
    veraltet,
    ueberGrenze: fehl.length > stand.hoechstens,
  }
}

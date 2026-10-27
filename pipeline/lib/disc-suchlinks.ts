/**
 * **Disc-Kauflinks, die nur eine Namenssuche bei Amazon sind** (Daniel, 27.10.2026): Der Bestand darf davon nur weniger haben.
 * `data/disc-suchlinks-stand.json` hält die Slugs des Standes; jede Namenssuche außerhalb davon oder über `hoechstens` ist neu.
 * Lehre: Eine Suche war als Rückfall dokumentiert und deshalb nie ein Fehler (148 von 193 Discs, Conan Box 1: 616 Treffer); eine
 * Kennzahl ohne Ratsche sinkt nicht von selbst.
 */
import { amazonLinkArt } from '../../shared/plattform-suche.ts'

export interface SuchlinkStand {
  stand: string
  hoechstens: number
  slugs: string[]
}
interface ReleaseKurz {
  slug: string
  releaseType: string
  buyUrl?: string
}
export interface SuchlinkBilanz {
  anzahl: number
  /** Namenssuchen, die der Stand nicht kennt. */
  neu: ReleaseKurz[]
  /** Slugs des Standes, die keine Namenssuche mehr sind (Liste darf gekürzt werden). */
  erledigt: string[]
  ueberGrenze: boolean
}

export function suchlinkBilanz(releases: ReleaseKurz[], stand: SuchlinkStand): SuchlinkBilanz {
  const suchen = releases.filter((r) => r.releaseType === 'disc' && amazonLinkArt(r.buyUrl) === 'name')
  const bekannt = new Set(stand.slugs)
  const jetzt = new Set(suchen.map((r) => r.slug))
  return {
    anzahl: suchen.length,
    neu: suchen.filter((r) => !bekannt.has(r.slug)),
    erledigt: stand.slugs.filter((s) => !jetzt.has(s)),
    ueberGrenze: suchen.length > stand.hoechstens,
  }
}

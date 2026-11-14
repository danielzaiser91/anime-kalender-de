import { type PlatformId, type Title } from '../../shared/types.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { type Zugangsart } from '../../shared/zugangsart.ts'
import { type TmdbTitelEintrag, type AnisearchEintrag } from './01-quellen.ts'
import { ergaenzeCrAusVorschlaegen } from './09-3-4-cr-vorschlaege.ts'
import { ersetzePrimeSuchlinks } from './09-3-3-prime-suchlinks.ts'
import { entferneToteKaufwege } from './09-3-2-kaufwege-tot.ts'
import { pflegeWegeNachBelegen } from './09-3-1-wege-pflegen.ts'
import { uebernehmePrimeMeldungen } from './09-3-0-prime-meldungen.ts'

export function uebernehmePrimeUndCrVorschlaege({
  titles,
  checks,
  alleChecks,
  lautPruefungTot,
  tmdbTitles,
  ytKanal,
  zugangJeAdresse,
  joynZugang,
  ytKauf,
  geprueft,
  entfernt,
  ytAusTonspur,
  adressen,
  totEntfernt,
  ytEntfernt,
  linkBefunde,
  checksJePlattform,
  anisearch,
  belegFuer,
}: {
  titles: Map<number, Title>
  checks: Map<string, DubCheck>
  alleChecks: DubCheck[]
  lautPruefungTot: (url: string) => boolean
  tmdbTitles: Record<string, TmdbTitelEintrag>
  ytKanal: Record<string, string>
  zugangJeAdresse: Map<string, 'abo' | 'kauf'>
  joynZugang: Map<string, Zugangsart>
  ytKauf: Set<string>
  geprueft: number
  entfernt: number
  ytAusTonspur: number
  adressen: number
  totEntfernt: number
  ytEntfernt: number
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  checksJePlattform: Map<string, DubCheck[]>
  anisearch: Record<string, AnisearchEintrag>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
}) {
  uebernehmePrimeMeldungen({ titles, checks, alleChecks, lautPruefungTot, checksJePlattform })
  pflegeWegeNachBelegen({ titles, tmdbTitles, ytKanal, zugangJeAdresse, joynZugang, ytKauf, checks, geprueft, entfernt, ytAusTonspur, adressen, totEntfernt, ytEntfernt })

  entferneToteKaufwege({ titles, linkBefunde })

  ersetzePrimeSuchlinks({ titles, linkBefunde, checksJePlattform, anisearch, lautPruefungTot, belegFuer })

  ergaenzeCrAusVorschlaegen({ titles, checks })
}

import { type DubCheck } from '../lib/dub-confirmed.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { fuehreAusgabenZusammen } from './11-4-ausgaben.ts'
import { bereinigeWege } from './11-3-bereinigung.ts'
import { ergaenzeWegeAusJustwatch } from './11-2-justwatch.ts'
import { ergaenzeDiscUndZugang } from './11-1-disc-und-zugang.ts'

export function schliesseWegeAb({
  titles,
  anisearch,
  releases,
  zugangJeAdresse,
  tmdbMehrdeutig,
  toteAdressen,
  linkBefunde,
  verweiseEntfernt,
  crAdresseZu,
  beantworteteSuchen,
  suchOffen,
  alleChecks,
  lautPruefungTot,
  checksJePlattform,
}: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  releases: Release[]
  zugangJeAdresse: Map<string, 'abo' | 'kauf'>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  verweiseEntfernt: EntfernterVerweis[]
  crAdresseZu: (name: string) => string | undefined
  beantworteteSuchen: Set<string>
  suchOffen: { id: number; titel: string; plattform: string; url: string; }[]
  alleChecks: DubCheck[]
  lautPruefungTot: (url: string) => boolean
  checksJePlattform: Map<string, DubCheck[]>
}) {
  ergaenzeDiscUndZugang({ titles, anisearch, releases, zugangJeAdresse })

  ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig, toteAdressen })

  bereinigeWege({
    titles,
    anisearch,
    toteAdressen,
    linkBefunde,
    verweiseEntfernt,
    crAdresseZu,
    beantworteteSuchen,
    suchOffen,
  })

  fuehreAusgabenZusammen({ alleChecks, titles, tmdbMehrdeutig, anisearch, lautPruefungTot, checksJePlattform })
}

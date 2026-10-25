import { laufendJeAnbieter, laufendSchluessel, ordneShowsZu, tmdbZuordnung, uebernehmbar, type MotnBeleg, type MotnDaten } from '../lib/motn.ts'
import { bewerteTreffer, passtZuSerie, staffelnDesFranchise, volltreffer } from '../lib/adn.ts'
import { motnTonSchluessel } from '../lib/belegstaerke.ts'
import { log } from '../lib/util.ts'
import type { Release, Title } from '../../shared/types.ts'

/**
 * Setzt `dub: true` an Verweise ohne Urteil, wo die Streaming-Availability-API eindeutig Deutsch nennt (Regeln in `09-5-weitere-quellen.ts`).
 * `motnTon` merkt sich jeden so belegten Verweis (`motnTonSchluessel`): Die Belegstärke zählt ihn nur als mittlere Quelle.
 */
export function uebernehmeMotnBelege({ belege, titles, laeuft, heute }: {
  belege: MotnBeleg[]
  titles: Map<number, Title>
  laeuft: ReadonlySet<string>
  heute: string
}): { motnBelege: number; motnTon: Set<string>; ausgelassenLaufend: number } {
  const motnTon = new Set<string>()
  let ausgelassenLaufend = 0
  for (const beleg of belege) {
    const laeuftBei = laeuft.has(laufendSchluessel(beleg.titleId, beleg.platform))
    if (beleg.deutsch && beleg.eindeutig && laeuftBei) ausgelassenLaufend++
    if (!uebernehmbar(beleg, laeuftBei, heute)) continue
    const stream = titles.get(beleg.titleId)?.streams.find((s) => s.platform === beleg.platform)
    if (!stream || stream.dub !== undefined) continue
    stream.dub = true
    motnTon.add(motnTonSchluessel(beleg.titleId, stream.url))
  }
  return { motnBelege: motnTon.size, motnTon, ausgelassenLaufend }
}

/** Ordnet die Serien der Quelle unseren Titeln zu und übernimmt die Belege; ohne Serien im Katalog geschieht nichts. */
export function werteMotnAus({ motn, tmdbTitles, titles, releases, heute }: {
  motn: MotnDaten
  tmdbTitles: Parameters<typeof tmdbZuordnung>[0]
  titles: Map<number, Title>
  releases: Release[]
  heute: string
}): { motnBelege: number; motnTon: Set<string> } {
  if (!Object.keys(motn.shows ?? {}).length) return { motnBelege: 0, motnTon: new Set() }
  /* Läuft zu diesem Titel bei diesem Anbieter gerade etwas? Immer gegen heute gerechnet (`shared/logic.ts`), nie gespeichert. */
  const laeuft = laufendJeAnbieter(releases, heute)
  const alle = [...titles.values()]
  const belege = ordneShowsZu(
    alle,
    motn.shows,
    (t) => (t.franchiseId ? staffelnDesFranchise(alle, t.franchiseId) : []),
    { passtZuSerie, bewerteTreffer, volltreffer },
    tmdbZuordnung(tmdbTitles, motn.tmdb),
  )
  const { motnBelege, motnTon, ausgelassenLaufend } = uebernehmeMotnBelege({ belege, titles, laeuft, heute })
  log(
    `${motnBelege} Synchro-Angaben über die Streaming Availability API belegt ` +
      `(${Object.keys(motn.shows).length} Serien im Bestand, ${ausgelassenLaufend} laufende ausgelassen)`,
  )
  return { motnBelege, motnTon }
}

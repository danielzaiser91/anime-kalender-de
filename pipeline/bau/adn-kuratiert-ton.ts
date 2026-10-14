import { istKeineTitelseite } from './11-7-wege-aus-terminen.ts'
import { type AdnData, type AdnShow } from '../lib/adn.ts'
import { type Release, type Title } from '../../shared/types.ts'

const SERIE_IN_ADRESSE = /\/de\/video\/(\d+)(?:[-/?#]|$)/

/** Die ADN-Serienkennung aus der Adresse eines kuratierten Termins (`…/de/video/1423-eighty-six`). */
function serienKennung(release: Release): number | undefined {
  const treffer = SERIE_IN_ADRESSE.exec(release.platformUrl ?? '')
  return treffer ? Number(treffer[1]) : undefined
}

/**
 * **Ein kuratierter ADN-Termin, den ADNs Kalender am selben Tag mit `vde` führt, belegt die Synchro seines Titels** (14.10.2026, 86 EIGHTY-SIX).
 * `ergaenzeAdnTitelAusDaten` baut zu einer Serie, deren Name einem kuratierten Termin gleicht, weder Termin noch Weg (Vorrang des Handeintrags); der Weg kam
 * dann erst als „Weg aus einem Termin“ ohne Tonurteil (`11-7-wege-aus-terminen.ts`), obwohl `vde` an allen 23 Folgen im eigenen Archiv steht.
 * Hier bekommt der Titel den ADN-Weg mit `dub: true`: nur wenn eine Folge der Serie mit `vde` auf den Starttag des Termins fällt und dieser Tag nicht in der
 * Zukunft liegt (ein angekündigter Termin ist keine verfügbare Fassung) — so wie bei den ADN-eigenen Terminen. Ein vorhandener ADN-Weg bleibt unberührt.
 * Gibt zurück, wie viele Wege entstanden sind.
 */
export function belegeTonKuratierterAdnTermine(releases: Release[], titles: Map<number, Title>, shows: AdnShow[], heute: string): number {
  let belegt = 0
  for (const release of releases) {
    const titel = titles.get(release.titleId)
    const kennung = serienKennung(release)
    const tag = release.schedule.firstEpisodeDate
    if (release.platform !== 'adn' || !titel || kennung === undefined || tag > heute) continue
    if (titel.streams.some((s) => s.platform === 'adn')) continue
    const show = shows.find((s) => s.showId === kennung)
    if (!show?.episodes.some((e) => e.date === tag)) continue
    const url = release.platformUrl && !istKeineTitelseite(release.platformUrl) ? release.platformUrl : show.url
    titel.streams.push({ platform: 'adn', url, dub: true })
    belegt++
  }
  return belegt
}

/** Die Serien aus Kalender und Katalog, der Kalender gewinnt (wie in `ergaenzeAdnTitelAusDaten`). */
export function adnShowsAusKalenderUndKatalog(kalender: AdnData, katalog: AdnData): AdnShow[] {
  const imKalender = new Set(kalender.shows.map((s) => s.showId))
  return [...kalender.shows, ...katalog.shows.filter((s) => !imKalender.has(s.showId))]
}

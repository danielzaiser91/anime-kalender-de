import { anisearchKanonisch, anisearchSeite } from '../lib/anisearch-seite.ts'
import { type Title } from '../../shared/types.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'
import { type SynopsisEintrag } from './13-1-anreichern.ts'

/**
 * Der Eintrag eines Titels in `public/data/synopses/`: englische Fassung, dazu die deutsche mit Quelle (aniSearch vor TMDB); ohne beide Texte kein Eintrag.
 * Wo aniSearch den Text nicht stellt, steht der Weg zur aniSearch-Seite in `asUrl`.
 */
export function synopseVon({ t, asId, ausAnisearch, ausTmdb, trenneQuelle }: {
  t: Title
  asId: number | undefined
  ausAnisearch: string | undefined
  ausTmdb: TmdbTitelEintrag | undefined
  trenneQuelle: (text: string) => { text: string; url?: string }
}): SynopsisEintrag | undefined {
  if (!(t.synopsis || ausAnisearch || ausTmdb?.overviewDe)) return undefined
  const eintrag: SynopsisEintrag = { en: t.synopsis }
  if (ausAnisearch) {
    const { text, url } = trenneQuelle(ausAnisearch)
    eintrag.de = text
    eintrag.deSource = { name: 'anisearch.de', url: url ? anisearchKanonisch(url) : (anisearchSeite(asId) ?? 'https://www.anisearch.de/') }
  } else if (ausTmdb?.overviewDe) {
    eintrag.de = ausTmdb.overviewDe
    eintrag.deSource = {
      name: 'themoviedb.org',
      url: ausTmdb.tmdbId
        ? `https://www.themoviedb.org/${ausTmdb.kind === 'movie' ? 'movie' : 'tv'}/${ausTmdb.tmdbId}`
        : 'https://www.themoviedb.org/',
    }
  }
  if (!ausAnisearch && asId !== undefined) eintrag.asUrl = anisearchSeite(asId)
  return eintrag
}

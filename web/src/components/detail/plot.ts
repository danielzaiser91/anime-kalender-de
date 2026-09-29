import { type Synopsis } from '../../lib/data.ts'
import { type FranchiseMember } from '@shared/types.ts'

export function plotVon({ synopsis, titleId, ersatz }: {
  synopsis: Synopsis | undefined
  titleId: number
  ersatz: { plot: Synopsis; von: FranchiseMember; } | undefined
}) {
  const plot = (() => {
    if (synopsis?.de) {
      return {
        text: synopsis.de,
        fallback: false,
        quelle: synopsis.deSource ?? { name: 'anisearch.de', url: 'https://www.anisearch.de/' },
      }
    }
    if (synopsis?.en) {
      // Die englische Fassung kommt immer von AniList — dort steht auch der Titel.
      return {
        text: synopsis.en,
        fallback: true,
        quelle: { name: 'anilist.co', url: `https://anilist.co/anime/${titleId}` },
      }
    }
    if (!ersatz) return undefined
    // Der Ersatz aus der Reihe — mit Hinweis, von welchem Teil er stammt.
    return {
      text: ersatz.plot.de ?? ersatz.plot.en!,
      fallback: !ersatz.plot.de,
      vonTeil: ersatz.von,
      quelle: ersatz.plot.de
        ? (ersatz.plot.deSource ?? { name: 'anisearch.de', url: 'https://www.anisearch.de/' })
        : { name: 'anilist.co', url: `https://anilist.co/anime/${ersatz.von.id}` },
    }
  })()
  return { plot }
}

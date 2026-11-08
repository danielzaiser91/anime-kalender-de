import type { Title } from '../../shared/types.ts'
import { anzeigeName } from '../../shared/titles.ts'
import type { CrSerie } from '../lib/crunchyroll-dub.ts'
import { crunchyrollSeriesId } from '../lib/crunchyroll.ts'
import { blockWahl } from '../../tools/cr-blockwahl.mjs'
import { katalogStaffeln } from './widerlegung-staffel.ts'

/** Die Namen, unter denen ein Titel im Katalog stehen kann (Anzeige, Englisch, Romaji, Deutsch). */
function namenDesTitels(t: Title): string[] {
  return [anzeigeName(t), t.titleEn, t.titleRomaji, t.titleDe].filter((n): n is string => Boolean(n))
}

/**
 * Der Katalogblock dieses Titels an der Crunchyroll-Serie `kennung` samt Weg (`blockWahl`); `termin.folgen` ist die belegte Folgenzahl des
 * OmU-Termins (sonst zählt die des Titels), `termin.ab` sein Berliner Starttag. Geteilt heißt: ein anderer Titel hat einen Weg zu derselben Serie.
 */
export function blockWahlFuer(title: Title, titles: Map<number, Title>, kennung: string, serien: CrSerie[], termin: { folgen?: number; ab?: string } = {}) {
  const geteilt = [...titles.values()].some(
    (x) => x.id !== title.id && x.streams.some((s) => s.platform === 'crunchyroll' && crunchyrollSeriesId(s.url) === kennung),
  )
  return blockWahl(serien, kennung, { nummern: katalogStaffeln(title, titles, kennung), namen: namenDesTitels(title), folgen: termin.folgen ?? title.episodes, geteilt, ab: termin.ab })
}

import { normalizeTitle } from '../lib/crunchyroll.ts'
import type { AdnShow } from '../lib/adn.ts'
import type { Title } from '../../shared/types.ts'

/** Der Anime zu einer ADN-Show: Katalogkennung, dann Name, dann Originalname. */
export function titelZurShow(show: AdnShow, titles: Map<number, Title>, titleByName: Map<string, Title>): Title | undefined {
  return (
    (show.anilistId ? titles.get(show.anilistId) : undefined) ??
    titleByName.get(normalizeTitle(show.title)) ??
    titleByName.get(normalizeTitle(show.originalTitle ?? ''))
  )
}

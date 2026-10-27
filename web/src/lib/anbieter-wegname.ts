import type { PlatformId } from '@shared/types.ts'

/**
 * Schreibweisen, unter denen JustWatch/TMDB einen Anbieter als Bezugsweg (`watchLinks[].name`) führen, obwohl wir ihn
 * als Plattform kennen. Der Schlüssel ist klein geschrieben, ohne Klammerzusatz und ohne „über …“.
 */
const ALIASE: Record<string, PlatformId> = {
  'disney plus': 'disneyplus',
  'animation digital network': 'adn',
  'rtl+': 'rtlplus',
  'netflix standard with ads': 'netflix',
  'paramount+': 'paramountplus',
}

/** Die Plattform hinter dem Namen eines Bezugswegs, wenn er nur anders geschrieben ist als in `PLATFORMS`. */
export function plattformVonWegName(name: string): PlatformId | undefined {
  const kern = name.toLowerCase().replace(/\s*\(.*$/, '').replace(/\s+über\s.*$/, '').trim()
  return ALIASE[kern]
}

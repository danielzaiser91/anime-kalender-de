/**
 * Gegenprobe zu "Bleach: Memories of Nobody" (12.10.2026): ADN-Filme finden ihren AniList-Film trotz anderer
 * Schreibweise (`bau/adn-show-titel.ts`), und kein Release/Termin ohne Titel bleibt im Kalender (`bau/ohne-titel.ts`).
 * Die Namen sind die echten aus `data/adn.json` (Kalender 11.10.2026) und `public/data/titles.json`.
 */
import { filmSchluessel, filmZurShow } from './bau/adn-show-titel.ts'
import { entferneOhneTitel } from './bau/ohne-titel.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const film = (id: number, titleRomaji: string, format = 'MOVIE'): Title => ({ id, titleRomaji, format }) as unknown as Title
const folgen = (type: string) => [{ type, date: '2026-10-12', time: '09:00', url: 'x' }]
const bleach1 = film(1686, 'BLEACH: MEMORIES OF NOBODY MOVIE')
const bleach2 = film(2889, 'BLEACH: The DiamondDust Rebellion - Mou Hitotsu no Hyourinmaru')
const show = { title: 'Bleach: Memories of Nobody - Movie 1', originalTitle: 'Gekijōban Bleach: Memories of Nobody', episodes: folgen('MOV') }

console.log('\nADN-Film unter anderer Schreibweise:')
pruefe('Schlüssel: Gekijōban vorn und Movie 1 hinten fallen weg', filmSchluessel('Gekijōban Bleach: Memories of Nobody') === 'bleach memories of nobody' && filmSchluessel('BLEACH: MEMORIES OF NOBODY MOVIE') === 'bleach memories of nobody')
pruefe('Bleach Movie 1 findet Titel 1686', filmZurShow(show, [bleach2, bleach1])?.id === 1686)
pruefe('Serie (EPS) wird nie einem Film zugeordnet', filmZurShow({ ...show, episodes: folgen('EPS') }, [bleach1]) === undefined)
pruefe('Serie als Format TV wird nicht gewählt', filmZurShow(show, [film(1, 'BLEACH: MEMORIES OF NOBODY MOVIE', 'TV')]) === undefined)
pruefe('zwei Filme mit demselben Schlüssel: keiner', filmZurShow(show, [bleach1, film(2, 'Bleach Memories of Nobody')]) === undefined)
pruefe('anderer Film bleibt unberührt', filmZurShow(show, [bleach2]) === undefined)

console.log('\nKein Release/Termin ohne Titel im Kalender:')
{
  const releases = [{ slug: 'adn-197', titleId: -1, name: 'Bleach', platform: 'adn' }, { slug: 'a', titleId: 5, name: 'A', platform: 'adn' }, { slug: 'c', titleId: -5, name: 'C', platform: 'tv' }]
  const events = [{ releaseSlug: 'adn-197', titleId: -1, name: 'Bleach', platform: 'adn' }, { releaseSlug: 'a', titleId: 5, name: 'A', platform: 'adn' }]
  entferneOhneTitel(releases, events)
  pruefe('Release mit titleId -1 ist weg, Cartoon (-5) und Anime bleiben', releases.map((r) => r.slug).join() === 'a,c', releases)
  pruefe('Termin mit titleId -1 ist weg', events.length === 1 && events[0]!.releaseSlug === 'a', events)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)

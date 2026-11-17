/**
 * Zusicherungen zu `blockPasstInTitel` (`lib/adn.ts`) und seiner Verdrahtung in `bau/07-adn.ts` (Mängelregister, Dorohedoro 105228 → 173172):
 * ADN führt Staffel 2 unter derselben Serienkennung mit durchgezählten Folgen (13–23). Ein einzelner Block, dessen Nummern über der
 * Folgenzahl des Serientitels liegen, gehört in die Staffelsuche und nicht an die erste Staffel. Erfundene Kennungen, Kulisse unter `AK_ROOT`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import { normalizeTitle } from './lib/crunchyroll.ts'
import type { AdnBlock, AdnEpisode, AdnShow } from './lib/adn.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'adn-durchgezaehlt-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (t: Partial<Title> & { id: number }): Title => ({ franchiseId: 905, format: 'TV', keywords: [], genres: [], streams: [], ...t }) as unknown as Title
const block = (von: number, bis: number): AdnBlock => {
  const nummern = Array.from({ length: bis - von + 1 }, (_, i) => von + i)
  return { episodes: nummern.map((n) => ({ episode: n }) as AdnEpisode), nummern } as unknown as AdnBlock
}

try {
  const { blockPasstInTitel } = await import('./lib/adn.ts')
  console.log('\nblockPasstInTitel')
  const s1 = titel({ id: 905, episodes: 12 })
  pruefe('Folgen 1–12 bei 12 Folgen: passt', blockPasstInTitel(block(1, 12), s1))
  pruefe('Folgen 1–11 bei 12 Folgen (ADN zählt eine weniger): passt', blockPasstInTitel(block(1, 11), s1))
  pruefe('Folgen 13–23 bei 12 Folgen: Nummern über der Folgenzahl, passt nicht (Dorohedoro 2)', !blockPasstInTitel(block(13, 23), s1))
  pruefe('Folgen 2–13 bei 12 Folgen: letzte Nummer genau eins darüber, passt nicht', !blockPasstInTitel(block(2, 13), s1))
  pruefe('Folgen 1–13 bei 12 Folgen: mehr Folgen als der Titel, passt nicht', !blockPasstInTitel(block(1, 13), s1))
  const doppelt = { episodes: Array.from({ length: 13 }, () => ({}) as AdnEpisode), nummern: Array.from({ length: 12 }, (_, i) => i + 1) } as unknown as AdnBlock
  pruefe('13 Folgen mit doppelter Nummer (Nummern 1–12) bei 12 Folgen: mehr Folgen als der Titel, passt nicht', !blockPasstInTitel(doppelt, s1))
  pruefe('Titel ohne Folgenzahl: passt nicht', !blockPasstInTitel(block(1, 12), titel({ id: 907 })))
  pruefe('ohne Titel: passt nicht', !blockPasstInTitel(block(1, 12), undefined))
  pruefe('Block ohne Folgen und ohne Nummern bei einem Titel mit 0 Folgen: passt', blockPasstInTitel({ episodes: [], nummern: [] } as unknown as AdnBlock, titel({ id: 908, episodes: 0 })))

  console.log('\nVerdrahtung: ergaenzeAdnTitel mit einer Serie, deren Folgen 13–23 nur Staffel 2 sind')
  const folgen = (von: number, bis: number): AdnEpisode[] =>
    Array.from({ length: bis - von + 1 }, (_, i) => ({ date: `2026-04-${String(1 + 7 * i).padStart(2, '0')}`, time: '16:00', episode: von + i, season: '2', url: `https://animationdigitalnetwork.com/de/video/9905-erfunden/9${von + i}-folge-${von + i}` })).map((e, i) => (i >= 4 ? { ...e, date: `2026-05-${String(1 + 7 * (i - 4)).padStart(2, '0')}` } : e)) as AdnEpisode[]
  const show = (von: number, bis: number): AdnShow => ({ showId: 9905, title: 'Erfunden Dorohedoro', url: '', episodes: folgen(von, bis), batch: false })
  const alle = [titel({ id: 905, titleRomaji: 'Erfunden Dorohedoro', episodes: 12, jpYear: 2020 }), titel({ id: 906, titleRomaji: 'Erfunden Dorohedoro Staffel Zwei', episodes: 11, jpYear: 2026, format: 'ONA' })]
  const { ergaenzeAdnTitel } = await import('./bau/07-adn.ts')
  const baue = (von: number, bis: number): Release[] => {
    writeFileSync(join(wurzel, 'data', 'adn.json'), JSON.stringify({ scrapedAt: '2026-11-16T05:00:00Z', window: { from: '', to: '' }, shows: [show(von, bis)] }))
    const gebaut: Release[] = []
    ergaenzeAdnTitel({ titles: new Map(alle.map((t) => [t.id, t])), releases: gebaut, titleByName: new Map([[normalizeTitle('Erfunden Dorohedoro'), alle[0]!]]), seenSlugs: new Set() })
    return gebaut
  }
  const zwei = baue(13, 23)
  pruefe('13–23 (11 Folgen): ein Termin, an Staffel 2 (906)', zwei.length === 1 && zwei[0]!.titleId === 906, zwei.map((r) => [r.slug, r.titleId]))
  const eins = baue(1, 12)
  pruefe('1–12 (12 Folgen): ein Termin, an Staffel 1 (905)', eins.length === 1 && eins[0]!.titleId === 905, eins.map((r) => [r.slug, r.titleId]))
  const elf = baue(1, 11)
  pruefe('1–11 (eine Folge weniger als der Titel): bleibt an Staffel 1', elf.length === 1 && elf[0]!.titleId === 905, elf.map((r) => [r.slug, r.titleId]))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(`\nADN: durchgezählte Staffel — ${faelle} Fälle, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)

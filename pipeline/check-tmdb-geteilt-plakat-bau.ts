/**
 * Verdrahtung: `ladeQuellen()` (Bau, Phase 01) setzt die geteilten Filme, danach liefern Cover-, Großplakat- und Banner-Leser nichts für sie.
 * Läuft gegen eine Wegwerf-Wurzel (`AK_ROOT`). Aufruf: `npm run check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SynopsisEintrag } from './bau/13-1-anreichern.ts'
import type { Title } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'ak-geteilt-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data'), { recursive: true })
const schreibe = (name: string, daten: unknown): void => writeFileSync(join(wurzel, 'data', name), JSON.stringify(daten))
const film = { tmdbId: 904759, kind: 'movie' }
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
for (const y of ['kino-ankuendigungen.yaml', 'anisearch-ids-hand.yaml']) writeFileSync(join(wurzel, 'data', y), '[]')
mkdirSync(join(wurzel, 'data', 'cache'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'cache', 'anilist-by-id.json'), '{"1":{"id":1}}')
schreibe('tmdb-titles.json', { '900001': film, '900002': film, '900003': { tmdbId: 5, kind: 'movie' } })
const plakat = { p: '/k.jpg', w: 2000, h: 3000 }
schreibe('tmdb-poster.json', { '900001': plakat, '900002': plakat, '900003': plakat })
schreibe('tmdb-banner.json', { '900001': plakat, '900002': plakat, '900003': plakat })

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

try {
  const { ladeQuellen } = await import('./bau/01-quellen.ts')
  const { coverFuer } = await import('./bau/cover-regel.ts')
  const { bannerNachRegel } = await import('./bau/produkt-regel.ts')
  const { ergaenzeCoverGross } = await import('./bau/cover-gross.ts')
  console.log('\nTMDB-Plakat geteilter Filme im Bau')
  ladeQuellen()
  const syn: Record<number, SynopsisEintrag> = {}
  ergaenzeCoverGross(syn, [900001, 900002, 900003].map((id) => ({ id }) as Title))
  pruefe('Cover: geteilter Film ohne Plakat, anderer Titel mit', coverFuer(900001, undefined) === undefined && coverFuer(900002, 'bisher') === 'bisher' && coverFuer(900003, undefined)?.endsWith('/k.jpg') === true)
  pruefe('Banner: geteilter Film fällt auf AniList zurück, anderer Titel mit TMDB', bannerNachRegel(900001, 'anilist') === 'anilist' && bannerNachRegel(900003, 'anilist') !== 'anilist')
  pruefe('Großplakat (cg): nur der Titel mit eigenem Film', !syn[900001]?.cg && !syn[900002]?.cg && Boolean(syn[900003]?.cg), syn)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
console.log('TMDB-Plakat geteilter Filme im Bau: 3 Zusicherungen ✓')

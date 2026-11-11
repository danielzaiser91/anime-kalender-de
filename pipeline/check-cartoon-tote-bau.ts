/**
 * Verdrahtung tote TMDB-Kennungen im Bau (`lib/cartoon-aufnahme.ts` `ohneTote`): Die Leser von `data/cartoons.json` in `bau/08-news-tv.ts`
 * (Anime2You-Meldung → Termin) und `bau/cartoon-zu-anime.ts` (Anbieter des Cartoons für den Anime-Zwilling) sehen keinen Eintrag mit
 * `tmdbTot`, der nicht durch ADN belegt ist; ein ADN-belegter Eintrag bleibt. Läuft gegen einen Wegwerf-Ordner (`AK_ROOT`).
 * Aufruf: npx tsx pipeline/check-cartoon-tote-bau.ts
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-tote-bau-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

const eintrag = (tmdbId: number, name: string, extra: Record<string, unknown> = {}) => ({
  id: -tmdbId,
  tmdbId,
  titleEn: name,
  jahr: 2999,
  genres: ['Animation'],
  anbieterDe: ['Netflix'],
  land: ['US'],
  stand: 3,
  geholtAm: '2026-10-01',
  ...extra,
})
const meldung = (titleId: number) => ({
  articleTitle: `Meldung ${titleId}`,
  articleUrl: `https://www.anime2you.de/news/${Math.abs(titleId)}/x/`,
  publishedAt: '2026-11-01T10:00:00+01:00',
  titleId,
  category: 'termin',
  platforms: ['netflix'],
  dates: [{ iso: '2999-01-10', context: 'startet am 10. Januar 2999' }],
  dub: 'deutsch',
})

try {
  const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
  const baue = (cartoons: Record<string, unknown>) => {
    writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify(cartoons))
    writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [meldung(-111), meldung(-222), meldung(-333)] }))
    const releases: import('../shared/types.ts').Release[] = []
    const alt = console.log
    console.log = () => undefined
    try {
      ergaenzeTermineAusNewsUndTv({ titles: new Map(), releases } as unknown as Parameters<typeof ergaenzeTermineAusNewsUndTv>[0])
    } finally {
      console.log = alt
    }
    return new Set(releases.map((r) => r.titleId))
  }
  const ids = baue({
    '-111': eintrag(111, 'Alpha'),
    '-222': eintrag(222, 'Beta', { tmdbTot: '2026-11-11' }),
    '-333': eintrag(333, 'Gamma', { tmdbTot: '2026-11-11', adnId: 9 }),
  })
  pruefe('lebender Cartoon: Meldung wird zum Termin (Kontrolle, dass die Kulisse trägt)', ids.has(-111), [...ids])
  pruefe('tmdbTot ohne ADN: keine Meldung auf seiner Kennung', !ids.has(-222), [...ids])
  pruefe('tmdbTot mit ADN-Kennung: bleibt sichtbar, Meldung wirkt', ids.has(-333), [...ids])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nCartoon tote Kennungen im Bau: alle Zusicherungen erfüllt')

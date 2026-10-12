/**
 * Zusicherungen zur Cover-Regel TMDB → AniList → eigene aniSearch-Kopie (`lib/cover-quelle.ts`). Ohne Netz, ohne Dateien.
 * Aufruf: `npm run check:logic`.
 */
import { COVER_EIGEN_BASIS, coverNachRegel } from './lib/cover-quelle.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const plakate = { '10000126': { p: '/abc.jpg' }, '10000341': null }
const eigene = { '126': { datei: 'anisearch/126.webp' }, '341': { datei: 'anisearch/341.webp' }, '500': {} }
const regel = (id: number, bisher?: string): string | undefined => coverNachRegel(id, bisher, plakate, eigene)

pruefe('TMDB-Plakat schlägt die eigene Kopie', regel(10_000_126) === 'https://image.tmdb.org/t/p/w500/abc.jpg', regel(10_000_126))
pruefe('AniList-Cover schlägt die eigene Kopie', regel(10_000_341, 'bx1.jpg') === 'bx1.jpg', regel(10_000_341, 'bx1.jpg'))
pruefe('ohne TMDB und AniList: die eigene Kopie', regel(10_000_341) === `${COVER_EIGEN_BASIS}anisearch/341.webp`, regel(10_000_341))
pruefe('Kennung ohne Bild im Manifest: kein Cover', regel(10_000_500) === undefined, regel(10_000_500))
pruefe('Kennung fehlt im Manifest: kein Cover', regel(10_009_999) === undefined, regel(10_009_999))
pruefe('AniList-Kennung nimmt keine aniSearch-Kopie (126 ist keine Titelkennung)', regel(126) === undefined, regel(126))
pruefe('Plakat ohne Treffer (null) fällt auf die eigene Kopie zurück', regel(10_000_341) === `${COVER_EIGEN_BASIS}anisearch/341.webp`)
pruefe('Die Basis ist die eigene Domain, nie aniSearch', COVER_EIGEN_BASIS === 'https://cover.anime-kalender.de/' && !COVER_EIGEN_BASIS.includes('anisearch'))

if (verletzt) {
  console.error(`check-cover-quelle: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-cover-quelle: alle Zusicherungen halten')

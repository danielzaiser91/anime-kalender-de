/**
 * Verdrahtung im Bau (`ergaenzeTermineAusNewsUndTv`): Ein Disc-Release mit dem Tag einer älteren Anime2You-Meldung bekommt den
 * Tag, den aniSearch später gelesen nennt (`lib/disc-anisearch-datum.ts`). Läuft gegen einen Wegwerf-Ordner (`AK_ROOT`);
 * die Tage liegen im Jahr 2999, damit die echte Uhr des Bauschritts nichts ändert.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'disc-anisearch-'))
process.env.AK_ROOT = wurzel

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const MELDUNG = 'https://www.anime2you.de/news/900005/verschoben/'
const ARTIKEL = 'https://www.anisearch.de/article/900006,dracheball-vol-1-blu-ray'

function schreibe(name: string, inhalt: unknown): void {
  writeFileSync(join(wurzel, 'data', name), JSON.stringify(inhalt))
}

async function main(): Promise<void> {
  mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(
    join(wurzel, 'data', 'proposals', 'anime2you.json'),
    JSON.stringify({ proposals: [{ articleTitle: 'Dracheball Vol. 1 erscheint später', articleUrl: MELDUNG, publishedAt: '2026-10-02', category: 'allgemein', platforms: [], dates: [], dub: 'unklar' }] }),
  )
  schreibe('disc-ausgaben.json', { 900005: [{ edition: 'Dracheball - Vol. 1/3 [Blu-ray]', datum: '2999-11-06', url: ARTIKEL, format: 'Blu-ray', kurz: 'Vol. 1/3' }] })
  schreibe('anisearch-artikel.json', { 900006: { ean: '4000000900005', publisher: 'Test', umfang: 'Einzelnes Vol.', fetchedAt: '2026-10-12T05:53:59.292Z' } })

  const zeilen: string[] = []
  const alt = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
  const titles = new Map([[900005, { id: 900005, franchiseId: 900005, titleEn: 'Dracheball', format: 'TV' }]])
  const releases = [
    { slug: 'dracheball-vol1', titleId: 900005, name: 'Dracheball – Vol. 1', platform: 'disc', releaseType: 'disc', schedule: { firstEpisodeDate: '2999-10-30' }, year: 2999, sources: [MELDUNG] },
  ]
  try {
    ergaenzeTermineAusNewsUndTv({ titles, releases } as unknown as Parameters<typeof ergaenzeTermineAusNewsUndTv>[0])
  } finally {
    console.log = alt
  }
  const zeile = zeilen.find((z) => z.includes('laut aniSearch'))
  pruefe('Bau: der Disc-Tag wechselt auf den aniSearch-Tag', releases[0]!.schedule.firstEpisodeDate === '2999-11-06', releases[0]!.schedule)
  pruefe('Bau: Logzeile nennt Titel, alten und neuen Tag', !!zeile && zeile.includes('Dracheball – Vol. 1 (2999-10-30 → 2999-11-06)'), zeile)
}

try {
  await main()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`Disc-Termin im Bau: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
